# Velora Store v3 — Render Deployable

This version is prepared for Render with PostgreSQL instead of local SQLite.

## Deploy with Render Blueprint

1. Put this project in a GitHub repository.
2. In Render, choose **New → Blueprint** and connect the repository.
3. Render reads `render.yaml` and creates:
   - `velora-store` (Node/Express web service)
   - `velora-db` (PostgreSQL)
4. `JWT_SECRET` is generated automatically.
5. `DATABASE_URL` is connected automatically to the web service.
6. After deployment, open the generated `onrender.com` URL.

## Local setup

```bash
npm install
```

Create `.env`:

```env
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
JWT_SECRET=use-a-long-random-secret
```

Then:

```bash
npm start
```

## Important

Render currently offers Free web services and Free PostgreSQL, but Free web services spin down after 15 minutes of inactivity. Free PostgreSQL is limited to 1 GB and expires after 30 days, with a 14-day grace period to upgrade before deletion. This makes the free setup suitable for testing/hobby use, not permanent production storage.

The store's payment gateway and product fulfillment are not connected yet. Orders created through the API are recorded as `pending`.
Only connect products/services that you are authorized to sell and that comply with the relevant provider/platform terms.
