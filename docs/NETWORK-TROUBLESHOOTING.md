# Network compatibility

A browser error page showing ERR_QUIC_PROTOCOL_ERROR blocks application loading. This is independent of local GDS parsing and does not establish a file-size, GPU or server-capacity failure. The same error across several sites can involve the browser, proxy, network or HTTP/3 endpoint; the code alone does not identify which changed. Ordinary HTTP/1.1 and HTTP/2 responses should be checked first, as [Cloudflare's protocol troubleshooting](https://developers.cloudflare.com/speed/optimization/protocol/troubleshooting/protocol-troubleshooting/) recommends.

## Your Cloudflare domains

1. Sign in to the Cloudflare dashboard and select the domain, for example `aialra.online`
2. Open **Speed → Settings → Protocol Optimization**
3. Set **HTTP/3 (with QUIC)** to **Off**, keeping HTTPS and HTTP/2 enabled
4. Repeat for other separately managed domains; the setting covers all proxied subdomains in the selected zone, not the entire account
5. Fully close and reopen the browser. Existing alternative-service advertisements may remain cached; a browser-side QUIC disable can bypass that cached choice

This is a compatibility workaround for QUIC-specific failures, not a guarantee against unrelated outages. Cloudflare's [HTTP/3 documentation](https://developers.cloudflare.com/speed/optimization/protocol/http3/) describes the dashboard path and confirms the setting controls visitor-to-Cloudflare traffic. Origin Nginx headers cannot reliably undo Cloudflare's own Alt-Svc advertisement. DNS-only credentials do not authorize changing zone protocol settings.

For one affected hostname, Cloudflare also documents a targeted Response Header Modification Transform Rule: match `http.host eq "gds3d.aialra.online"` and remove `alt-svc`, preserving other sites' advertisements. Validate real response headers after a change; do not claim it applied merely because the origin configuration changed.

## Browser-side workaround

In Edge, open `edge://flags/#enable-quic`, set **Experimental QUIC protocol** to **Disabled**, then restart. This applies to that browser, including sites you do not control. An experimental flag may disappear or reset after updates/profile changes. For a persistently managed Edge installation, Microsoft's [QuicAllowed policy](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/QuicAllowed) supports disabling QUIC with DWORD `QuicAllowed=0` under `SOFTWARE\Policies\Microsoft\Edge`; changing browser policy is a separate local configuration action and is not performed by this project.

No layout upload, site-authentication change, weakened TLS, disabled firewall or DNS proxy removal is required for these protocol workarounds. Website JavaScript cannot fix a browser error that prevents that JavaScript from loading.
