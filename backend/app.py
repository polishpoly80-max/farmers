from fastapi import FastAPI, status, APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import re
import uuid
from datetime import datetime

# --- robust imports (work both as `uvicorn app:app` inside backend/ and `uvicorn backend.app:app` from root) ---
try:
    from models import User, UserLogin, Tenant, TenantCreate, TenantUpdate, UserProfileUpdate, OrderCreate, OrderResponse, OrderItem
    from db import user_collection, tenants_collection, products_collection, orders_collection
    from utils import hash_password, verify_password, needs_rehash
    from auth import create_access_token, require_auth, require_role, get_current_user_payload
except ImportError:
    from backend.models import User, UserLogin, Tenant, TenantCreate, TenantUpdate, UserProfileUpdate, OrderCreate, OrderResponse, OrderItem  # type: ignore
    from backend.db import user_collection, tenants_collection, products_collection, orders_collection  # type: ignore
    from backend.utils import hash_password, verify_password, needs_rehash  # type: ignore
    from backend.auth import create_access_token, require_auth, require_role, get_current_user_payload  # type: ignore

app = FastAPI(title="Premium Poultry Farm API", version="2.0.0", description="Multi-tenant: customer / admin / super_admin")

# --- CORS: allow frontend dev servers (Vite 7500, 5173, 4000) ---
origins = [
    "http://localhost:7500",
    "http://127.0.0.1:7500",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4000",
    "http://127.0.0.1:4000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Router with /api prefix to match frontend services/api.js ---
api_router = APIRouter(prefix="/api")
users_router = APIRouter(prefix="/users", tags=["users"])
tenants_router = APIRouter(prefix="/tenants", tags=["tenants"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])
super_router = APIRouter(prefix="/super", tags=["super"])
orders_router = APIRouter(prefix="/orders", tags=["orders"])
products_router = APIRouter(prefix="/products", tags=["products"])

def _slugify(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s or f"tenant-{uuid.uuid4().hex[:6]}"

def _get_tenant_name(tenant_id: str) -> str:
    if not tenant_id or tenants_collection is None:
        return None
    try:
        t = tenants_collection.find_one({"tenant_id": tenant_id})
        if t:
            return t.get("name")
        # fallback by slug
        t2 = tenants_collection.find_one({"slug": tenant_id})
        if t2:
            return t2.get("name")
    except Exception:
        pass
    return None

def _ensure_default_tenant_id() -> str:
    # ensure at least one tenant exists and return its id
    if tenants_collection is None:
        return "tenant-main"
    try:
        existing = list(tenants_collection.find({}))
        if existing:
            return existing[0].get("tenant_id") or existing[0].get("slug") or "tenant-main"
        # create default
        default_id = "tenant-main"
        doc = {
            "tenant_id": default_id,
            "name": "Premium Poultry Main",
            "slug": "premium-poultry-main",
            "owner_email": "admin@premiumpoultry.com",
            "phone": "+1 (555) 123-4567",
            "address": "123 Farm Road, Countryside, CA 95123",
            "status": "active",
            "settings": {"currency": "USD", "freeShippingThreshold": 50, "deliveryRadius": 50},
            "created_at": datetime.utcnow().isoformat()
        }
        tenants_collection.insert_one(doc)
        return default_id
    except Exception:
        return "tenant-main"

def _build_user_response(user_doc: dict) -> dict:
    tenant_id = user_doc.get("tenant_id")
    tenant_name = _get_tenant_name(tenant_id) if tenant_id else None
    return {
        "user_id": str(user_doc.get("_id", user_doc.get("user_id", ""))),
        "email": user_doc.get("email"),
        "full_name": user_doc.get("full_name") or user_doc.get("name") or "",
        "phone": user_doc.get("phone"),
        "address": user_doc.get("address"),
        "role": user_doc.get("role", "customer"),
        "tenant_id": tenant_id,
        "tenant_name": tenant_name,
        "is_active": user_doc.get("is_active", True),
    }

def _build_token(user_doc: dict) -> str:
    payload = {
        "sub": user_doc.get("email"),
        "user_id": str(user_doc.get("_id", "")),
        "email": user_doc.get("email"),
        "role": user_doc.get("role", "customer"),
        "tenant_id": user_doc.get("tenant_id"),
    }
    return create_access_token(payload)

@app.get("/")
def read_root():
    return {"message": "Premium Poultry Farm API", "status": "ok", "docs": "/docs", "version": "2.0.0", "multi_tenant": True}

@app.get("/health")
def health():
    return {"status": "ok"}

# --- also expose at /api/health for proxy ---
@api_router.get("/health")
def api_health():
    return {"status": "ok"}

# ==================== USERS ====================

@users_router.post("/register")
def register_user(user: User, current_payload: dict = Depends(get_current_user_payload)):
    user_data = user.model_dump() if hasattr(user, "model_dump") else dict(user)
    display_name = user_data.get("full_name") or user_data.get("name") or ""
    if not display_name:
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"message": "Full name is required"})
    email = user_data.get("email")
    raw_password = user_data.get("password")

    if user_collection is None:
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"message": "Database not available"})

    existing = user_collection.find_one({"email": email})
    if existing:
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content={"message": "User already exists"})

    # --- Role & tenant resolution ---
    requested_role = user_data.get("role", "customer")
    requested_tenant = user_data.get("tenant_id")
    # Only super_admin can create other admins/super_admins - public signup always customer
    caller_role = current_payload.get("role") if current_payload else None
    if requested_role in ("admin", "super_admin") and caller_role != "super_admin":
        requested_role = "customer"
        # force tenant to default for downgraded
        if requested_tenant and requested_tenant != "tenant-main":
            requested_tenant = _ensure_default_tenant_id()

    # super_admin should have no tenant; admin/customer must have tenant
    if requested_role == "super_admin":
        requested_tenant = None
    else:
        if not requested_tenant:
            requested_tenant = _ensure_default_tenant_id()
        # validate tenant exists
        if tenants_collection is not None:
            try:
                t = tenants_collection.find_one({"tenant_id": requested_tenant}) or tenants_collection.find_one({"slug": requested_tenant})
                if not t:
                    # fallback to default
                    requested_tenant = _ensure_default_tenant_id()
                else:
                    requested_tenant = t.get("tenant_id") or requested_tenant
            except Exception:
                pass

    try:
        hashed = hash_password(raw_password)
    except ValueError as ve:
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"message": str(ve)})
    except Exception as e:
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"message": f"Failed to hash password: {e}"})

    doc = {
        "email": email,
        "full_name": display_name,
        "name": display_name,
        "phone": user_data.get("phone"),
        "address": user_data.get("address"),
        "password": hashed,
        "role": requested_role,
        "tenant_id": requested_tenant,
        "is_active": True,
        "created_at": datetime.utcnow().isoformat(),
    }
    try:
        result = user_collection.insert_one(doc)
    except Exception as e:
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"message": f"DB insert failed: {e}"})

    user_id = str(result.inserted_id) if hasattr(result, "inserted_id") else str(doc.get("_id", ""))
    user_doc = {**doc, "_id": user_id}
    token = _build_token(user_doc)
    resp_user = _build_user_response(user_doc)
    resp_user["user_id"] = user_id

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "message": "User registered successfully",
            "access_token": token,
            "token_type": "bearer",
            "user": resp_user,
        },
    )

