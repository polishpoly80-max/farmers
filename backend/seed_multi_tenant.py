"""
Seed multi-tenant demo data: tenants + super/admin/customer accounts
Run: python backend/seed_multi_tenant.py  (from root) or python seed_multi_tenant.py (from backend)
"""
import sys
sys.path.insert(0, '.')
try:
    from db import user_collection, tenants_collection
    from utils import hash_password
    from auth import create_access_token
except ImportError:
    from backend.db import user_collection, tenants_collection
    from backend.utils import hash_password
    from backend.auth import create_access_token

def ensure_tenant(tenant_id, name, slug, owner_email, phone, address):
    if tenants_collection is None:
        print("No tenants_collection")
        return None
    existing = tenants_collection.find_one({"tenant_id": tenant_id}) or tenants_collection.find_one({"slug": slug})
    if existing:
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
    # add created_at
    from datetime import datetime
    doc["created_at"] = datetime.utcnow().isoformat()
    tenants_collection.insert_one(doc)
    print(f"[seed] Created tenant: {name} ({tenant_id})")
    return doc

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
    print("Seeding multi-tenant demo data...")

    # Tenants
    ensure_tenant("tenant-main", "Premium Poultry Main", "premium-poultry-main", "admin@premiumpoultry.com", "+1 (555) 123-4567", "123 Farm Road, Countryside, CA 95123")
    ensure_tenant("tenant-demo", "Demo Branch North", "demo-branch-north", "demo@premiumpoultry.com", "+1 (555) 987-6543", "456 North Farm Road, Countryside, CA 95124")
    ensure_tenant("tenant-south", "South Farm Outlet", "south-farm-outlet", "south@premiumpoultry.com", "+1 (555) 234-5678", "789 South Farm Road, Countryside, CA 95125")

    # Users
    ensure_user("super@premiumpoultry.com", "Super Admin", "Super123!", "super_admin", None)
    ensure_user("admin@premiumpoultry.com", "Farm Admin", "Admin123!", "admin", "tenant-main")
    ensure_user("demo.admin@premiumpoultry.com", "Demo Admin", "Demo123!", "admin", "tenant-demo")
    ensure_user("customer@premiumpoultry.com", "John Customer", "Customer123!", "customer", "tenant-main")

    print("\n=== Seeded ===")
    print("Super Admin: super@premiumpoultry.com / Super123! -> /super")
    print("Admin Main: admin@premiumpoultry.com / Admin123! -> /admin")
    print("Admin Demo: demo.admin@premiumpoultry.com / Demo123! -> /admin (tenant-demo)")
    print("Customer: customer@premiumpoultry.com / Customer123! -> /dashboard")
    print("All passwords are Argon2 hashed.")

    # show counts
    try:
        print(f"\nTenants: {len(list(tenants_collection.find({})))}")
        print(f"Users: {len(list(user_collection.find({})))}")
        for u in user_collection.find({}):
            print(f" - {u.get('email')} | {u.get('role')} | {u.get('tenant_id')} | {u.get('full_name')}")
    except Exception as e:
        print(f"Count failed: {e}")
