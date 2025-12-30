from playwright.sync_api import sync_playwright
import time
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        print("Navigating to app...")
        page.goto("http://localhost:8000")

        # Wait for loading to finish (loading screen opacity 0 or display none)
        print("Waiting for loading screen to disappear...")
        try:
            page.wait_for_selector("#loading-screen", state="hidden", timeout=10000)
        except Exception as e:
            print("Loading screen didn't disappear in time (or was already gone). Proceeding...")

        # Ensure canvas is present
        page.wait_for_selector("canvas[role='application']")

        # Allow time for Three.js to render the first frame properly
        time.sleep(2)

        # Take screenshot of High Quality (Textured) View
        print("Taking High Quality screenshot...")
        page.screenshot(path="verification/hq_view.png")

        # Interact with Texture Toggle Button
        print("Toggling to Low Quality...")
        page.click("#btn-texture")
        time.sleep(1) # Wait for material swap and render

        # Check Toast
        toast = page.locator("#toast")
        if toast.is_visible():
            print(f"Toast visible: {toast.inner_text()}")

        # Take screenshot of Low Quality (Solid Color) View
        print("Taking Low Quality screenshot...")
        page.screenshot(path="verification/lq_view.png")

        # Verify button text changed
        btn_text = page.inner_text("#btn-texture")
        print(f"Button text is now: {btn_text} (Expected: LD)")

        browser.close()

if __name__ == "__main__":
    if not os.path.exists("verification"):
        os.makedirs("verification")
    run()
