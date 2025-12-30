import sys
import time
import subprocess
import threading
from playwright.sync_api import sync_playwright

PORT = 8000
SERVER_URL = f"http://localhost:{PORT}"

def start_server():
    """Starts a simple HTTP server in a separate thread."""
    # We use subprocess to run python's http.server
    # We suppress output to keep the console clean, or redirect to a file if needed.
    return subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

def test_scene():
    print(f"Starting server on port {PORT}...")
    server_process = start_server()

    # Give the server a moment to start
    time.sleep(1)

    try:
        print("Running Playwright verification...")
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            # Navigate to the local server
            print(f"Navigating to {SERVER_URL}...")
            page.goto(SERVER_URL)

            # Wait for the canvas to be present (Three.js appends a canvas)
            page.wait_for_selector("canvas", timeout=5000)
            print("✅ Canvas element found.")

            # Wait a bit for the scene to render
            page.wait_for_timeout(1000)

            # Check if we can find the canvas
            canvas = page.locator("canvas")
            if canvas.is_visible():
                print("✅ Canvas is visible.")
            else:
                print("❌ Canvas is not visible.")
                sys.exit(1)

            # Take a screenshot for manual inspection if needed (optional for the automated test pass/fail)
            # page.screenshot(path="vibe_check.png")

            print("✅ Scene loaded successfully.")
            browser.close()

    except Exception as e:
        print(f"❌ Test failed: {e}")
        sys.exit(1)
    finally:
        print("Stopping server...")
        server_process.terminate()
        server_process.wait()

if __name__ == "__main__":
    test_scene()
