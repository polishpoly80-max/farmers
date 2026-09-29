from astrapy import DataAPIClient
from astrapy.api_options import APIOptions, TimeoutOptions
import os
import sys
import time
from pathlib import Path

# Load the same .env the FastAPI app uses, so `db.py` also works when imported
# on its own (seed scripts, tests, `python -c "from db import ..."`).
try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except Exception:  # pragma: no cover - dotenv is optional at runtime
    pass

# --- AstraDB config ---
# No hardcoded credentials: every value must come from the environment. A
# missing token or keyspace is a configuration error, not something to paper
# over with a guess that silently returns empty collections later on.
ASTRA_DB_API_ENDPOINT = os.getenv("ASTRA_DB_API_ENDPOINT")
ASTRA_DB_TOKEN = os.getenv("ASTRA_DB_TOKEN")
ASTRA_DB_KEYSPACE = os.getenv("ASTRA_DB_KEYSPACE")

_MISSING = [
    name
    for name, value in (
        ("ASTRA_DB_API_ENDPOINT", ASTRA_DB_API_ENDPOINT),
        ("ASTRA_DB_TOKEN", ASTRA_DB_TOKEN),
        ("ASTRA_DB_KEYSPACE", ASTRA_DB_KEYSPACE),
    )
    if not value
]

if _MISSING:
    print(
        "[DB] FATAL: missing required AstraDB config: "
        + ", ".join(_MISSING)
        + "\n[DB] Add them to your .env file, for example:\n"
        "[DB]   ASTRA_DB_API_ENDPOINT=https://<db-id>-<region>.apps.astra.datastax.com\n"
        "[DB]   ASTRA_DB_TOKEN=AstraCS:...\n"
        "[DB]   ASTRA_DB_KEYSPACE=<your keyspace name>\n"
        "[DB] The keyspace is NOT created automatically - check the AstraDB console.",
        file=sys.stderr,
    )
    raise RuntimeError(
        "AstraDB is not configured: missing " + ", ".join(_MISSING)
    )

# AstraDB round-trips are slow from a normal home/office connection and the
# library's 10s default is not enough; every list/count query then fails
# halfway with a handshake timeout and the API returns 500. Make the timeout
# explicit and generous, and let requests reuse the TLS connection.
API_TIMEOUT_SECONDS = int(os.getenv("ASTRA_DB_TIMEOUT_SECONDS", "45") or 45)

client = DataAPIClient(token=ASTRA_DB_TOKEN)
try:
    db = client.get_database(
        ASTRA_DB_API_ENDPOINT,
        token=ASTRA_DB_TOKEN,
        keyspace=ASTRA_DB_KEYSPACE,
        spawn_api_options=APIOptions(
            timeout_options=TimeoutOptions(
                request_timeout_ms=API_TIMEOUT_SECONDS * 1000,
                general_method_timeout_ms=API_TIMEOUT_SECONDS * 1000,
            ),
        ),
    )
except Exception as e:
    print(f"[DB] FATAL: could not open database {ASTRA_DB_API_ENDPOINT}: {e}", file=sys.stderr)
    raise

# Verify the keyspace before any request relies on it. A missing keyspace
# otherwise surfaces much later as an empty users collection, which looks like
# "no accounts exist" instead of "the database is misconfigured".
# Only a definite "unknown keyspace" is fatal: a timeout or a database still
# resuming is transient, and hard-failing there would take the whole API down
# for a condition that clears on its own.
def _probe_keyspace() -> None:
    last_error = None
    for attempt in range(4):
        try:
            db.list_collection_names()
            return
        except Exception as e:
            last_error = e
            text = str(e).lower()
            if "unknown_keyspace" in text or "keyspace does not exist" in text:
                print(
                    f"[DB] FATAL: keyspace '{ASTRA_DB_KEYSPACE}' does not exist.\n"
                    f"[DB] Create it in the AstraDB console, or set "
                    f"ASTRA_DB_KEYSPACE in .env to an existing keyspace.",
                    file=sys.stderr,
                )
                raise
            if "hibernation" in text or "resuming" in text:
                print(f"[DB] database is resuming from hibernation (attempt {attempt + 1}/4)...")
            else:
                print(f"[DB] keyspace probe attempt {attempt + 1}/4 failed: {e}")
            time.sleep(5)
    print(
        f"[DB] FATAL: could not reach keyspace '{ASTRA_DB_KEYSPACE}': {last_error}\n"
        f"[DB] Check network access to {ASTRA_DB_API_ENDPOINT} and that the "
        f"token grants access to this keyspace.",
        file=sys.stderr,
    )
    raise last_error


_probe_keyspace()

def _get_or_create_collection(name: str):
    if db is None:
        return None
    # Try list first - most reliable to know existence
    try:
        existing = db.list_collection_names()
        if name in existing:
            print(f"[DB] Collection {name} exists, getting")
            return db.get_collection(name)
        print(f"[DB] Collection {name} not in {existing}, creating...")
        try:
            c = db.create_collection(name)
            print(f"[DB] Created collection {name}")
            return c
        except Exception as e:
            # if creation fails because already exists due to race, get it
            if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                return db.get_collection(name)
            print(f"[DB] create {name} failed: {e}, trying get")
            return db.get_collection(name)
    except Exception as e:
        print(f"[DB] list failed for {name}: {e}, trying get/create fallback")
        # fallback: try get, then create
        try:
            return db.get_collection(name)
        except Exception:
            try:
                return db.create_collection(name)
            except Exception as e2:
                print(f"[DB] get/create fallback failed for {name}: {e2}")
                return None

