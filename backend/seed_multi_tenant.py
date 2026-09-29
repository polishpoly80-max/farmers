"""
Seed multi-tenant demo data: tenants + super/admin/customer accounts
Run: python backend/seed_multi_tenant.py  (from root) or python seed_multi_tenant.py (from backend)
"""
import sys
sys.path.insert(0, '.')
try:
    from db import user_collection, tenants_collection, inventory_collection, products_collection
    from utils import hash_password
except ImportError:
    from backend.db import user_collection, tenants_collection, inventory_collection, products_collection
    from backend.utils import hash_password

# Farm-branch profile: code, city, hours and delivery rules per location.
BRANCH_PROFILES = {
    "tenant-main": {
        "code": "MAIN",
        "city": "Countryside",
        "region": "CA",
        "postal_code": "95123",
        "latitude": 37.3230,
        "longitude": -121.9802,
        "delivery_fee": 9.99,
        "free_delivery_threshold": 50.0,
        "delivery_radius_km": 25,
        "opening_hours": "Daily 8AM–7PM • Pickup Sat 9AM–1PM",
        "is_accepting_orders": True,
    },
    "tenant-demo": {
        "code": "NORTH",
        "city": "Northfield",
        "region": "CA",
        "postal_code": "95124",
        "latitude": 37.4100,
        "longitude": -122.0500,
        "delivery_fee": 6.99,
        "free_delivery_threshold": 40.0,
        "delivery_radius_km": 18,
        "opening_hours": "Mon–Sat 9AM–6PM",
        "is_accepting_orders": True,
    },
    "tenant-south": {
        "code": "SOUTH",
        "city": "Southgate",
        "region": "CA",
        "postal_code": "95125",
        "latitude": 37.2400,
        "longitude": -121.9200,
        "delivery_fee": 12.99,
        "free_delivery_threshold": 75.0,
        "delivery_radius_km": 35,
        "opening_hours": "Tue–Sun 10AM–8PM",
        "is_accepting_orders": True,
    },
}

# Opening stock per branch, so each location starts with its own realistic levels.
BRANCH_STOCK_OVERRIDES = {
    "tenant-main": {},
    "tenant-demo": {"2": 0, "9": 4, "11": 6},
    "tenant-south": {"1": 40, "3": 8, "8": 0},
}

# The catalogue. The storefront keeps its own copy in localStorage, but the API
# (and therefore per-branch inventory) needs these documents in AstraDB.
CATALOGUE = [
    {"product_id": "1",  "name": "Farm Chicken",             "description": "Farm-raised broiler chicken, hormone-free and antibiotic-free.", "price": 12.99, "originalPrice": 15.99, "category": "Chicken", "stock_quantity": 150, "weight": "1.5-2 kg",  "badge": "BEST SELLER", "image": "/images/farm-chicken.jpg"},
    {"product_id": "2",  "name": "Farm Fresh Eggs",          "description": "Fresh eggs from free-range hens. Rich in omega-3 and vitamins.", "price": 6.99,  "category": "Eggs",    "stock_quantity": 0,   "weight": "30 pcs • 700g", "image": "/images/farm-eggs.jpg"},
    {"product_id": "3",  "name": "Farm Duck",                "description": "Fresh duck meat, ideal for roasting and festive meals.", "price": 28.99, "category": "Duck",    "stock_quantity": 30,  "weight": "2.5-3 kg",  "image": "/images/farm-duck.jpg"},
    {"product_id": "4",  "name": "Farm Turkey",              "description": "Premium whole turkey, perfect for holidays and family gatherings.", "price": 34.99, "originalPrice": 39.99, "category": "Turkey", "stock_quantity": 25, "weight": "5-7 kg",  "badge": "PREMIUM", "image": "/images/farm-turkey.jpg"},
    {"product_id": "5",  "name": "Chicken Wings (Pack)",     "description": "Fresh chicken wings, perfect for frying or baking. Party pack.", "price": 8.99,  "category": "Chicken", "stock_quantity": 200, "weight": "1 kg",      "image": "/images/chicken-wings.jpg"},
    {"product_id": "6",  "name": "Quail Eggs (30 pcs)",      "description": "Farm-fresh quail eggs, rich in protein and nutrients.", "price": 9.99,       "category": "Eggs",    "stock_quantity": 100, "weight": "30 pcs • 350g", "image": "/images/quail-eggs.jpg"},
    {"product_id": "7",  "name": "Chicken Breast (500g)",    "description": "Lean chicken breast, boneless and skinless. High protein.", "price": 7.99,     "category": "Chicken", "stock_quantity": 250, "weight": "500g",     "badge": "LEAN", "image": "/images/farm-chicken.jpg"},
    {"product_id": "8",  "name": "Organic Layer Hen",        "description": "Premium organic laying hens, certified organic feed.", "price": 24.99,      "category": "Chicken", "stock_quantity": 50,  "weight": "2-2.5 kg",  "badge": "PREMIUM", "image": "/images/organic-layer-hen.jpg"},
    {"product_id": "9",  "name": "Smoked Duck Breast",       "description": "Artisan smoked duck breast, ready to slice. 2 packs.", "price": 19.99,      "category": "Duck",    "stock_quantity": 40,  "weight": "600g",     "badge": "NEW", "image": "/images/smoked-duck-breast.jpg"},
    {"product_id": "10", "name": "Free-Range Whole Chicken", "description": "Whole free-range chicken, pasture raised, full flavour.", "price": 16.99,   "category": "Chicken", "stock_quantity": 80,  "weight": "1.8-2.2 kg", "image": "/images/free-range-chicken.jpg"},
    {"product_id": "11", "name": "Heritage Turkey Crown",    "description": "Turkey crown joint, easy to roast, serves 4-6.", "price": 29.99,          "category": "Turkey",  "stock_quantity": 18,  "weight": "3-4 kg",  "image": "/images/farm-turkey.jpg"},
    {"product_id": "12", "name": "Brown Farm Eggs (12)",     "description": "Brown eggs from pasture hens. Deep orange yolks.", "price": 4.49,           "category": "Eggs",    "stock_quantity": 300, "weight": "12 pcs • 700g", "badge": "VALUE", "image": "/images/brown-eggs-12.jpg"},
]


