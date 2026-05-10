# GitHub Pages Deployment

GitHub Pages can serve only the static frontend. It cannot run Express, SQLite, uploads, server-side sessions or the admin API.

Use GitHub Pages only when you want a static public site. For the full site with admin panel and applications, use a VPS or another backend host.

## Environment

For this repository path:

```env
VITE_BASE_PATH=/igu-vite/
```

Use `.env.github-pages.example` as the template.

## Build

```bash
npm ci
VITE_BASE_PATH=/igu-vite/ npm run build
```

The static output is in:

```text
dist/
```

## Deploy Script

The project includes:

```bash
npm run deploy
```

It runs `npm run build && gh-pages -d dist`. Make sure `VITE_BASE_PATH=/igu-vite/` is present in the environment before running it.

## Important Limitations

On GitHub Pages:

- `/api/*` will not work.
- `/uploads/*` from the Express server will not work.
- Admin login will not work.
- SQLite applications will not work.

For a production college site with content editing and applications, prefer VPS deployment.

