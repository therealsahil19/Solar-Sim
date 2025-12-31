
from playwright.sync_api import sync_playwright, expect
import time

def verify_command_palette():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Create a new context with a larger viewport
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        # Listen for console errors
        page.on("console", lambda msg: print(f"Console: {msg.text}"))

        try:
            # 1. Load the app
            print("Loading app...")
            page.goto("http://localhost:8080")

            # Wait for loading screen to disappear
            print("Waiting for loading screen...")
            expect(page.locator("#loading-screen")).to_have_attribute("aria-hidden", "true", timeout=20000)

            # Close welcome modal by clicking Start
            print("Closing welcome modal...")
            # Ensure button is visible before clicking
            start_btn = page.locator("#btn-start")
            expect(start_btn).to_be_visible()
            start_btn.click()

            # Wait for modal to close (dialog closes, so it won't be visible or won't be open)
            # The dialog element remains in DOM but not open
            # We can check if it's not visible
            print("Waiting for modal to close...")
            # expect(page.locator("#welcome-modal")).not_to_be_visible()
            # Note: <dialog> visibility logic in playwright might be tricky if it just loses 'open' attribute
            # Let's wait a bit
            time.sleep(1)

            # 2. Open Command Palette (Cmd+K)
            print("Opening Command Palette...")
            # Simulate Cmd+K (Meta+K or Control+K)
            page.keyboard.down("Control")
            page.keyboard.press("k")
            page.keyboard.up("Control")

            # Wait for overlay to be visible
            palette = page.locator("#cmd-palette-overlay")
            expect(palette).to_be_visible()

            # 3. Verify Structure
            input_box = page.locator(".cmd-panel input")
            expect(input_box).to_be_visible()

            # Wait for focus - this was the failure point
            # If it fails again, it might be a timing issue with the animation
            print("Waiting for focus...")
            expect(input_box).to_be_focused(timeout=5000)

            # 4. Type search term "Earth"
            print("Searching for 'Earth'...")
            input_box.type("Earth", delay=100)
            time.sleep(1) # Wait for filter

            # Verify results
            earth_item = page.locator(".cmd-item").first
            expect(earth_item).to_contain_text("Earth")

            # Screenshot of Search Results
            print("Taking screenshot 1: Search Results")
            page.screenshot(path="verification/1_search_results.png")

            # 5. Type "Orbit" to find command
            input_box.fill("")
            input_box.type("Orbit", delay=100)
            time.sleep(1)

            orbit_cmd = page.locator(".cmd-item").first
            expect(orbit_cmd).to_contain_text("Toggle Orbits")

            # Screenshot of Command Search
            print("Taking screenshot 2: Command Search")
            page.screenshot(path="verification/2_command_search.png")

            print("Verification Complete.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
            exit(1)
        finally:
            browser.close()

if __name__ == "__main__":
    verify_command_palette()
