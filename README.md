# Premium Poultry Farm - E-Commerce Website

A multi-branch poultry farm storefront: React 18 + Vite frontend, FastAPI backend,
AstraDB (Cassandra Data API) for storage.

Customers pick a farm branch, see that branch's live stock, and order from it.
Each branch manages its own inventory, delivery fees and opening hours. Staff
roles (worker / branch admin / super admin) see the admin dashboards.

## Project Structure

```
farmers/
├── backend/                    # FastAPI backend
│   ├── app.py                  # All HTTP routes
│   ├── auth.py                 # JWT + role guards + login rate limiting
│   ├── db.py                   # AstraDB client, collection bootstrap, health
│   ├── models.py               # Pydantic request/response models
│   ├── push.py                 # In-app notifications + Web Push delivery
│   ├── utils.py                # Argon2id password hashing
│   ├── seed_multi_tenant.py    # Demo data (branches, users, stock)
│   └── requirements.txt
│
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/         # Header, ProductCard, BranchSelector, ...
│   │   ├── context/            # Auth, Branch, Product, Notification, Cart
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/           # api.js (HTTP client), push.js (web push)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/                 # Images, icons, push-sw.js
│   └── vite.config.js
│
├── .env                        # Local secrets (git-ignored)
└── .env.example                # Template
```

## Quick Start

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
```

Create `.env` in the **project root** (not in `backend/`) and fill it in:

```bash
cp .env.example .env
```

| Variable | Required | Notes |
| --- | --- | --- |
| `ASTRA_DB_API_ENDPOINT` | yes | `https://<db-id>-<region>.apps.astra.datastax.com` |
| `ASTRA_DB_TOKEN` | yes | Scoped database token (`AstraCS:...`) |
| `ASTRA_DB_KEYSPACE` | yes | The keyspace must already exist - it is not created for you |
| `JWT_SECRET` | recommended | Falls back to a dev value if unset. **Set this in production.** |
| `JWT_EXPIRE_HOURS` | no | Defaults to `72` |
| `LOGIN_MAX_ATTEMPTS` | no | Failed sign-ins before lockout. Defaults to `10` |
| `LOGIN_LOCK_SECONDS` | no | Lockout duration. Defaults to `900` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | optional | Required only for web push |
| `CORS_ORIGINS` | **in production** | Your deployed site's origin(s), comma-separated |

Start the server:

```bash
cd backend
python -m uvicorn app:app --reload --port 8080
```

- API: http://localhost:8080
- Docs: http://localhost:8080/docs
- Health (includes database state): http://localhost:8080/health

The keyspace is **not** created automatically. Create it in the AstraDB console,
or with `astra create-keyspace <name>`. If it is missing the backend exits with a
clear message instead of appearing to have no data.

### 2. Seed demo data (optional)

```bash
python backend/seed_multi_tenant.py
```

Creates three branches, a 12-product catalogue, per-branch stock, and these accounts:

| Role | Email | Password | Lands on |
| --- | --- | --- | --- |
| Super admin | `super@premiumpoultry.com` | `Super123!` | `/super` |
| Branch admin | `admin@premiumpoultry.com` | `Admin123!` | `/admin` |
| Branch admin | `demo.admin@premiumpoultry.com` | `Demo123!` | `/admin` |
| Worker | `worker@premiumpoultry.com` | `Worker123!` | `/admin` (read-only) |
| Customer | `customer@premiumpoultry.com` | `Customer123!` | `/dashboard` |

The script is idempotent - re-running updates rather than duplicates. Passwords
are Argon2id hashed.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on http://localhost:7500, with `/api` proxied to `localhost:8080`.

## Deploying

Three settings must be right or a deployed site loads but cannot talk to the API.

**1. Rotate the AstraDB token** if you have not already, then set the new one plus
the others as environment variables in your host's dashboard (not a committed file):

```
ASTRA_DB_API_ENDPOINT, ASTRA_DB_TOKEN, ASTRA_DB_KEYSPACE
JWT_SECRET              # required in production; do not rely on the dev default
CORS_ORIGINS            # your site's origin(s), comma-separated
```

**2. `CORS_ORIGINS` must be your real domain.** The dev defaults are all
`localhost`; without this variable every request is blocked by the browser.
A `*` value is rejected deliberately, because the API sends credentials and
browsers refuse that combination.

**3. Build the frontend with an absolute API URL:**

```bash
cd frontend
VITE_API_URL=https://api.your-domain.com/api npm run build
```

The relative default `/api` only resolves through the Vite dev-server proxy,
which is not part of a built bundle. `npm run build` fails with an explanatory
error if this is still relative, so a broken build cannot ship unnoticed. If your
host serves the API on the same origin behind nginx or a platform proxy, set
`VITE_ALLOW_RELATIVE_API=true` instead.

Also note the backend exits immediately if the AstraDB keyspace does not exist,
so create it before the first deploy.

## Architecture Notes

**Branches are tenants.** A branch document lives in the `tenants` collection, so
the existing role model (a staff account belongs to a tenant) keeps working. The
branch-specific fields (`code`, `city`, `latitude`, `delivery_fee`,
`free_delivery_threshold`, `opening_hours`, ...) describe the physical location.

**Per-branch stock** lives in `inventory`, keyed by `(branch_id, product_id)`.
The `products` collection holds only the shared catalogue (name, price, images).
Selecting a branch overlays its stock on the catalogue in `ProductContext`.

