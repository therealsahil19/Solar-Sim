"""
Script: download_textures.py
Description: Automates the downloading of planetary textures for the Solar System simulation.
Source: solarsystemscope.com (Creative Commons Attribution 4.0 International License)

Usage:
    python3 download_textures.py

Behavior:
    1. Checks if 'textures/' directory exists, creates it if not.
    2. Iterates through a defined map of local filenames -> remote URLs.
    3. Downloads each texture.
    4. Reports successes and failures.
    5. Exits with status code 1 if any downloads fail, 0 otherwise.
"""

import os
import urllib.request
import ssl
import sys

# Constants
TEXTURES_DIR = "textures"
BASE_URL = "https://www.solarsystemscope.com/textures/download"

# Mapping of Local Filename -> Remote Filename
# We rename them to be simpler (e.g., 'earth.jpg' instead of '2k_earth_daymap.jpg')
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

# Ensure destination directory exists
if not os.path.exists(TEXTURES_DIR):
    os.makedirs(TEXTURES_DIR)

failed_downloads = []

print(f"Starting download of {len(textures)} textures to '{TEXTURES_DIR}/'...")

for filename, remote_name in textures.items():
    url = f"{BASE_URL}/{remote_name}"
    filepath = os.path.join(TEXTURES_DIR, filename)

    print(f"  - Downloading {filename}...", end=" ")

    try:
        # Note: In production environments, verify SSL certificates properly.
        # This basic script relies on the system's default SSL context.
        urllib.request.urlretrieve(url, filepath)
        print("✅ Done.")
    except Exception as e:
        print(f"❌ Failed: {e}")
        failed_downloads.append(filename)

# Exit Handling
if failed_downloads:
    print(f"\n⚠️  Error: The following textures failed to download: {', '.join(failed_downloads)}")
    sys.exit(1)
else:
    print("\n✨ All textures downloaded successfully.")
    sys.exit(0)
