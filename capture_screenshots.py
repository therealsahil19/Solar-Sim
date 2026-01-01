import asyncio
import http.server
import socketserver
import threading
from playwright.async_api import async_playwright
import os

PORT = 8000
Handler = http.server.SimpleHTTPRequestHandler

def start_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at port {PORT}")
        httpd.serve_forever()

server_thread = threading.Thread(target=start_server, daemon=True)
server_thread.start()

async def capture():
    async with async_playwright() as p:
        browser = await p.chromium.launch()

        viewports = [
            {"name": "desktop", "width": 1920, "height": 1080},
            {"name": "tablet", "width": 768, "height": 1024},
            {"name": "mobile", "width": 375, "height": 667}
        ]

        for vp in viewports:
            print(f"Capturing {vp['name']}...")
            context = await browser.new_context(viewport={"width": vp["width"], "height": vp["height"]})
            page = await context.new_page()

            # Attach console listener for debugging
            page.on("console", lambda msg: print(f"Console: {msg.text}"))

            try:
                await page.goto(f"http://localhost:{PORT}")

                # Wait for loading screen to hide
                print("Waiting for loading screen to vanish...")
                await page.wait_for_selector("#loading-screen", state="hidden", timeout=30000)

                # Wait a bit for animations to settle
                await page.wait_for_timeout(2000)

                # Handle Welcome Modal if present
                # Using wait_for_timeout just to be safe if transitions are involved,
                # but better to check visibility
                is_modal_visible = await page.is_visible("#welcome-modal")
                if is_modal_visible:
                    print("Dismissing welcome modal...")
                    await page.click("#btn-start")
                    await page.wait_for_timeout(1000) # Wait for fade out

                screenshot_path = f".jules/screenshots/{vp['name']}.png"
                await page.screenshot(path=screenshot_path)
                print(f"Saved {screenshot_path}")

            except Exception as e:
                print(f"Error capturing {vp['name']}: {e}")

            await context.close()

        await browser.close()

if __name__ == "__main__":
    asyncio.run(capture())
