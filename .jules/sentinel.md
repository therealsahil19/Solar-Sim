## 2025-12-30 - [SSL Verification Bypass in Tools]
**Vulnerability:** The `download_textures.py` script contained `ssl._create_default_https_context = ssl._create_unverified_context`, which globally disabled SSL certificate verification for the script.
**Learning:** This was likely added as a temporary workaround for a development environment or a specific network issue but was left in the codebase. It exposed the user to Man-in-the-Middle (MitM) attacks when downloading assets.
**Prevention:** Never disable SSL verification globally. If a specific endpoint has a self-signed certificate (which should be rare for public resources like `solarsystemscope.com`), handle it via a specific context or fix the root cause (trust store). Always prefer "secure by default" configurations.