def seed_products():
    """Upsert the catalogue so the API and branch inventory have products to work with."""
    if products_collection is None:
        print("[seed] No products_collection - catalogue not seeded")
        return 0
    created = 0
    for item in CATALOGUE:
        if products_collection.find_one({"product_id": item["product_id"]}):
            continue
        doc = dict(item)
        from datetime import datetime
        doc["created_at"] = datetime.utcnow().isoformat()
        products_collection.insert_one(doc)
        created += 1
    print(f"[seed] Catalogue products created: {created} (total now {len(list(products_collection.find({})))})")
    return created

def ensure_tenant(tenant_id, name, slug, owner_email, phone, address):
    if tenants_collection is None:
        print("No tenants_collection")
        return None
    existing = tenants_collection.find_one({"tenant_id": tenant_id}) or tenants_collection.find_one({"slug": slug})
    profile = BRANCH_PROFILES.get(tenant_id, {})
    if existing:
        # Backfill the branch fields on tenants created before branching existed.
        updates = {k: v for k, v in profile.items() if existing.get(k) != v}
        if updates:
            tenants_collection.update_one({"tenant_id": existing.get("tenant_id")}, {"$set": updates})
            existing.update(updates)
            print(f"[seed] Updated branch profile: {name}")
        else:
            print(f"[seed] Tenant exists: {name} ({tenant_id})")
        return existing
    doc = {
        "tenant_id": tenant_id,
        "name": name,
        "slug": slug,
        "owner_email": owner_email,
        "phone": phone,
        "address": address,
        "status": "active",
        "settings": {"currency": "USD", "freeShippingThreshold": 50, "deliveryRadius": 50},
    }
    doc.update(profile)
    # add created_at
    from datetime import datetime
    doc["created_at"] = datetime.utcnow().isoformat()
    tenants_collection.insert_one(doc)
    print(f"[seed] Created branch: {name} ({tenant_id}) code={profile.get('code')}")
    return doc


def product_identifier(doc):
    """Stable public product id, matching backend/app.py::_product_identifier.

    Prefers the explicit `product_id` field so inventory keys line up with the
    ids the storefront uses ("1".."12"), not the Mongo ObjectId.
    """
    explicit = doc.get("product_id")
    return str(explicit) if explicit else str(doc.get("_id", ""))


