# Deployment Notes

## Target

- domain: `icviewer.aialra.online`
- reverse proxy: Nginx
- deploy root: `/srv/icviewer`
- backend service: `icviewer.service`
- backend bind: `127.0.0.1:34000`

## Runtime Shape

1. Sync the repository into `/srv/icviewer`.
2. Build the Vite frontend into `/srv/icviewer/apps/web/dist`.
3. Run the FastAPI backend from `/srv/icviewer/apps/api/.venv`.
4. Serve the frontend from Nginx and proxy `/api`, `/assets`, and `/health`.
5. Keep Cloudflare proxied in front of the origin.

## Files

- Nginx site: `scripts/nginx/icviewer.conf`
- systemd unit: `scripts/systemd/icviewer.service`
- deploy helper: `scripts/deploy.sh`
- smoke helper: `scripts/smoke.sh`

## Live Cutover

```bash
chmod +x scripts/deploy.sh scripts/smoke.sh
sudo ./scripts/deploy.sh
./scripts/smoke.sh https://icviewer.aialra.online
```

## Rollback

`deploy.sh` keeps a timestamped backup of the previous Nginx site config at:

- `/etc/nginx/sites-available/icviewer.aialra.online.bak.<timestamp>`

To roll back quickly:

1. Restore the previous backup to `/etc/nginx/sites-available/icviewer.aialra.online`.
2. Run `nginx -t`.
3. Run `sudo systemctl reload nginx`.
