# Nova Core Storefront

Nova Core now runs with a **real Python backend** and a **SQLite database** for products, admin updates, newsletter signups, contact requests, custom requests, and order tracking.

## Project structure

- `index.html` — storefront SPA
- `assets/styles.css` — site styling
- `assets/script.js` — frontend interactions and API calls
- `server.py` — backend server and REST API
- `data/novacore.db` — SQLite database created automatically on first run

## What is connected

- Product catalog loads from SQLite
- Admin add/edit/delete updates the database
- Newsletter signups are stored in the database
- Contact form submissions are stored in the database
- Custom order requests are stored in the database
- Order tracking reads from the database

## Run locally

```bash
cd /workspaces/try
python3 server.py
```

Then open:

- `http://127.0.0.1:8000`

## Demo access

- **Admin password:** `novacore2025`
- **Tracking demo:** `NC-123456` with `your@email.com`

> If you want, the next step can be swapping SQLite for PostgreSQL, Supabase, or Firebase.
