# Deployment Notes

## Target

- domain: `icviewer.aialra.online`
- reverse proxy: Nginx
- app port: `34000`

## Recommended Runtime Shape

1. Run the FastAPI backend on `127.0.0.1:34000`.
2. Serve the frontend build through Nginx.
3. Reverse proxy `/api` and `/assets` to the backend.
4. Keep Cloudflare proxied in front of the origin.

## Nginx Outline

An example config is committed at `scripts/nginx/icviewer.conf`.

## Deployment Checklist

- install backend dependencies in a virtual environment
- build the frontend
- copy the frontend `dist` directory to the Nginx-served path
- restart the backend process
- reload Nginx
- verify `https://icviewer.aialra.online/health`
