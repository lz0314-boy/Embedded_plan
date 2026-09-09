from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen
import shutil
import threading
import unittest

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "out"
RESULTS = ROOT / "test-results"
RUNNO_ASSETS = ("clang.wasm", "clang-fs.tar.gz", "wasm-ld.wasm")


def download_asset(asset):
    target = RESULTS / "runno-assets" / asset
    if target.exists() and target.stat().st_size > 0:
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(f"{target.suffix}.tmp")
    request = Request(
        f"https://runno.dev/langs/{asset}",
        headers={"Accept": "*/*", "User-Agent": "Mozilla/5.0 EmbeddedLearningPlatformRunnerTest/1.0"},
    )
    with urlopen(request, timeout=360) as response, temporary.open("wb") as output:
        shutil.copyfileobj(response, output)
    temporary.replace(target)


class IsolatedHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        if self.path.split("?", 1)[0].endswith("/sw.js"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format_string, *args):
        return


class RunnerSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        RESULTS.mkdir(exist_ok=True)
        with ThreadPoolExecutor(max_workers=len(RUNNO_ASSETS)) as executor:
            list(executor.map(download_asset, RUNNO_ASSETS))
        handler = lambda *args, **kwargs: IsolatedHandler(*args, directory=str(OUT), **kwargs)
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.server.server_port}"
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.server_thread.join(timeout=5)
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.context = self.browser.new_context(service_workers="block")
        self.context.route("https://runno.dev/langs/*", self.fulfill_runno_asset)
        self.addCleanup(self.context.close)
        self.page = self.context.new_page()
        self.page.goto(f"{self.base_url}/labs/c-memory-lab/", wait_until="domcontentloaded", timeout=30_000)
        self.page.wait_for_function("crossOriginIsolated === true")

    @staticmethod
    def fulfill_runno_asset(route):
        asset = route.request.url.rsplit("/", 1)[-1].split("?", 1)[0]
        if asset not in RUNNO_ASSETS:
            route.abort("blockedbyclient")
            return
        content_type = "application/wasm" if asset.endswith(".wasm") else "application/gzip"
        route.fulfill(
            path=RESULTS / "runno-assets" / asset,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=31536000, immutable",
                "Content-Type": content_type,
                "Cross-Origin-Resource-Policy": "cross-origin",
            },
        )

    def prepare(self):
        self.page.get_by_role("button", name="准备 C runner（约 13.5 MiB）").click()
        status = self.page.locator('[role="status"]')
        self.page.wait_for_function(
            "() => !document.querySelector('[role=status]')?.textContent?.startsWith('正在下载')",
            timeout=360_000,
        )
        self.assertIn("C runner 已准备完成", status.inner_text())

    def run_source(self, source, expected_status, timeout=30_000):
        result = self.page.locator(".runner-result")
        previous = result.inner_text() if result.count() else ""
        editor = self.page.get_by_label("C 代码编辑器")
        editor.fill(source)
        self.page.wait_for_function(
            "(value) => document.querySelector('[aria-label=\"C 代码编辑器\"]')?.value === value",
            arg=source,
        )
        self.page.wait_for_timeout(250)
        self.page.get_by_role("button", name="运行 C", exact=True).click()
        self.page.wait_for_function(
            "(previous) => document.querySelector('.runner-result')?.innerText !== previous",
            arg=previous,
            timeout=timeout,
        )
        self.assertIn(expected_status, result.inner_text())

    def test_normal_compile_error_timeout_output_limit_and_termination(self):
        self.prepare()
        self.run_source('#include <stdio.h>\nint main(void){puts("ok");return 0;}', "运行完成", 60_000)
        self.assertIn("ok", self.page.locator(".runner-result").inner_text())

        self.run_source("int main(void) { this is not C; }", "编译或执行器错误", 60_000)

        self.run_source("int main(void) { for (;;) {} }", "超时，Worker 已终止", 30_000)

        self.prepare()
        self.run_source('#include <stdio.h>\nint main(void){for(int i=0;i<70000;i++)putchar(\'x\');return 0;}', "输出超限，Worker 已终止", 60_000)

        self.prepare()
        self.page.get_by_label("C 代码编辑器").fill("int main(void) { for (;;) {} }")
        self.page.get_by_role("button", name="运行 C", exact=True).click()
        self.page.get_by_role("button", name="强制终止").click()
        self.page.locator(".runner-result").get_by_text("已终止", exact=True).wait_for(timeout=10_000)

    def test_low_memory_device_downgrades(self):
        context = self.browser.new_context(service_workers="block")
        self.addCleanup(context.close)
        context.add_init_script("Object.defineProperty(navigator, 'deviceMemory', { value: 1, configurable: true });")
        page = context.new_page()
        page.goto(f"{self.base_url}/labs/c-memory-lab/", wait_until="domcontentloaded", timeout=30_000)
        page.get_by_text("当前设备或浏览器不满足 C/WASI runner 条件", exact=False).wait_for()
        self.assertTrue(page.get_by_role("button", name="运行 C", exact=True).is_disabled())


if __name__ == "__main__":
    unittest.main(verbosity=2)
