# Backup Guide

This project stores runtime data in SQLite and user uploads on disk. Backups are intentionally local and simple so they work on a regular VPS without extra services.

## Manual Backup

Run from the project root:

```bash
npm run backup
```

Backups are created in:

```text
backups/
  YYYY-MM-DD_HH-mm-ss/
    database.sqlite
    uploads/
```

Real backup folders are ignored by Git. Only `backups/.gitkeep` is committed.

## Restore SQLite

Stop the app first, then replace the active database:

```bash
cp backups/YYYY-MM-DD_HH-mm-ss/database.sqlite server/data/igu.sqlite
```

Start the app again after the copy finishes.

## Restore Uploads

Stop the app first, then restore uploads:

```bash
rm -rf server/uploads
cp -R backups/YYYY-MM-DD_HH-mm-ss/uploads server/uploads
```

If a backup has no `uploads/` folder, it means uploads did not exist at backup time.

## Cron Example

Edit the crontab for the deploy user:

```bash
crontab -e
```

Run backup every day at 03:00:

```bash
0 3 * * * cd /path/to/project && npm run backup >> logs/backup.log 2>&1
```

## Systemd Timer Example

`/etc/systemd/system/igu-backup.service`:

```ini
[Unit]
Description=IGU site backup

[Service]
Type=oneshot
WorkingDirectory=/path/to/project
ExecStart=/usr/bin/npm run backup
User=www-data
Group=www-data
```

`/etc/systemd/system/igu-backup.timer`:

```ini
[Unit]
Description=Run IGU site backup daily

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable the timer:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now igu-backup.timer
sudo systemctl list-timers igu-backup.timer
```