# Core collections
user_collection = _get_or_create_collection("users")
tenants_collection = _get_or_create_collection("tenants")
products_collection = _get_or_create_collection("products")
orders_collection = _get_or_create_collection("orders")

# Branch-aware inventory: one document per (branch_id, product_id) so each farm
# branch tracks its own stock instead of sharing a single pool.
inventory_collection = _get_or_create_collection("inventory")

# In-app notification centre (persists in AstraDB, survives page reloads)
notifications_collection = _get_or_create_collection("notifications")

# Web Push subscriptions (one per browser/device per user)
push_subscriptions_collection = _get_or_create_collection("push_subscriptions")

# Users' preferred farm branch (one document per user)
user_preferences_collection = _get_or_create_collection("user_preferences")

# Customer-care live chat sessions (one document per support request/conversation)
care_sessions_collection = _get_or_create_collection("care_sessions")

# --- Health / hibernation handling ---------------------------------------
# AstraDB free-tier databases sleep after a period of inactivity and answer
# requests with HTTP 400 + "resuming from hibernation" for a few minutes while
# they boot. That is expected, not a bug, so it gets its own state and message
# instead of surfacing as a generic 500 to the frontend.

DB_WAKING_MESSAGE = (
    "Database is waking up from hibernation. Please retry in a few moments."
)


def db_status() -> dict:
    """Probe the database and classify it as connected / waking / unavailable."""
    if db is None:
        return {"state": "unavailable", "detail": "Database client not initialised"}
    try:
        db.list_collection_names()
        return {"state": "connected", "detail": ""}
    except Exception as exc:
        text = str(exc).lower()
        if "hibernation" in text or "resuming" in text:
            return {"state": "waking", "detail": DB_WAKING_MESSAGE}
        return {"state": "unavailable", "detail": str(exc)}


def is_db_waking(exc: Exception) -> bool:
    """True when an Astra exception is just the database booting."""
    text = str(exc).lower()
    return "hibernation" in text or "resuming" in text


if db is not None:
    try:
        print(f"[DB] Collections ready: users={user_collection is not None}, tenants={tenants_collection is not None}, products={products_collection is not None}, orders={orders_collection is not None}")
        try:
            names = db.list_collection_names()
            print(f"[DB] All collections: {names}")
        except Exception as e:
            print(f"[DB] list final failed: {e}")
    except Exception as e:
        print(f"[DB] diagnostics failed: {e}")
else:
    print("[DB] db is None - all collections None")

# --- Optional helper to migrate legacy plain passwords to argon2 (run manually) ---
def migrate_plain_passwords_to_argon2():
    if user_collection is None:
        print("No DB connection")
        return
    try:
        from utils import hash_password
    except ImportError:
        from backend.utils import hash_password
    count = 0
    for doc in user_collection.find({}):
        pwd = doc.get("password", "")
        if pwd and not pwd.startswith("$argon2"):
            try:
                new_hash = hash_password(pwd)
                user_collection.update_one({"_id": doc["_id"]}, {"$set": {"password": new_hash}})
                count += 1
            except Exception as ex:
                print(f"Failed to migrate {doc.get('email')}: {ex}")
    print(f"Migrated {count} passwords to Argon2")

def seed_default_tenant():
    if tenants_collection is None or db is None:
        return None
    try:
        # check if any exists via find (may fail if collection not yet created)
        try:
            existing = list(tenants_collection.find({}))
            if existing:
                print(f"[DB] Tenant already exists: {existing[0].get('name')}")
                return existing[0]
        except Exception as e:
            # collection may not exist yet, will be created via insert
            print(f"[DB] find tenants failed (likely not yet created): {e}")
            # try create collection explicitly then retry
            try:
                db.create_collection("tenants")
                tenants_collection_new = db.get_collection("tenants")
                # reassign global
                import sys
                globals()['tenants_collection'] = tenants_collection_new
            except Exception as ce:
                print(f"[DB] create tenants retry failed: {ce}")
                pass
            # try again with new collection
            try:
                existing = list(globals()['tenants_collection'].find({}))
                if existing:
                    return existing[0]
            except Exception:
                pass

        default = {
            "tenant_id": "tenant-main",
            "name": "Premium Poultry Main",
            "slug": "premium-poultry-main",
            "owner_email": "admin@premiumpoultry.com",
            "phone": "+1 (555) 123-4567",
            "address": "123 Farm Road, Countryside, CA 95123",
            "status": "active",
            "settings": {"currency": "USD", "freeShippingThreshold": 50, "deliveryRadius": 50},
        }
        try:
            tenants_coll = globals().get('tenants_collection') or tenants_collection
            tenants_coll.insert_one(default)
            print("[DB] Seeded default tenant: Premium Poultry Main")
        except Exception as e:
            print(f"[DB] seed insert failed: {e}")
        return default
    except Exception as e:
        print(f"[DB] seed tenant failed: {e}")
        return None

try:
    seed_default_tenant()
except Exception:
    pass
