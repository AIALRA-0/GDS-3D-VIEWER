# Public preview recurrence notes

- The original API has no tenant authentication or production file isolation. Keep it local; public builds must not include or proxy it. Verify POST requests and `/api`, `/review-assets`, `/reference-viewer` and `/legacy.html` are refused at the public origin
- Imported glTF can contain resource URLs. Public parsing must never use the legacy loader on untrusted documents; reject external buffers and all images before geometry conversion. Regress with public URLs, loopback URLs, file URLs and image data URLs
- Flattening a small GDS file can create enormous geometry. Enforce instance, polygon, triangle and depth limits during expansion. A limited design opens the cell directory and never presents partial geometry as complete
- An old canvas's deliberate context shutdown can produce a late context-loss event. Remove old listeners before disposal so replacing a scene does not place an error over the new scene
- A cancelled or replaced import must not overwrite a later file. Invalidate request generations and terminate parser tasks; regression covers a delayed sample fetch followed by a new local import
- Keep template archives, credentials, raw verification traces, local API data and legacy bundles out of the deployment. Check the actual built file list and transferred archive, not only the source ignore rules
