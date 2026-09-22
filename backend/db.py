from astrapy import DataAPIClient
import os

# --- AstraDB config ---
ASTRA_DB_API_ENDPOINT = os.getenv(
    "ASTRA_DB_API_ENDPOINT",
    "https://2386b19b-2aa3-4859-9dd9-0a7fc5d8ab58-us-east-2.apps.astra.datastax.com",
)
ASTRA_DB_TOKEN = os.getenv(
    "ASTRA_DB_TOKEN",
    "AstraCS:REDACTED",
)

client = DataAPIClient(token=ASTRA_DB_TOKEN)
try:
    db = client.get_database(ASTRA_DB_API_ENDPOINT, token=ASTRA_DB_TOKEN)
except Exception as e:
    print(f"[DB] Failed to get database: {e}")
    db = None

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
