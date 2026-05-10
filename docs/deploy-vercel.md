# Vercel Deployment

Vercel is a good fit for frontend-only React deployments. It is not a good fit for this full app as-is because the project uses:

- Express server
- SQLite database on disk
- uploaded files on disk
- server-side sessions stored in SQLite

Those need persistent storage and a long-running server, so a VPS is the safer production target for the full version.

## Frontend-Only Vercel

Use:

```env
VITE_BASE_PATH=/
```

Build command:

```bash
npm run build
```

Output directory:

```text
dist
```

## External API Requirement

The current frontend calls same-origin `/api` and `/uploads`. If the frontend is hosted on Vercel and the backend elsewhere, the app will need explicit API URL support or a Vercel rewrite to the external backend.

For the complete admin/API/uploads experience, deploy the full project on a VPS instead.

