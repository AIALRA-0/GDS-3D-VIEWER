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

## Read-only investigation on 2026-10-08

The supplied token verified as active. Reads of `aialra.online` settings, DNS and rulesets succeeded: HTTP/3 and HTTP/2 are on, and custom firewall/rate-limit rulesets contain no rules. Eight audit events returned for the queried period since October 1 concern DNS creation/deletion, with no returned HTTP/3-setting event. Settings have no modification timestamp, so this is not proof that protocols never changed or that Cloudflare caused the browser error.

Fresh local browser contexts with normal protocol defaults produced ERR_NETWORK_ACCESS_DENIED on the two online entries. Contexts launched with QUIC disabled returned 200 using HTTP/2. An independent server HTTP/2 read also returned 200 for the viewer and portal. These observations narrow the investigation but do not establish which local network/browser component blocked the default connections.

The separately managed `aialra.tech` root returned 525 through HTTP/2 from both locations. [Cloudflare error 525](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-525/) means the connection handshake between Cloudflare and its origin failed; it is a different failure from visitor-side QUIC negotiation. Its DNS and zone settings reads, including individual HTTP/3/SSL settings, returned 403. Zone-list visibility therefore does not provide all resource reads, and the origin/configuration cause cannot be established with this token. Read-only investigation makes no protocol, DNS, certificate, firewall or browser-policy changes and stores no token in this project. Follow-up requires the affected zone's settings/DNS read access and its origin handshake evidence; changing settings requires separately scoped edit access.

## Security when disabling HTTP/3

Disabling HTTP/3 alone does not disable HTTPS or certificate validation. Keep HTTPS, HTTP/2 and existing TLS/certificate settings enabled; Cloudflare's [HTTP/2 documentation](https://developers.cloudflare.com/speed/optimization/protocol/http2/) confirms encrypted HTTP/2 transport. The tradeoff is protocol performance on some networks, rather than sending unencrypted traffic. This compatibility change does not guarantee recovery from unrelated network/origin faults. The project has not changed Cloudflare settings; current owner action concerns aialra.online only.

## Access denied after HTTP/3 is disabled

`ERR_NETWORK_ACCESS_DENIED` differs from the earlier QUIC error. [Chromium's error definition](https://chromium.googlesource.com/chromium/src/+/HEAD/net/base/net_error_list.h) describes network permission denial, most likely firewall-related; it does not identify a specific blocking application. A Cloudflare HTTP rejection and a browser's local network denial are different evidence.

After the owner reported switching off HTTP/3, both online entry responses no longer advertised `Alt-Svc`. Twenty local Chromium loads (normal and QUIC-disabled contexts), twenty installed Edge loads in fresh isolated contexts, and sixteen independent server requests over HTTP/1.1/HTTP/2 all returned 200. One Edge initial load took about twelve seconds, so success does not imply consistently fast loading. This sample did not reproduce the owner's intermittent denial and cannot establish universal reliability or its root cause. The configuration API read failed, so a current settings value is not independently claimed; the header observations are actual response evidence. No Cloudflare, firewall, proxy, browser-policy or certificate setting was changed by this investigation.

During a recurrence, compare the same address in an InPrivate window and on a phone using mobile data. Success only in the fresh browser suggests profile/extension configuration; success only on mobile data narrows the problem to the original device/network path. These comparisons are diagnostic, not proof of one particular component. Capture a short Edge network log via `edge://net-export` using its default privacy setting, reproduce once and stop; keep the raw file local for review, as it can contain browsing/network details. Do not disable the firewall, antivirus or certificate validation as a blanket fix. Site JavaScript cannot repair a connection denied before it loads.

A later live run reproduced permission denial before application loading in two cases; both passed one isolated retry. A separate two-browser, fresh-context capture returned 200 on 23 of 24 navigations and recorded 24 denied IPv6 TCP attempts with Windows error `10013`, including attempts during otherwise successful fallback. [Microsoft defines 10013 as socket access permission denial](https://learn.microsoft.com/en-us/windows/win32/winsock/windows-sockets-error-codes-2). This locates those captured failures at the local connection-permission layer, before TLS/HTTP; it does not identify a particular blocking product or prove the owner's interactive Edge uses the same restriction. Read-only firewall inspection found rules scoped to specific local users, so diagnostic child processes and the interactive browser must be distinguished. Reading filtering-platform state required administrator access and was unavailable; no rule, adapter or IPv6 setting was changed. Raw network logs and device inventory remain local and are not published.
