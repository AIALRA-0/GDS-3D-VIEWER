# ICViewer Deployment Notes

## 1 Template boundary

This repository publishes a deployment template, not the address or filesystem layout of a live environment
Replace every example domain and path before deployment

| Setting | Safe default | Operator action |
| --- | --- | --- |
| Domain | `icviewer.example.com` | Edit the Nginx template and set `SITE_NAME` to the same authorized domain |
| Reverse proxy | Nginx | Review TLS, upload size, caching, and proxy headers |
| Deploy root | `/opt/icviewer` | Edit the Nginx and systemd templates and set `DEPLOY_ROOT` consistently when the root differs |
| Backend service | `icviewer.service` | Review the service account and filesystem permissions |
| Backend bind | `127.0.0.1:34000` | Keep private or replace consistently across templates |

## 2 Runtime shape

1. Sync the repository into the configured deploy root
2. Build the Vite frontend into `apps/web/dist` under that root
3. Run the FastAPI backend from the isolated virtual environment
4. Serve the frontend through Nginx and proxy `/api`, `/review-assets`, and `/health`
5. Put a separately managed TLS and edge layer in front of the origin when required

## 3 Template files

- `scripts/nginx/icviewer.conf` contains an example domain and certificate path
- `scripts/systemd/icviewer.service` contains an example install root and service account
- `scripts/deploy.sh` builds, installs, restarts, and checks the service
- `scripts/smoke.sh` runs local or explicitly supplied endpoint checks

## 4 Deployment sequence

Review every template before using elevated privileges
`SITE_NAME` controls the installed Nginx filename and smoke target, while `DEPLOY_ROOT` controls repository synchronization
If either value differs from the checked-in example, update the Nginx and systemd template contents to match before running the helper
The checked-in systemd example uses `User=root`; production operators should create a restricted service account and update file ownership first

```bash
chmod +x scripts/deploy.sh scripts/smoke.sh # Allow the checked-in helper scripts to run
export SITE_NAME="icviewer.example.com" # Replace the example with an authorized domain
export DEPLOY_ROOT="/opt/icviewer" # Replace the example when the installation root differs
sudo -E ./scripts/deploy.sh # Preserve the reviewed environment values during installation
./scripts/smoke.sh "https://${SITE_NAME}" # Verify the operator-supplied endpoint without publishing it
```

## 5 Rollback

`deploy.sh` keeps a timestamped backup of the previous Nginx site configuration at `/etc/nginx/sites-available/<site-name>.bak.<timestamp>`

1. Restore the previous backup to `/etc/nginx/sites-available/<site-name>`
2. Run `nginx -t`
3. Run `sudo systemctl reload nginx`

Before sharing deployment logs, remove domains, origin addresses, certificate paths, account names, request headers, tokens, and absolute user paths