**Prices and discounts are computed server-side.** `POST /api/orders/` re-reads
each product's price from the catalogue and applies its own promo table, ignoring
the prices and `promo_discount` in the request. Those are treated as display hints
from the cart, not billing inputs.

**Stock decrements are conditional.** The decrement only applies if the stock is
still there, so two orders racing for the last unit cannot both succeed. A line
that loses the race rolls back the earlier lines and the order is withdrawn.

**AstraDB hibernation is handled explicitly.** Free-tier databases sleep when
idle. `db_status()` classifies the database as connected / waking / unavailable,
an exception handler turns a resume error into a `503` with `code: "db_waking"`,
and the frontend keeps the user signed in during a brief outage instead of
treating it as an auth failure.

**Notifications are two layers.** `push.py` always writes an in-app document to
`notifications` (rendered by the header bell, survives reloads) and additionally
delivers Web Push when a VAPID key is configured. Web push is optional: if
`pywebpush` or the keys are missing, in-app delivery still works.

**The cart is client-side only.** It lives in `localStorage` and is turned into an
order by `POST /api/orders/`. There is no `/api/cart` backend.

## Roles

| Role | Scope | Can do |
| --- | --- | --- |
| `customer` | Own branch | Browse, order, care chat |
| `worker` | Own branch | Read admin dashboard, update order status, care chat |
| `admin` | Own branch | Everything above + stock, branch settings, broadcasts, staff roles |
| `super_admin` | All branches | All of the above across every branch, + create/delete branches |

Branch staff cannot read or modify another branch's data; the check is repeated
on every mutating route rather than trusted from the UI.

## API Endpoints

All paths are prefixed with `/api`.

### Auth & users
- `POST /api/users/register` - Register (public signup always creates a customer)
- `POST /api/users/login` - Login (rate limited)
- `GET /api/users/me` - Current profile
- `PUT /api/users/me` - Update profile
- `GET /api/users/` - List users (staff only, branch-scoped)
- `PUT /api/users/{user_id}/role` - Change role (admin/super only)

### Branches
- `GET /api/branches/` - Public list, with stock totals
- `GET /api/branches/mine` - The caller's selected branch
- `GET /api/branches/{id}` - Branch detail
- `GET /api/branches/{id}/inventory` - Stock levels
- `PUT /api/branches/{id}/inventory/{product_id}` - Set stock (admin)
- `PUT /api/branches/{id}/settings` - Update location/hours/delivery (admin)
- `POST /api/branches/select` - Remember the chosen branch

### Products
- `GET /api/products/` - Catalogue (`?category=`, `?branch_id=`)
- `GET /api/products/{id}` - Product detail

### Orders
- `POST /api/orders/` - Place an order
- `GET /api/orders/` - Own orders, or the branch's orders for staff
- `GET /api/orders/{id}` - Order detail
- `PUT /api/orders/{id}/status` - Update status (staff)

### Notifications
- `GET /api/notifications/` - Inbox (newest first)
- `GET /api/notifications/unread-count` - Badge count
- `POST /api/notifications/{id}/read` - Mark read
- `POST /api/notifications/read-all` - Mark all read
- `POST /api/notifications/broadcast` - Admin announcement
- `GET /api/notifications/vapid-public-key` - Web push public key
- `POST /api/notifications/subscribe` / `unsubscribe` - Manage web push
- `POST /api/notifications/test` - Send a test notification

### Customer care
- `POST /api/care/sessions` - Open a support request
- `GET /api/care/sessions` - Own conversations, or the branch queue for staff
- `GET /api/care/sessions/{id}` - Session with message thread
- `POST /api/care/sessions/{id}/messages` - Send a message
- `PUT /api/care/sessions/{id}/read` - Clear the unread badge
- `PUT /api/care/sessions/{id}/status` - Accept / resolve (staff)
- `GET /api/care/unread-count` - Badge count

### Admin
- `GET /api/admin/stats`, `GET /api/admin/users`
- `GET /api/super/stats`, `GET /api/super/users`, `GET /api/super/tenants`
- `GET|POST|PUT|DELETE /api/tenants/` - Branch (tenant) CRUD, super admin

## Not Implemented

Being explicit so these are not mistaken for working features:

- **Payments are simulated.** `Checkout.jsx` collects card number / expiry / CVV
  and discards them; only the card's length is validated. No gateway is
  integrated, so orders are recorded with `payment_status: "pending"`. Card
  fields must not be trusted or stored once a real gateway is added - they
  should be tokenised by the provider and never touch this server.
- **The catalogue is duplicated** between `ProductContext.jsx` and
  `CATALOGUE` in `seed_multi_tenant.py`. The storefront reads its own copy from
  `localStorage`; the API copy is used for stock and pricing. Adding a product
  means editing both, and only inventory/price changes come from the server.
- **Login rate limiting is per-process and in-memory.** Correct for a single API
  process; behind multiple workers each keeps its own counter, so a shared store
  (Redis) is needed if this is scaled horizontally.
- **List endpoints are capped, not paged.** Reads are limited to 200 documents
  rather than supporting cursor pagination.
- **No email.** Checkout shows a confirmation message but nothing is sent.

## Tech Stack

**Backend:** Python 3.9+, FastAPI, Uvicorn, AstraDB (`astrapy`), Pydantic,
`python-jose` (JWT), `argon2-cffi` (Argon2id), `pywebpush`.

**Frontend:** React 18, Vite 6, React Router 6, `react-icons`, `react-toastify`.
No UI framework - styling is plain CSS.

## License

MIT
