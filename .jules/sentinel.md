## 2025-12-30 - [SSL Verification Bypass in Tools]
**Vulnerability:** The `download_textures.py` script contained `ssl._create_default_https_context = ssl._create_unverified_context`, which globally disabled SSL certificate verification for the script.
**Learning:** This was likely added as a temporary workaround for a development environment or a specific network issue but was left in the codebase. It exposed the user to Man-in-the-Middle (MitM) attacks when downloading assets.
**Prevention:** Never disable SSL verification globally. If a specific endpoint has a self-signed certificate (which should be rare for public resources like `solarsystemscope.com`), handle it via a specific context or fix the root cause (trust store). Always prefer "secure by default" configurations.

## 2025-12-30 - [Security Architecture Update]
**Threat Model:**
1.  **XSS (Cross-Site Scripting):** Malicious scripts injected via compromised CDNs or inline execution.
2.  **Supply Chain Attack:** Compromised `unpkg.com` serving malicious Three.js versions.
3.  **Data Exfiltration:** Unrestricted network access allows sending sensitive data to attacker-controlled servers.

**Mitigation:**
1.  **Strict CSP:** Implemented `Content-Security-Policy` meta tag.
    *   `script-src`: strict `'self' 'sha256-...' https://unpkg.com`. Blocks all other inline scripts and eval.
    *   `object-src 'none'`: Blocks Flash/Java plugins.
    *   `base-uri 'self'`: Prevents `<base>` tag hijacking.
2.  **Subresource Integrity (SRI):** Added `<link rel="modulepreload" integrity="...">` for all external Three.js dependencies. Browsers will refuse to execute the scripts if the content hash doesn't match the expected SHA-384 value.
3.  **CSS Refactor:** Extracted inline styles to `src/style.css` to separate concerns, although `style-src 'unsafe-inline'` is currently retained for dynamic DOM manipulation by libraries.

**Residual Risk:**
*   `style-src 'unsafe-inline'` remains enabled. While lower risk than script execution, it can theoretically be used for visual obfuscation or minor data exfiltration (CSS keylogging). This is a trade-off for using `CSS2DRenderer` and dynamic UI styling.
