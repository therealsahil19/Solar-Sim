import os
import urllib.request
import ssl
import sys

TEXTURES_DIR = "textures"
BASE_URL = "https://www.solarsystemscope.com/textures/download"

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

if not os.path.exists(TEXTURES_DIR):
    os.makedirs(TEXTURES_DIR)

failed_downloads = []

for filename, remote_name in textures.items():
    url = f"{BASE_URL}/{remote_name}"
    filepath = os.path.join(TEXTURES_DIR, filename)
    print(f"Downloading {url} to {filepath}...")
    try:
        urllib.request.urlretrieve(url, filepath)
        print("Done.")
    except Exception as e:
        print(f"Failed to download {filename}: {e}")
        failed_downloads.append(filename)

if failed_downloads:
    print(f"\nError: The following textures failed to download: {', '.join(failed_downloads)}")
    sys.exit(1)
else:
    print("\nAll textures downloaded successfully.")
    sys.exit(0)
