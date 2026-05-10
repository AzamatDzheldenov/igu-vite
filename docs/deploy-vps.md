# VPS Deployment

Use a VPS for the full version of the site: React frontend, Express API, SQLite, uploads, server-side sessions, admin panel and backups.

## 1. Install Node.js

Install Node.js 22 LTS or newer through your distro packages, NodeSource, `nvm`, or another approved server method.

Check:

```bash
node --version
npm --version
```

## 2. Prepare Project

```bash
cd /var/www
git clone <repo-url> igu-site
cd igu-site
npm ci
```

## 3. Configure Environment

```bash
cp .env.vps.example .env
nano .env
```

For a root-domain VPS deployment use:

```env
NODE_ENV=production
VITE_BASE_PATH=/
PORT=3000
DB_PATH=server/data/igu.sqlite
PUBLIC_SITE_ORIGIN=https://your-domain.example
ALLOWED_ORIGINS=https://your-domain.example
```

Set strong `ADMIN_PASSWORD` and `SMM_PASSWORD` only for first bootstrap, then rotate/remove bootstrap credentials after accounts exist.

## 4. Build and Start

```bash
npm run build
npm start
```

The app serves the built frontend and API from the same Express server in production.

## 5. PM2 Option

```bash
npm install -g pm2
pm2 start npm --name igu-site -- start
pm2 save
pm2 startup
```

Logs:

```bash
pm2 logs igu-site
```

## 6. Systemd Option

`/etc/systemd/system/igu-site.service`:

```ini
[Unit]
Description=IGU college site
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/igu-site
EnvironmentFile=/var/www/igu-site/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

Enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now igu-site
sudo systemctl status igu-site
```

## 7. Nginx Reverse Proxy

Example:

```nginx
server {
    server_name your-domain.example;

    client_max_body_size 60m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 8. HTTPS With Certbot

```bash
sudo certbot --nginx -d your-domain.example
```

Then update `.env`:

```env
PUBLIC_SITE_ORIGIN=https://your-domain.example
ALLOWED_ORIGINS=https://your-domain.example
```

Restart the app.

## 9. Runtime Data

Important paths:

```text
server/data/       SQLite database and WAL files
server/uploads/    uploaded files
backups/           timestamped backups
logs/              optional file logs and backup logs
```

Do not deploy by deleting these folders.

## 10. Backups

Manual:

```bash
npm run backup
```

Cron:

```bash
0 3 * * * cd /var/www/igu-site && npm run backup >> logs/backup.log 2>&1
```

See `docs/backup.md` for systemd timer examples.

## 11. Update After Git Pull

```bash
cd /var/www/igu-site
git pull
npm ci
npm run build
npm run check:prod
sudo systemctl restart igu-site
```

If using PM2:

```bash
pm2 restart igu-site
```

## 12. Rollback Plan

1. Keep the previous Git commit hash before update.
2. Run `npm run backup` before deployment.
3. If deployment fails:

```bash
git checkout <previous-commit>
npm ci
npm run build
sudo systemctl restart igu-site
```

4. If data was corrupted, stop the app and restore `server/data/igu.sqlite` and `server/uploads/` from the latest backup.

