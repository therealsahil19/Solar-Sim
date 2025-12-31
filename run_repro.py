from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to repro page
        page.goto("http://localhost:8000/repro_asteroid.html")

        # Wait for some animation to happen
        page.wait_for_timeout(2000)

        # Capture console logs to see if any shader errors
        page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))

        # Screenshot
        page.screenshot(path="repro_before.png")

        browser.close()

if __name__ == "__main__":
    run()
