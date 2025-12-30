from playwright.sync_api import sync_playwright
import time
import subprocess
import sys

def verify_camera_button():
    # Start the server
    server_process = subprocess.Popen([sys.executable, "-m", "http.server", "8000"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(2)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto("http://localhost:8000")

            # Wait for the button
            button = page.locator("#btn-camera")
            button.wait_for(state="visible")

            # Click it
            button.click()
            time.sleep(1) # Wait for camera transition

            # Take screenshot
            page.screenshot(path="verification/camera_toggle.png")
            print("Screenshot taken.")

    finally:
        server_process.terminate()

if __name__ == "__main__":
    verify_camera_button()
