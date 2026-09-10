from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
import tempfile
import threading
import unittest
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "out"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format_string, *args):
        return


class QualitySmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="elp-quality-")
        cls.site = Path(cls.temp.name) / "out"
        shutil.copytree(OUT, cls.site)
        shutil.copy2(ROOT / "node_modules" / "axe-core" / "axe.min.js", cls.site / "axe.min.js")
        cls.handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(cls.site), **kwargs)
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), cls.handler)
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
        cls.temp.cleanup()

    def test_public_and_private_pages_have_no_axe_violations(self):
        context = self.browser.new_context(service_workers="block")
        self.addCleanup(context.close)
        for route in ("/", "/roadmap/", "/questions/", "/learn/rt-thread-scheduler/", "/settings/"):
            page = context.new_page()
            self.addCleanup(page.close)
            page.goto(f"{self.base_url}{route}", wait_until="domcontentloaded", timeout=15000)
            page.add_script_tag(url=f"{self.base_url}/axe.min.js")
            result = page.evaluate(
                """
                async () => await axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] })
                """
            )
            violations = result["violations"]
            self.assertEqual([], violations, f"axe violations on {route}: {violations}")

        verified = context.new_page()
        self.addCleanup(verified.close)
        verified.goto(f"{self.base_url}/learn/c-debugging-diagnostics/", wait_until="domcontentloaded", timeout=15000)
        self.assertEqual(verified.locator(".status.verified").inner_text(), "已核验")

        draft = context.new_page()
        self.addCleanup(draft.close)
        draft.goto(f"{self.base_url}/learn/rt-thread-scheduler/", wait_until="domcontentloaded", timeout=15000)
        self.assertEqual(draft.locator(".status.pending").inner_text(), "待核验")

        filtered = context.new_page()
        self.addCleanup(filtered.close)
        filtered.goto(f"{self.base_url}/questions/?q=PendSV", wait_until="domcontentloaded", timeout=15000)
        filtered.locator("#question-search").wait_for(timeout=10000)
        self.assertEqual(filtered.locator('meta[name="robots"]').count(), 1)
        self.assertEqual(filtered.locator('meta[name="robots"]').get_attribute("content"), "noindex,follow")
        canonical = filtered.locator('link[rel="canonical"]')
        self.assertEqual(canonical.count(), 1)
        canonical_url = urlparse(canonical.get_attribute("href"))
        self.assertEqual(canonical_url.path.rstrip("/"), "/questions")
        self.assertIsNone(canonical_url.query or None)

    def test_mobile_navigation_has_five_items_and_reaches_secondary_routes(self):
        context = self.browser.new_context(viewport={"width": 360, "height": 800}, service_workers="block")
        self.addCleanup(context.close)
        page = context.new_page()
        page.goto(f"{self.base_url}/", wait_until="domcontentloaded", timeout=15000)

        mobile_nav = page.locator(".mobile-nav")
        self.assertEqual(mobile_nav.locator(".mobile-nav-link").count(), 4)
        self.assertEqual(
            mobile_nav.locator(".mobile-nav-link").all_inner_texts(),
            ["今日", "路线", "题库", "复习"],
        )
        self.assertLessEqual(page.evaluate("document.body.scrollWidth"), 360)

        page.get_by_role("button", name="更多").click()
        more_menu = page.locator("#mobile-more-menu")
        more_menu.get_by_role("link", name="章节测验").wait_for()
        more_menu.get_by_role("link", name="我的笔记").wait_for()
        more_menu.get_by_role("link", name="设置与数据").wait_for()
        more_menu.get_by_role("link", name="离线状态").wait_for()
        more_menu.get_by_role("link", name="章节测验").click()
        page.wait_for_url("**/quiz/")
        self.assertEqual(page.get_by_role("heading", name="主动回忆").count(), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