@users_router.post("/login")
def login_user(user: UserLogin):
    user_data = user.model_dump() if hasattr(user, "model_dump") else dict(user)
    email = user_data.get("email")
    plain_pw = user_data.get("password")

    if user_collection is None:
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"message": "Database not available"})

    existing = user_collection.find_one({"email": email})
    if not existing:
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"message": "User does not exist"})

    if not existing.get("is_active", True):
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"message": "Account is deactivated"})

    stored_hash = existing.get("password", "")
    is_argon = isinstance(stored_hash, str) and stored_hash.startswith("$argon2")

    if not is_argon:
        if stored_hash == plain_pw:
            try:
                new_hash = hash_password(plain_pw)
                _id = existing.get("_id")
                if _id:
                    user_collection.update_one({"_id": _id}, {"$set": {"password": new_hash}})
            except Exception:
                pass
            # need to reload after migrate? keep existing
            existing["password"] = stored_hash  # keep original for now
        else:
            return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"message": "Invalid credentials"})

    if is_argon and not verify_password(plain_pw, stored_hash):
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"message": "Invalid credentials"})

    try:
        if is_argon and needs_rehash(stored_hash):
            new_hash = hash_password(plain_pw)
            _id = existing.get("_id")
            if _id:
                user_collection.update_one({"_id": _id}, {"$set": {"password": new_hash}})
    except Exception:
        pass

    # ensure role/tenant defaults for legacy users
    if "role" not in existing:
        user_collection.update_one({"_id": existing["_id"]}, {"$set": {"role": "customer", "tenant_id": _ensure_default_tenant_id()}})
        existing["role"] = "customer"
        existing["tenant_id"] = _ensure_default_tenant_id()

    token = _build_token(existing)
    resp_user = _build_user_response(existing)

    msg = "Login successful"
    if not is_argon:
        msg = "Login successful (migrated to Argon2)"

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "message": msg,
            "access_token": token,
            "token_type": "bearer",
            "user": resp_user,
        },
    )

