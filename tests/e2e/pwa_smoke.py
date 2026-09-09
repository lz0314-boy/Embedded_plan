from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
import tempfile
import threading
import unittest
import os

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "out"
RESULTS = ROOT / "test-results"


class QuietHandler(SimpleHTTPRequestHandler):
    base_path = ""

    def translate_path(self, path):
        if self.base_path and (path == self.base_path or path.startswith(f"{self.base_path}/")):
            path = path[len(self.base_path):] or "/"
        return super().translate_path(path)

    def log_message(self, format_string, *args):
        return

    def end_headers(self):
        if self.path.split("?", 1)[0].endswith("/sw.js"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()


class PwaSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        RESULTS.mkdir(exist_ok=True)
        cls.temp = tempfile.TemporaryDirectory(prefix="elp-pwa-")
        cls.site = Path(cls.temp.name) / "out"
        shutil.copytree(OUT, cls.site)
        cls.original_worker = (cls.site / "sw.js").read_bytes()
        cls.base_path = os.environ.get("PWA_TEST_BASE_PATH", "").rstrip("/")
        cls.handler_type = type("TestHandler", (QuietHandler,), {"base_path": cls.base_path})
        cls.handler = lambda *args, **kwargs: cls.handler_type(*args, directory=str(cls.site), **kwargs)
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), cls.handler)
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.server.server_port}"
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True)

    @classmethod
    def url(cls, path="/"):
        return f"{cls.base_url}{cls.base_path}{path}"

    def setUp(self):
        (self.site / "sw.js").write_bytes(self.original_worker)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.server_thread.join(timeout=5)
        cls.browser.close()
        cls.playwright.stop()
        cls.temp.cleanup()

    def context(self, viewport=None):
        context = self.browser.new_context(service_workers="allow", viewport=viewport, bypass_csp=True)
        self.addCleanup(context.close)
        return context

    def open_controlled(self, context, path="/"):
        page = context.new_page()
        page.goto(self.url(path), wait_until="domcontentloaded", timeout=15000)
        try:
            page.wait_for_function("Boolean(navigator.serviceWorker && navigator.serviceWorker.controller)", timeout=20000)
        except PlaywrightError:
            page.reload(wait_until="domcontentloaded", timeout=15000)
            page.wait_for_function("Boolean(navigator.serviceWorker && navigator.serviceWorker.controller)", timeout=20000)
        return page

    @staticmethod
    def wait_for_waiting(page, timeout=30000):
        page.evaluate(
            """
            async (timeoutMs) => {
              const deadline = Date.now() + timeoutMs;
              while (Date.now() < deadline) {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration && registration.waiting) return;
                await new Promise((resolve) => setTimeout(resolve, 100));
              }
              throw new Error("waiting worker timeout");
            }
            """,
            timeout,
        )

    @staticmethod
    def worker_message(page, message_type, message_id=None, timeout=180000):
        return page.evaluate(
            """
            async ([messageType, messageId, timeoutMs]) => {
              const registration = await navigator.serviceWorker.ready;
              const worker = registration.active;
              if (!worker) throw new Error("active worker unavailable");
              return await new Promise((resolve, reject) => {
                const channel = new MessageChannel();
                const timer = setTimeout(() => reject(new Error("worker message timeout")), timeoutMs);
                channel.port1.onmessage = (event) => {
                  clearTimeout(timer);
                  resolve(event.data);
                };
                worker.postMessage({ type: messageType, id: messageId }, [channel.port2]);
              });
            }
            """,
            [message_type, message_id, timeout],
        )

    def cache_state(self, page):
        return page.evaluate(
            """
            async () => {
              const keys = await caches.keys();
              const requests = [];
              const bodies = [];
              for (const key of keys) {
                const cache = await caches.open(key);
                for (const request of await cache.keys()) {
                  requests.push(request.url);
                  bodies.push(await (await cache.match(request)).text());
                }
              }
              return { keys, requests, bodies };
            }
            """
        )

    @staticmethod
    def indexed_notes(page):
        return page.evaluate(
            """
            () => new Promise((resolve, reject) => {
              const request = indexedDB.open("embedded-learning-db");
              request.onerror = () => reject(request.error);
              request.onsuccess = () => {
                const database = request.result;
                const read = database.transaction("notes", "readonly").objectStore("notes").getAll();
                read.onerror = () => reject(read.error);
                read.onsuccess = () => { database.close(); resolve(read.result); };
              };
            })
            """
        )

    @staticmethod
    def indexed_store(page, store_name):
        return page.evaluate(
            """
            (storeName) => new Promise((resolve, reject) => {
              const request = indexedDB.open("embedded-learning-db");
              request.onerror = () => reject(request.error);
              request.onsuccess = () => {
                const database = request.result;
                const read = database.transaction(storeName, "readonly").objectStore(storeName).getAll();
                read.onerror = () => reject(read.error);
                read.onsuccess = () => { database.close(); resolve(read.result); };
              };
            })
            """,
            store_name,
        )

    @staticmethod
    def seed_restore_data(page, marker):
        return page.evaluate(
            """
            async (marker) => {
              const database = await new Promise((resolve, reject) => {
                const request = indexedDB.open("embedded-learning-db");
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
              });
              await new Promise((resolve, reject) => {
                const transaction = database.transaction(["settings", "contentProgress", "notes", "bookmarks", "reviewCards", "quizAttempts", "wrongQuestions"], "readwrite");
                transaction.objectStore("settings").put({ id: "default", dailyMinutes: 90, targetDate: "2026-10-01", focus: "linux-bsp", selfAssessment: "project", notificationsEnabled: false, createdAt: "2026-09-09T00:00:00.000Z", updatedAt: "2026-09-09T00:01:00.000Z" });
                transaction.objectStore("contentProgress").put({ contentId: "rt-thread-scheduler", status: "completed", position: 1, updatedAt: "2026-09-09T00:02:00.000Z" });
                transaction.objectStore("notes").put({ id: "restore-note", contentId: "rt-thread-scheduler", body: marker, createdAt: "2026-09-09T00:03:00.000Z", updatedAt: "2026-09-09T00:03:00.000Z", deletedAt: null });
                transaction.objectStore("bookmarks").put({ contentId: "rt-thread-scheduler", createdAt: "2026-09-09T00:04:00.000Z" });
                transaction.objectStore("reviewCards").put({ cardId: "rt-thread-scheduler", contentId: "rt-thread-scheduler", due: "2026-10-02T00:00:00.000Z", state: 2, stability: 3, difficulty: 5, reps: 2, lapses: 0, algorithmVersion: "ts-fsrs-5.4.2" });
                transaction.objectStore("quizAttempts").put({ id: "restore-attempt", quizId: "quiz-restore", selected: "B", correct: false, submittedAt: "2026-09-09T00:05:00.000Z", durationSeconds: 12 });
                transaction.objectStore("wrongQuestions").put({ questionId: "quiz-restore", status: "active", failureCount: 2, updatedAt: "2026-09-09T00:05:00.000Z" });
                transaction.oncomplete = () => { database.close(); resolve(); };
                transaction.onerror = () => reject(transaction.error);
              });
            }
            """,
            marker,
        )

    def test_backup_restores_into_a_fresh_browser(self):
        source_context = self.context()
        source = self.open_controlled(source_context, "/settings/")
        source.locator("#daily-minutes").wait_for(timeout=10000)
        marker = "fresh-browser-restore-note"
        self.seed_restore_data(source, marker)
        backup_path = Path(self.temp.name) / "fresh-browser-backup.json"
        with source.expect_download() as download_info:
            source.get_by_role("button", name="导出 JSON 备份").click()
        download_info.value.save_as(str(backup_path))
        self.assertTrue(backup_path.exists())

        fresh_context = self.context()
        restored = self.open_controlled(fresh_context, "/settings/")
        restored.locator('input[type="file"]').set_input_files(str(backup_path))
        restored.get_by_text("备份已校验并合并到本机。", exact=True).wait_for(timeout=10000)
        self.assertEqual(self.indexed_store(restored, "settings")[0]["dailyMinutes"], 90)
        self.assertEqual(self.indexed_store(restored, "notes")[0]["body"], marker)
        self.assertEqual(self.indexed_store(restored, "contentProgress")[0]["status"], "completed")
        self.assertEqual(self.indexed_store(restored, "reviewCards")[0]["due"], "2026-10-02T00:00:00.000Z")
        self.assertEqual(self.indexed_store(restored, "quizAttempts")[0]["id"], "restore-attempt")
        self.assertEqual(self.indexed_store(restored, "wrongQuestions")[0]["failureCount"], 2)
        self.assertEqual(self.indexed_store(restored, "bookmarks")[0]["contentId"], "rt-thread-scheduler")

    def test_shell_manifest_and_downloaded_package_work_offline(self):
        context = self.context()
        page = self.open_controlled(context)
        self.assertEqual(page.get_by_role("heading", name="继续你的嵌入式学习闭环").inner_text(), "继续你的嵌入式学习闭环")
        manifest = page.evaluate("async (url) => await (await fetch(url)).json()", self.url("/manifest.webmanifest"))
        self.assertEqual(manifest["short_name"], "嵌入式复习站")
        self.assertEqual(manifest["scope"], f"{self.base_path}/")
        icon_state = page.evaluate(
            """
            async (urls) => {
              const result = {};
              for (const url of urls) {
                const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
                result[url] = { signature: Array.from(bytes.slice(0, 8)), width: new DataView(bytes.buffer).getUint32(16) };
              }
              return result;
            }
            """,
            [self.url("/icons/icon-192.png"), self.url("/icons/icon-512.png"), self.url("/icons/icon-maskable.png")],
        )
        self.assertEqual(icon_state[self.url("/icons/icon-192.png")]["width"], 192)
        self.assertEqual(icon_state[self.url("/icons/icon-512.png")]["width"], 512)
        self.assertEqual(icon_state[self.url("/icons/icon-192.png")]["signature"], [137, 80, 78, 71, 13, 10, 26, 10])
        settings = self.open_controlled(context, "/settings/")
        row = settings.locator(".offline-package").filter(has_text="RT-Thread")
        row.get_by_role("button", name="下载").click()
        settings.get_by_text("已下载“RT-Thread”离线包。", exact=True).wait_for(timeout=180000)
        status = self.worker_message(settings, "STATUS")
        self.assertTrue(any(item["id"] == "rt-thread" for item in status["value"]["installed"]))
        state = self.cache_state(settings)
        self.assertTrue(any("/roadmap" in url for url in state["requests"]))
        self.assertFalse(any("supabase.co" in url for url in state["requests"]))
        context.set_offline(True)
        offline_lesson = self.open_controlled(context, "/learn/rt-thread-scheduler/")
        self.assertIn("RT-Thread 线程调度与就绪队列", offline_lesson.get_by_role("heading", level=1).inner_text())
        unknown = self.open_controlled(context, "/not-cached-route/")
        self.assertEqual(unknown.get_by_role("heading", name="当前没有网络").inner_text(), "当前没有网络")
        new_page = context.new_page()
        new_page.goto(self.url("/"), wait_until="domcontentloaded", timeout=15000)
        self.assertEqual(new_page.get_by_role("heading", name="继续你的嵌入式学习闭环").inner_text(), "继续你的嵌入式学习闭环")

    def test_private_data_stays_in_indexeddb(self):
        context = self.context()
        page = self.open_controlled(context, "/learn/rt-thread-scheduler/")
        marker = "private-note-e2e-marker"
        page.locator("#private-note").fill(marker)
        page.get_by_role("button", name="保存笔记").click()
        page.get_by_text("笔记已保存到本机 IndexedDB。", exact=True).wait_for(timeout=10000)
        state = self.cache_state(page)
        self.assertFalse(any("supabase.co" in url for url in state["requests"]))
        self.assertFalse(any(marker in body for body in state["bodies"]))
        notes = self.indexed_notes(page)
        self.assertTrue(any(note["body"] == marker for note in notes))
        self.worker_message(page, "CLEAR_CONTENT_CACHE")
        self.assertTrue(any(note["body"] == marker for note in self.indexed_notes(page)))
        self.worker_message(page, "DOWNLOAD_PACKAGE", "rt-thread")
        self.worker_message(page, "DELETE_PACKAGE", "rt-thread")
        self.assertTrue(any(note["body"] == marker for note in self.indexed_notes(page)))

    def test_interview_session_persists_local_answers(self):
        context = self.context()
        page = self.open_controlled(context, "/interview/")
        page.locator("#interview-count").select_option("1")
        page.locator(".panel button").first.click()
        page.wait_for_url("**/interview/session/?sid=*")
        page.locator("#interview-response").fill("先区分标准语义、实现约束和目标平台，再说明验证路径。")
        page.locator("#score-mechanism").select_option("4")
        page.locator("#score-boundary").select_option("3")
        page.locator("#score-verification").select_option("4")
        page.locator(".interview-question .button-row button").nth(0).click()
        page.locator(".interview-question .button-row button").nth(1).click()
        page.get_by_role("heading", name="复盘本次回答").wait_for(timeout=10000)
        sessions = self.indexed_store(page, "interviewSessions")
        self.assertEqual(len(sessions), 1)
        self.assertEqual(sessions[0]["status"], "completed")
        self.assertEqual(sessions[0]["answers"][0]["response"], "先区分标准语义、实现约束和目标平台，再说明验证路径。")

    def test_code_draft_stays_local_and_runner_downgrades_without_isolation(self):
        context = self.context()
        page = self.open_controlled(context, "/labs/c-memory-lab/")
        marker = "private-code-draft-e2e-marker"
        page.get_by_label("C 代码编辑器").fill(marker)
        page.get_by_role("button", name="保存草稿").click()
        page.get_by_text("代码草稿已保存到本机 IndexedDB。", exact=True).wait_for(timeout=10000)
        self.assertTrue(any(draft["source"] == marker for draft in self.indexed_store(page, "codeDrafts")))
        state = self.cache_state(page)
        self.assertFalse(any(marker in body for body in state["bodies"]))
        self.assertIn("cross-origin isolation", page.locator(".code-runner").inner_text())

    def test_project_case_is_local_until_explicit_sync_opt_in(self):
        context = self.context()
        page = self.open_controlled(context, "/projects/")
        marker = "private-project-e2e-marker"
        page.locator("#project-title").fill("本机测试项目")
        page.locator("#project-context").fill(marker)
        page.get_by_role("button", name="保存项目经历").click()
        page.get_by_text("未加入同步队列", exact=False).wait_for()
        projects = self.indexed_store(page, "projectCases")
        self.assertTrue(any(project["context"] == marker and not project["syncEnabled"] for project in projects))
        self.assertFalse(any(item["recordType"] == "project_case" for item in self.indexed_store(page, "syncMutations")))
        self.assertFalse(any(marker in body for body in self.cache_state(page)["bodies"]))

        page.get_by_label("允许将这条项目经历加入我的 Supabase 同步队列").check()
        page.get_by_role("button", name="保存项目经历").click()
        page.get_by_text("加入可选同步队列", exact=False).wait_for()
        self.assertTrue(any(item["recordType"] == "project_case" for item in self.indexed_store(page, "syncMutations")))

    def test_failed_download_is_atomic(self):
        context = self.context()
        page = self.open_controlled(context)
        self.worker_message(page, "DOWNLOAD_PACKAGE", "c")
        asset = self.site / "learn" / "c-memory-lab" / "index.html"
        original = asset.read_bytes()
        try:
            asset.write_bytes(original + b"\natomic-download-test")
            result = self.worker_message(page, "DOWNLOAD_PACKAGE", "c")
        finally:
            asset.write_bytes(original)
        self.assertFalse(result["ok"])
        status = self.worker_message(page, "STATUS")["value"]
        installed = [item for item in status["installed"] if item["id"] == "c"]
        self.assertEqual(len(installed), 1)
        self.assertNotIn("atomic-download-test", self.cache_state(page)["bodies"])

    def test_update_saves_note_before_activation(self):
        context = self.context()
        page = self.open_controlled(context, "/learn/rt-thread-scheduler/")
        marker = "draft-before-update-e2e-marker"
        page.locator("#private-note").fill(marker)
        worker_path = self.site / "sw.js"
        worker_path.write_bytes(worker_path.read_bytes() + b"\nself.__testRevision='second';\n")
        page.evaluate("async () => await (await navigator.serviceWorker.getRegistration()).update()")
        self.wait_for_waiting(page)
        self.assertEqual(page.locator("#private-note").input_value(), marker)
        page.get_by_role("button", name="保存并更新").click()
        page.wait_for_load_state("domcontentloaded", timeout=30000)
        page.get_by_role("heading", name="RT-Thread 线程调度与就绪队列").wait_for(timeout=30000)
        page.wait_for_function("(value) => document.querySelector('#private-note')?.value === value", arg=marker, timeout=10000)
        page.wait_for_function("() => document.readyState === 'complete'", timeout=10000)
        self.assertTrue(any(note["body"] == marker for note in self.indexed_notes(page)))

    def test_update_is_blocked_when_another_tab_is_open(self):
        context = self.context()
        first = self.open_controlled(context)
        second = self.open_controlled(context, "/roadmap/")
        worker_path = self.site / "sw.js"
        worker_path.write_bytes(worker_path.read_bytes() + b"\nself.__testRevision='multi-tab';\n")
        first.evaluate("async () => await (await navigator.serviceWorker.getRegistration()).update()")
        self.wait_for_waiting(first)
        first.get_by_role("button", name="保存并更新").click()
        first.get_by_role("alert").filter(has_text="请先关闭本站的其他标签页").wait_for(timeout=10000)
        self.assertEqual(first.url, self.url("/"))
        self.assertTrue(second.url.endswith(f"{self.base_path}/roadmap/"))

    def test_mobile_and_desktop_have_no_horizontal_overflow(self):
        for width in (360, 390, 768, 1280, 1440):
            context = self.context({"width": width, "height": 900})
            page = self.open_controlled(context)
            overflow = page.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth")
            self.assertTrue(overflow, f"horizontal overflow at width {width}")
            page.screenshot(path=str(RESULTS / f"shell-{width}.png"), full_page=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
