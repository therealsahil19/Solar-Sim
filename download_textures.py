"""
Script: download_textures.py
Description: Automates the downloading of planetary textures for the Solar System simulation.
Source: solarsystemscope.com (Creative Commons Attribution 4.0 International License)

Usage:
    python3 download_textures.py

Behavior:
    1. Checks if 'textures/' directory exists, creates it if not.
    2. Iterates through a defined map of local filenames -> remote URLs.
    3. Downloads each texture in parallel using a thread pool.
    4. Reports successes and failures.
    5. Exits with status code 1 if any downloads fail, 0 otherwise.
"""

import os
import urllib.request
import ssl
import shutil
import sys
import time
import concurrent.futures

# Constants
TEXTURES_DIR = "textures"
BASE_URL = "https://www.solarsystemscope.com/textures/download"

# Mapping of Local Filename -> Remote Filename
textures = {
    "sun.jpg": "2k_sun.jpg",
    "mercury.jpg": "2k_mercury.jpg",
    "venus.jpg": "2k_venus_surface.jpg",
    "earth.jpg": "2k_earth_daymap.jpg",
    "moon.jpg": "2k_moon.jpg",
    "mars.jpg": "2k_mars.jpg",
    "jupiter.jpg": "2k_jupiter.jpg",
    "saturn.jpg": "2k_saturn.jpg",
    "uranus.jpg": "2k_uranus.jpg",
    "neptune.jpg": "2k_neptune.jpg",
    "stars.jpg": "2k_stars_milky_way.jpg"
}

def download_texture(args):
    """
    Downloads a single texture.
    Args:
        args: Tuple of (filename, remote_name, ssl_context)
    Returns:
        filename if failed, None if success
    """
    filename, remote_name, context = args
    url = f"{BASE_URL}/{remote_name}"
    filepath = os.path.join(TEXTURES_DIR, filename)

    try:
        # Verify SSL certificates properly using reused context
        with urllib.request.urlopen(url, context=context) as response, open(filepath, 'wb') as out_file:
            shutil.copyfileobj(response, out_file)
        print(f"  - Downloading {filename}... ✅ Done.")
        return None
    except Exception as e:
        print(f"  - Downloading {filename}... ❌ Failed: {e}")
        return filename

def main():
    # Ensure destination directory exists
    if not os.path.exists(TEXTURES_DIR):
        os.makedirs(TEXTURES_DIR)

    print(f"Starting download of {len(textures)} textures to '{TEXTURES_DIR}/'...")
    start_time = time.time()

    failed_downloads = []

    # Create SSL context once
    context = ssl.create_default_context()
    
    # Pack arguments: (filename, remote_name, context)
    download_args = []
    for filename, remote_name in textures.items():
        download_args.append((filename, remote_name, context))

    # Use ThreadPoolExecutor for parallel downloads
    # Adjust max_workers as needed; usually 5-10 is good for I/O bound tasks like this
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        # We convert dict items to a list to map over them
        results = executor.map(download_texture, download_args)

    # Collect failures
    for result in results:
        if result:
            failed_downloads.append(result)

    # Exit Handling
    end_time = time.time()
    elapsed = end_time - start_time
    print(f"\n⏱️  Total time: {elapsed:.2f}s")

    if failed_downloads:
        print(f"⚠️  Error: The following textures failed to download: {', '.join(failed_downloads)}")
        sys.exit(1)
    else:
        print("✨ All textures downloaded successfully.")
        sys.exit(0)

if __name__ == "__main__":
    main()
