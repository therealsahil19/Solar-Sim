
import asyncio
from playwright.async_api import async_playwright
import http.server
import socketserver
import threading
import time
import os

PORT = 8081

def run_server():
    # Quiet server
    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, format, *args):
            pass

    with socketserver.TCPServer(("", PORT), QuietHandler) as httpd:
        httpd.serve_forever()

async def run():
    # Start server in background
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    # Wait for server
    time.sleep(2)

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox", "--disable-setuid-sandbox"])
        page = await browser.new_page()

        print("Loading simulation...")
        await page.goto(f"http://localhost:{PORT}")

        # Wait for loading screen to disappear
        try:
            await page.wait_for_selector("#loading-screen", state="hidden", timeout=60000)
            print("Simulation loaded.")
        except Exception as e:
            print("Timeout waiting for loading screen.")
            await browser.close()
            return

        # Ensure labels are ON
        labels_btn = await page.query_selector("#btn-labels")
        if labels_btn:
            is_pressed = await labels_btn.get_attribute("aria-pressed")
            if is_pressed != "true":
                await labels_btn.click()
                print("Enabled labels.")

        # Measure FPS/Frame Time
        print("Measuring performance...")
        result = await page.evaluate("""async () => {
            return new Promise(resolve => {
                let frames = 0;
                const startTime = performance.now();

                function loop() {
                    const now = performance.now();
                    frames++;
                    if (now - startTime > 5000) {
                        resolve({
                            fps: frames / 5,
                            avgFrameTime: (now - startTime) / frames
                        });
                    } else {
                        requestAnimationFrame(loop);
                    }
                }
                requestAnimationFrame(loop);
            });
        }""")

        print(f"Benchmark Result: FPS: {result['fps']:.2f}, Avg Frame Time: {result['avgFrameTime']:.2f}ms")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