@users_router.get("/me")
def get_me(payload: dict = Depends(require_auth)):
    # fetch fresh from DB
    email = payload.get("sub") or payload.get("email")
    if user_collection is None:
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"message": "DB unavailable"})
    doc = user_collection.find_one({"email": email})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": _build_user_response(doc)}

@users_router.get("/")
def list_users(payload: dict = Depends(require_role("admin", "super_admin"))):
    # admin sees own tenant users, super sees all
    role = payload.get("role")
    tenant_id = payload.get("tenant_id")
    if user_collection is None:
        return {"users": []}
    try:
        if role == "super_admin":
            docs = list(user_collection.find({}))
        else:
            docs = list(user_collection.find({"tenant_id": tenant_id}))
        users = [_build_user_response(d) for d in docs]
        return {"users": users, "total": len(users)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@users_router.put("/{user_id}/role")
def update_user_role(user_id: str, body: dict, payload: dict = Depends(require_role("super_admin"))):
    if user_collection is None:
        raise HTTPException(status_code=500, detail="DB unavailable")
    new_role = body.get("role")
    new_tenant = body.get("tenant_id")
    if new_role not in ("customer", "admin", "super_admin"):
        raise HTTPException(status_code=400, detail="Invalid role")
    # find by _id or email
    try:
        from bson import ObjectId
        # try ObjectId first
        try:
            doc = user_collection.find_one({"_id": ObjectId(user_id)})
        except Exception:
            doc = None
        if not doc:
            doc = user_collection.find_one({"email": user_id})
        if not doc:
            # try string _id direct (Data API uses UUID strings)
            doc = user_collection.find_one({"_id": user_id})
        if not doc:
            raise HTTPException(status_code=404, detail="User not found")
        update = {"role": new_role}
        if new_role == "super_admin":
            update["tenant_id"] = None
        elif new_tenant:
            update["tenant_id"] = new_tenant
        user_collection.update_one({"_id": doc["_id"]}, {"$set": update})
        return {"message": "Role updated", "user_id": str(doc["_id"])}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== TENANTS ====================

@tenants_router.get("/")
def list_tenants(payload: dict = Depends(require_auth)):
    role = payload.get("role")
    if tenants_collection is None:
        return {"tenants": []}
    try:
        if role == "super_admin":
            docs = list(tenants_collection.find({}))
        else:
            # admin/customer see only own tenant
            tid = payload.get("tenant_id")
            docs = list(tenants_collection.find({"tenant_id": tid})) if tid else []
        # normalize
        for d in docs:
            d["id"] = d.get("tenant_id") or str(d.get("_id", ""))
        return {"tenants": docs, "total": len(docs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@tenants_router.post("/")
def create_tenant(body: TenantCreate, payload: dict = Depends(require_role("super_admin"))):
    if tenants_collection is None:
        raise HTTPException(status_code=500, detail="DB unavailable")
    data = body.model_dump() if hasattr(body, "model_dump") else dict(body)
    name = data.get("name")
    slug = data.get("slug") or _slugify(name)
    # check slug uniqueness
    if tenants_collection.find_one({"slug": slug}) or tenants_collection.find_one({"tenant_id": slug}):
        raise HTTPException(status_code=409, detail="Slug already exists")
    doc = {
        "tenant_id": slug,  # Use slug as tenant_id for readability; could also use uuid
        "name": name,
        "slug": slug,
        "owner_email": data.get("owner_email"),
        "phone": data.get("phone"),
        "address": data.get("address"),
        "status": data.get("status", "active"),
        "settings": {"currency": "USD", "freeShippingThreshold": 50, "deliveryRadius": 50},
        "created_at": datetime.utcnow().isoformat(),
    }
    try:
        tenants_collection.insert_one(doc)
        return {"message": "Tenant created", "tenant": doc}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@tenants_router.get("/{tenant_id}")
def get_tenant(tenant_id: str, payload: dict = Depends(require_auth)):
    if tenants_collection is None:
        raise HTTPException(status_code=500, detail="DB unavailable")
    role = payload.get("role")
    # admin can only view own tenant unless super
    if role != "super_admin" and payload.get("tenant_id") != tenant_id:
        # allow by slug check too
        # fetch and check slug
        pass
    doc = tenants_collection.find_one({"tenant_id": tenant_id}) or tenants_collection.find_one({"slug": tenant_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if role != "super_admin" and doc.get("tenant_id") != payload.get("tenant_id"):
        raise HTTPException(status_code=403, detail="Forbidden")
    return {"tenant": doc}

@tenants_router.put("/{tenant_id}")
def update_tenant(tenant_id: str, body: TenantUpdate, payload: dict = Depends(require_role("admin", "super_admin"))):
    if tenants_collection is None:
        raise HTTPException(status_code=500, detail="DB unavailable")
    role = payload.get("role")
    # admin can only update own tenant
    if role == "admin" and payload.get("tenant_id") != tenant_id:
        raise HTTPException(status_code=403, detail="Admin can only update own tenant")
    data = body.model_dump(exclude_unset=True) if hasattr(body, "model_dump") else {k:v for k,v in dict(body).items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    # remove None tenant_id changes for safety
    doc = tenants_collection.find_one({"tenant_id": tenant_id}) or tenants_collection.find_one({"slug": tenant_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Tenant not found")
    try:
        tenants_collection.update_one({"tenant_id": doc["tenant_id"]}, {"$set": data})
        updated = tenants_collection.find_one({"tenant_id": doc["tenant_id"]})
        return {"message": "Tenant updated", "tenant": updated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@tenants_router.delete("/{tenant_id}")
def delete_tenant(tenant_id: str, payload: dict = Depends(require_role("super_admin"))):
    if tenants_collection is None:
        raise HTTPException(status_code=500, detail="DB unavailable")
    doc = tenants_collection.find_one({"tenant_id": tenant_id}) or tenants_collection.find_one({"slug": tenant_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Tenant not found")
    # prevent deleting if users still assigned? allow but warn
    try:
        tenants_collection.delete_one({"tenant_id": doc["tenant_id"]})
        return {"message": "Tenant deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ADMIN ====================

@admin_router.get("/stats")
def admin_stats(payload: dict = Depends(require_role("admin", "super_admin"))):
    role = payload.get("role")
    tenant_id = payload.get("tenant_id")
    # allow super to pass ?tenant_id=xxx to view specific tenant
    from fastapi import Request
    # Instead use query param via function param? We'll accept optional query via payload inspection
    # For now, if super and wants specific tenant, frontend can call with header but we support via query param in super routes
    # Keep simple: super sees all tenants aggregated unless filtered via separate endpoint
    try:
        # counts
        if user_collection is None:
            user_count = 0
        else:
            if role == "super_admin":
                user_count = len(list(user_collection.find({})))
            else:
                user_count = len(list(user_collection.find({"tenant_id": tenant_id})))
        tenant_count = 0
        product_count = 0
        order_count = 0
        if tenants_collection is not None:
            try:
                tenant_count = len(list(tenants_collection.find({})) if role=="super_admin" else list(tenants_collection.find({"tenant_id": tenant_id})))
            except Exception:
                tenant_count = 1
        if products_collection is not None:
            try:
                if role=="super_admin":
                    product_count = len(list(products_collection.find({})))
                else:
                    product_count = len(list(products_collection.find({"tenant_id": tenant_id})))
                if product_count==0:
                    product_count = 12  # fallback mock count
            except Exception:
                product_count = 12
        else:
            product_count = 12

        # mock revenue/orders
        mock_revenue = 45230 if role=="super_admin" else 12450
        mock_orders = 342 if role=="super_admin" else 87
        low_stock = 3

        return {
            "tenant_id": tenant_id,
            "role": role,
            "stats": {
                "users": user_count,
                "tenants": tenant_count,
                "products": product_count,
                "orders": mock_orders,
                "revenue": mock_revenue,
                "low_stock": low_stock,
                "pending_orders": 8 if role=="admin" else 23,
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@admin_router.get("/users")
def admin_users(payload: dict = Depends(require_role("admin", "super_admin"))):
    # same as users list but tenant-scoped; super can filter via query param tenant_id handled in query
    role = payload.get("role")
    tenant_id = payload.get("tenant_id")
    if user_collection is None:
        return {"users": []}
    try:
        if role == "super_admin":
            # super sees all but can be filtered by frontend query; return all for admin endpoint to support Full Super Control
            docs = list(user_collection.find({}))
        else:
            docs = list(user_collection.find({"tenant_id": tenant_id}))
        return {"users": [_build_user_response(d) for d in docs], "total": len(docs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== SUPER ====================

@super_router.get("/stats")
def super_stats(payload: dict = Depends(require_role("super_admin"))):
    try:
        users_total = len(list(user_collection.find({}))) if user_collection else 0
        tenants_total = len(list(tenants_collection.find({}))) if tenants_collection else 0
        # role breakdown
        role_counts = {"customer": 0, "admin": 0, "super_admin": 0}
        if user_collection:
            for d in user_collection.find({}):
                r = d.get("role", "customer")
                if r in role_counts:
                    role_counts[r]+=1

        # per-tenant breakdown
        per_tenant = []
        if tenants_collection and user_collection:
            for t in tenants_collection.find({}):
                tid = t.get("tenant_id")
                cnt = len(list(user_collection.find({"tenant_id": tid})))
                per_tenant.append({"tenant_id": tid, "name": t.get("name"), "users": cnt, "status": t.get("status")})

        return {
            "totals": {
                "users": users_total,
                "tenants": tenants_total,
                "products": 12 * max(1, tenants_total),
                "orders": 342,
                "revenue": 45230,
            },
            "role_breakdown": role_counts,
            "per_tenant": per_tenant,
            "system": {"db": "connected" if user_collection else "disconnected", "version": "2.0.0"}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@super_router.get("/users")
def super_users(payload: dict = Depends(require_role("super_admin"))):
    if user_collection is None:
        return {"users": []}
    docs = list(user_collection.find({}))
    return {"users": [_build_user_response(d) for d in docs], "total": len(docs)}

@super_router.get("/tenants")
def super_tenants(payload: dict = Depends(require_role("super_admin"))):
    if tenants_collection is None:
        return {"tenants": []}
    docs = list(tenants_collection.find({}))
    for d in docs:
        d["id"] = d.get("tenant_id")
    return {"tenants": docs, "total": len(docs)}

# ==================== USER PROFILE UPDATE ====================

@users_router.put("/me")
def update_user_profile(body: UserProfileUpdate, payload: dict = Depends(require_auth)):
    if user_collection is None:
        raise HTTPException(status_code=500, detail="DB unavailable")
    email = payload.get("sub") or payload.get("email")
    doc = user_collection.find_one({"email": email})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    # if email is being changed, check uniqueness
    if "email" in update_data and update_data["email"] != email:
        existing = user_collection.find_one({"email": update_data["email"]})
        if existing:
            raise HTTPException(status_code=409, detail="Email already in use")
    try:
        user_collection.update_one({"_id": doc["_id"]}, {"$set": update_data})
        updated = user_collection.find_one({"_id": doc["_id"]})
        return {"message": "Profile updated", "user": _build_user_response(updated)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== PRODUCTS ====================

@products_router.get("/")
def list_products(category: str = None):
    if products_collection is None:
        return {"products": [], "total": 0}
    try:
        query = {}
        if category:
            query["category"] = category
        docs = list(products_collection.find(query))
        products = []
        for d in docs:
            products.append({
                "product_id": str(d.get("_id", d.get("product_id", ""))),
                "name": d.get("name", ""),
                "description": d.get("description", ""),
                "price": d.get("price", 0),
                "originalPrice": d.get("originalPrice"),
                "category": d.get("category", ""),
                "stock_quantity": d.get("stock_quantity", 0),
                "weight": d.get("weight", ""),
                "badge": d.get("badge"),
                "image": d.get("image", ""),
                "tenant_id": d.get("tenant_id"),
            })
        return {"products": products, "total": len(products)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@products_router.get("/{product_id}")
def get_product(product_id: str):
    if products_collection is None:
        raise HTTPException(status_code=500, detail="DB unavailable")
    try:
        from bson import ObjectId
        try:
            doc = products_collection.find_one({"_id": ObjectId(product_id)})
        except Exception:
            doc = None
        if not doc:
            doc = products_collection.find_one({"product_id": product_id})
        if not doc:
            doc = products_collection.find_one({"_id": product_id})
        if not doc:
            raise HTTPException(status_code=404, detail="Product not found")
        return {
            "product": {
                "product_id": str(doc.get("_id", doc.get("product_id", ""))),
                "name": doc.get("name", ""),
                "description": doc.get("description", ""),
                "price": doc.get("price", 0),
                "originalPrice": doc.get("originalPrice"),
                "category": doc.get("category", ""),
                "stock_quantity": doc.get("stock_quantity", 0),
                "weight": doc.get("weight", ""),
                "badge": doc.get("badge"),
                "image": doc.get("image", ""),
                "tenant_id": doc.get("tenant_id"),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ORDERS ====================

@orders_router.post("/")
def create_order(body: OrderCreate, payload: dict = Depends(require_auth)):
    if orders_collection is None:
        raise HTTPException(status_code=500, detail="DB unavailable")
    user_id = payload.get("user_id") or payload.get("sub")
    email = payload.get("sub") or payload.get("email")
    order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
    subtotal = sum(item.price * item.quantity for item in body.items)
    shipping = 0.0 if body.delivery_mode == "pickup" else (0.0 if subtotal > 50 else 9.99)
    total = subtotal - body.promo_discount + shipping
    doc = {
        "order_id": order_id,
        "user_id": user_id,
        "email": email,
        "items": [item.model_dump() for item in body.items],
        "subtotal": subtotal,
        "shipping": shipping,
        "promo_discount": body.promo_discount,
        "promo_code": body.promo_code,
        "total": total,
        "status": "processing",
        "delivery_mode": body.delivery_mode,
        "shipping_address": body.shipping_address,
        "phone": body.phone,
        "notes": body.notes,
        "payment_method": body.payment_method,
        "payment_status": "completed" if body.payment_method == "cod" else "completed",
        "created_at": datetime.utcnow().isoformat(),
    }
    try:
        orders_collection.insert_one(doc)
        return {"message": "Order placed successfully", "order_id": order_id, "total": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@orders_router.get("/")
def list_orders(payload: dict = Depends(require_auth)):
    if orders_collection is None:
        return {"orders": [], "total": 0}
    user_id = payload.get("user_id") or payload.get("sub")
    email = payload.get("sub") or payload.get("email")
    try:
        docs = list(orders_collection.find({"$or": [{"user_id": user_id}, {"email": email}]}))
        orders = []
        for d in docs:
            orders.append({
                "order_id": d.get("order_id", ""),
                "items": d.get("items", []),
                "subtotal": d.get("subtotal", 0),
                "shipping": d.get("shipping", 0),
                "promo_discount": d.get("promo_discount", 0),
                "total": d.get("total", 0),
                "status": d.get("status", "processing"),
                "delivery_mode": d.get("delivery_mode", "delivery"),
                "shipping_address": d.get("shipping_address"),
                "payment_method": d.get("payment_method", "card"),
                "payment_status": d.get("payment_status", "pending"),
                "created_at": d.get("created_at", ""),
            })
        orders.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return {"orders": orders, "total": len(orders)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@orders_router.get("/{order_id}")
def get_order(order_id: str, payload: dict = Depends(require_auth)):
    if orders_collection is None:
        raise HTTPException(status_code=500, detail="DB unavailable")
    user_id = payload.get("user_id") or payload.get("sub")
    role = payload.get("role")
    try:
        doc = orders_collection.find_one({"order_id": order_id})
        if not doc:
            raise HTTPException(status_code=404, detail="Order not found")
        # non-admin can only view own orders
        if role not in ("admin", "super_admin") and doc.get("user_id") != user_id and doc.get("email") != user_id:
            raise HTTPException(status_code=403, detail="Forbidden")
        return {
            "order": {
                "order_id": doc.get("order_id", ""),
                "items": doc.get("items", []),
                "subtotal": doc.get("subtotal", 0),
                "shipping": doc.get("shipping", 0),
                "promo_discount": doc.get("promo_discount", 0),
                "total": doc.get("total", 0),
                "status": doc.get("status", "processing"),
                "delivery_mode": doc.get("delivery_mode", "delivery"),
                "shipping_address": doc.get("shipping_address"),
                "phone": doc.get("phone"),
                "notes": doc.get("notes"),
                "payment_method": doc.get("payment_method", "card"),
                "payment_status": doc.get("payment_status", "pending"),
                "created_at": doc.get("created_at", ""),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Mount routers
api_router.include_router(users_router)
api_router.include_router(tenants_router)
api_router.include_router(admin_router)
api_router.include_router(super_router)
api_router.include_router(products_router)
api_router.include_router(orders_router)
app.include_router(api_router)

# --- Legacy routes (keep for backwards compat with old frontend) ---
@app.post("/register", include_in_schema=False)
def legacy_register(user: User):
    return register_user(user)

@app.post("/login", include_in_schema=False)
def legacy_login(user: UserLogin):
    return login_user(user)