def seed_branch_inventory(branch_id):
    """Give a branch an opening stock line for every product."""
    if inventory_collection is None or products_collection is None:
        print("[seed] inventory/products collection unavailable - skipping stock")
        return 0
    overrides = BRANCH_STOCK_OVERRIDES.get(branch_id, {})
    created = 0
    for p in products_collection.find({}):
        pid = product_identifier(p)
        if inventory_collection.find_one({"branch_id": branch_id, "product_id": pid}):
            continue
        from datetime import datetime
        inventory_collection.insert_one({
            "branch_id": branch_id,
            "product_id": pid,
            "name": p.get("name", ""),
            "category": p.get("category", ""),
            "image": p.get("image", ""),
            "price": p.get("price", 0),
            "stock_quantity": overrides.get(pid, p.get("stock_quantity", 0)),
            "low_stock_threshold": 10,
            "updated_at": datetime.utcnow().isoformat(),
        })
        created += 1
    print(f"[seed] Branch stock for {branch_id}: {created} line(s) added")
    return created

def ensure_user(email, full_name, password, role, tenant_id):
    if user_collection is None:
        print("No user_collection")
        return None
    existing = user_collection.find_one({"email": email})
    hashed = hash_password(password)
    if existing:
        # update role/tenant/password
        user_collection.update_one({"email": email}, {"$set": {
            "full_name": full_name,
            "name": full_name,
            "password": hashed,
            "role": role,
            "tenant_id": tenant_id,
            "is_active": True,
        }})
        print(f"[seed] Updated user: {email} role={role} tenant={tenant_id}")
        return user_collection.find_one({"email": email})
    doc = {
        "email": email,
        "full_name": full_name,
        "name": full_name,
        "phone": "+1 (555) 123-4567",
        "address": "123 Farm Road, Countryside, CA",
        "password": hashed,
        "role": role,
        "tenant_id": tenant_id,
        "is_active": True,
    }
    from datetime import datetime
    doc["created_at"] = datetime.utcnow().isoformat()
    result = user_collection.insert_one(doc)
    print(f"[seed] Created user: {email} role={role} tenant={tenant_id} id={result.inserted_id}")
    return doc

if __name__ == "__main__":
    print("Seeding multi-branch + multi-tenant demo data...")

    # Catalogue (needed before per-branch stock can reference product ids)
    seed_products()

    # Branch (tenant) records
    ensure_tenant("tenant-main", "Premium Poultry Main", "premium-poultry-main", "admin@premiumpoultry.com", "+1 (555) 123-4567", "123 Farm Road, Countryside, CA 95123")
    ensure_tenant("tenant-demo", "Demo Branch North", "demo-branch-north", "demo@premiumpoultry.com", "+1 (555) 987-6543", "456 North Farm Road, Countryside, CA 95124")
    ensure_tenant("tenant-south", "South Farm Outlet", "south-farm-outlet", "south@premiumpoultry.com", "+1 (555) 234-5678", "789 South Farm Road, Countryside, CA 95125")

    # Per-branch stock
    for branch in ("tenant-main", "tenant-demo", "tenant-south"):
        seed_branch_inventory(branch)

    # Users
    ensure_user("super@premiumpoultry.com", "Super Admin", "Super123!", "super_admin", None)
    ensure_user("admin@premiumpoultry.com", "Farm Admin", "Admin123!", "admin", "tenant-main")
    ensure_user("demo.admin@premiumpoultry.com", "Demo Admin", "Demo123!", "admin", "tenant-demo")
    ensure_user("worker@premiumpoultry.com", "Farm Worker", "Worker123!", "worker", "tenant-main")
    ensure_user("customer@premiumpoultry.com", "John Customer", "Customer123!", "customer", "tenant-main")

    print("\n=== Seeded ===")
    print("Branches:")
    for tid, profile in BRANCH_PROFILES.items():
        print(f"  {profile['code']:5} {tid:14} {profile['city']:12} fee=${profile['delivery_fee']} free>${profile['free_delivery_threshold']}")
    print("\nSuper Admin: super@premiumpoultry.com / Super123! -> /super")
    print("Admin Main: admin@premiumpoultry.com / Admin123! -> /admin")
    print("Admin Demo: demo.admin@premiumpoultry.com / Demo123! -> /admin (tenant-demo)")
    print("Worker Main: worker@premiumpoultry.com / Worker123! -> /admin (read-only staff)")
    print("Customer: customer@premiumpoultry.com / Customer123! -> /dashboard")
    print("All passwords are Argon2 hashed.")

    # show counts
    try:
        print(f"\nTenants: {len(list(tenants_collection.find({})))}")
        print(f"Users: {len(list(user_collection.find({})))}")
        if inventory_collection is not None:
            print(f"Inventory lines: {len(list(inventory_collection.find({})))}")
        for u in user_collection.find({}):
            print(f" - {u.get('email')} | {u.get('role')} | {u.get('tenant_id')} | {u.get('full_name')}")
    except Exception as e:
        print(f"Count failed: {e}")
