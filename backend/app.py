from fastapi import FastAPI, status, APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import re
import uuid
import os
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load local configuration before importing database/auth modules.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

try:
    from pywebpush import webpush
except ImportError:
    webpush = None

# --- robust imports (work both as `uvicorn app:app` inside backend/ and `uvicorn backend.app:app` from root) ---
try:
    from models import (User, UserLogin, Tenant, TenantCreate, TenantUpdate, UserProfileUpdate,
                        OrderCreate, OrderResponse, OrderItem, BranchResponse, BranchInventoryItem,
                        InventoryUpdate, BranchSelect, NotificationResponse, NotificationCreate,
                        PushSubscribeRequest, OrderStatusUpdate,
                        CareSessionCreate, CareMessageCreate, CareStatusUpdate)
    from db import (user_collection, tenants_collection, products_collection, orders_collection,
                    push_subscriptions_collection, inventory_collection,
                    notifications_collection, user_preferences_collection,
                    care_sessions_collection)
    from utils import hash_password, verify_password, needs_rehash
    from auth import (create_access_token, require_auth, require_role, require_branch_staff,
                      get_current_user_payload, enforce_login_rate_limit, record_login_failure,
                      clear_login_failures, LOGIN_MAX_ATTEMPTS)
    from push import notify, notify_many, vapid_ready
    from db import db_status, is_db_waking, DB_WAKING_MESSAGE
except ImportError:
    from backend.models import (User, UserLogin, Tenant, TenantCreate, TenantUpdate, UserProfileUpdate,
                                OrderCreate, OrderResponse, OrderItem, BranchResponse, BranchInventoryItem,
                                InventoryUpdate, BranchSelect, NotificationResponse, NotificationCreate,
                                PushSubscribeRequest, OrderStatusUpdate,
                                CareSessionCreate, CareMessageCreate, CareStatusUpdate)  # type: ignore
    from backend.db import (user_collection, tenants_collection, products_collection, orders_collection,
                            push_subscriptions_collection, inventory_collection,
                            notifications_collection, user_preferences_collection,
                            care_sessions_collection)  # type: ignore
    from backend.utils import hash_password, verify_password, needs_rehash  # type: ignore
    from backend.auth import (create_access_token, require_auth, require_role, require_branch_staff,  # type: ignore
                              get_current_user_payload, enforce_login_rate_limit, record_login_failure,
                              clear_login_failures, LOGIN_MAX_ATTEMPTS)
    from backend.push import notify, notify_many, vapid_ready  # type: ignore
    from backend.db import db_status, is_db_waking, DB_WAKING_MESSAGE  # type: ignore

app = FastAPI(title="Premium Poultry Farm API", version="2.2.0", description="Multi-branch + multi-tenant roles: customer, worker, branch admin, super admin")

# --- CORS ---
# In development the frontend is a Vite dev server on localhost, so those
# origins are always allowed. In production the real site domain must be
# supplied via CORS_ORIGINS (comma-separated), otherwise the browser blocks
# every API call and the deployed app loads but cannot fetch anything.
#
# The wildcard "*" is deliberately not the default: credentials are enabled, and
# browsers reject "*" together with credentials anyway. Setting CORS_ORIGINS="*"
# therefore falls back to "no cross-origin access" rather than silently
# misbehaving - see the warning printed below.
DEV_ORIGINS = [
    "http://localhost:7500",
    "http://127.0.0.1:7500",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4000",
    "http://127.0.0.1:4000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


def _configured_origins() -> list:
    """Origins allowed to call this API, from the CORS_ORIGINS env var."""
    raw = os.getenv("CORS_ORIGINS", "")
    parsed = [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]
    if "*" in parsed:
        print(
            "[CORS] CORS_ORIGINS='*' cannot be used with credentialed requests "
            "and would silently break the deployed frontend. Ignored."
        )
        parsed = [origin for origin in parsed if origin != "*"]
    return parsed


prod_origins = _configured_origins()
origins = list(dict.fromkeys(DEV_ORIGINS + prod_origins))

if prod_origins:
    print(f"[CORS] Allowing production origins: {', '.join(prod_origins)}")
else:
    print(
        "[CORS] CORS_ORIGINS is not set - only localhost dev origins are allowed.\n"
        "[CORS] If you are deploying, set it to your site origin, for example:\n"
        "[CORS]   CORS_ORIGINS=https://your-site.com,https://www.your-site.com"
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Router with /api prefix to match frontend services/api.js ---
# Upper bound on how many documents any single list endpoint will pull into
# memory. Callers may ask for fewer; they can never ask for unbounded.
MAX_LIST_LIMIT = 200

api_router = APIRouter(prefix="/api")
users_router = APIRouter(prefix="/users", tags=["users"])
tenants_router = APIRouter(prefix="/tenants", tags=["tenants"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])
super_router = APIRouter(prefix="/super", tags=["super"])
orders_router = APIRouter(prefix="/orders", tags=["orders"])
products_router = APIRouter(prefix="/products", tags=["products"])
notifications_router = APIRouter(prefix="/notifications", tags=["notifications"])
branches_router = APIRouter(prefix="/branches", tags=["branches"])
care_router = APIRouter(prefix="/care", tags=["care"])

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

# ==================== BRANCH HELPERS ====================
# A "branch" is a farm location. It is stored in the `tenants` collection so the
# existing auth/role model (an admin belongs to a tenant) keeps working, while the
# extra branch fields describe the physical location and its delivery rules.
# Per-branch stock lives in `inventory`, keyed by (branch_id, product_id).

def _find_branch_doc(branch_id: str):
    """Look up a branch. Returns None when missing *or* when the database is
    unreachable, so the storefront degrades to "no branch" instead of 500-ing."""
    if not branch_id or tenants_collection is None:
        return None
    try:
        return (
            tenants_collection.find_one({"tenant_id": branch_id})
            or tenants_collection.find_one({"slug": branch_id})
        )
    except Exception as exc:
        print(f"[branch] lookup failed for {branch_id}: {exc}")
        return None


def _product_identifier(doc: dict) -> str:
    """Stable public product id.

    Prefers an explicit `product_id` field so it matches the ids the storefront
    already uses ("1".."12"); falls back to the Mongo _id for older documents
    that only have the default ObjectId.
    """
    explicit = doc.get("product_id")
    if explicit:
        return str(explicit)
    return str(doc.get("_id", ""))


def _branch_public(doc: dict) -> dict:
    """Normalize a tenant document into the public branch shape."""
    settings = doc.get("settings") or {}
    return {
        "branch_id": doc.get("tenant_id") or doc.get("slug") or str(doc.get("_id", "")),
        "name": doc.get("name", ""),
        "slug": doc.get("slug"),
        "code": doc.get("code") or (doc.get("slug", "")[:6].upper()),
        "phone": doc.get("phone"),
        "address": doc.get("address"),
        "city": doc.get("city"),
        "region": doc.get("region"),
        "postal_code": doc.get("postal_code"),
        "latitude": doc.get("latitude"),
        "longitude": doc.get("longitude"),
        "status": doc.get("status", "active"),
        "is_accepting_orders": doc.get("is_accepting_orders", True),
        "delivery_fee": doc.get("delivery_fee", settings.get("deliveryFee", 9.99)),
        "free_delivery_threshold": doc.get(
            "free_delivery_threshold", settings.get("freeShippingThreshold", 50)
        ),
        "delivery_radius_km": doc.get(
            "delivery_radius_km", settings.get("deliveryRadius")
        ),
        "opening_hours": doc.get("opening_hours"),
    }


def _seed_branch_inventory(branch_id: str) -> int:
    """Give a branch an opening stock line for every product.

    Uses each product's existing stock_quantity so a newly created branch is
    immediately shoppable instead of showing everything as sold out.
    """
    if inventory_collection is None or products_collection is None or not branch_id:
        return 0
    created = 0
    try:
        existing = {
            d.get("product_id")
            for d in inventory_collection.find({"branch_id": branch_id}, {"product_id": 1})
        }
        for p in products_collection.find({}):
            pid = _product_identifier(p)
            if pid in existing:
                continue
            inventory_collection.insert_one({
                "branch_id": branch_id,
                "product_id": pid,
                "name": p.get("name", ""),
                "category": p.get("category", ""),
                "image": p.get("image", ""),
                "price": p.get("price", 0),
                "stock_quantity": p.get("stock_quantity", 0),
                "low_stock_threshold": 10,
                "updated_at": datetime.utcnow().isoformat(),
            })
            created += 1
    except Exception as exc:
        print(f"[branch] could not seed inventory for {branch_id}: {exc}")
    return created


def _branch_stock_map(branch_id: str) -> dict:
    """{product_id: stock_quantity} for one branch. Empty dict if unavailable."""
    if inventory_collection is None or not branch_id:
        return {}
    try:
        return {
            d.get("product_id"): d.get("stock_quantity", 0)
            for d in inventory_collection.find({"branch_id": branch_id})
        }
    except Exception as exc:
        # Database unreachable: fall back to shared catalogue stock.
        print(f"[branch] stock lookup failed for {branch_id}: {exc}")
        return {}


def _db_reachable() -> bool:
    """Cheap probe so we can answer 503 instead of a misleading 404."""
    if tenants_collection is None:
        return False
    try:
        tenants_collection.find_one({"tenant_id": "__probe__"})
        return True
    except Exception:
        return False


def _require_branch_doc(branch_id: str):
    """Fetch a branch or raise the right error: 503 if the database is down,
    404 if the branch genuinely does not exist."""
    doc = _find_branch_doc(branch_id)
    if doc is None:
        if not _db_reachable():
            raise HTTPException(status_code=503, detail="Database temporarily unavailable")
        raise HTTPException(status_code=404, detail="Branch not found")
    return doc


def _branch_stock_totals(branch_id: str) -> dict:
    """product / low-stock / out-of-stock counts used on branch cards."""
    stock = _branch_stock_map(branch_id)
    total = len(stock)
    out = sum(1 for q in stock.values() if q <= 0)
    low = 0
    if inventory_collection is not None and total:
        try:
            thresholds = {
                d.get("product_id"): d.get("low_stock_threshold", 10)
                for d in inventory_collection.find({"branch_id": branch_id})
            }
            low = sum(1 for pid, q in stock.items() if 0 < q <= thresholds.get(pid, 10))
        except Exception:
            low = 0
    return {"product_count": total, "low_stock_count": low, "out_of_stock_count": out}


def _delete_many_safe(collection, query: dict) -> int:
    """Delete matching operational records across Astra/PyMongo collections."""
    if collection is None:
        return 0
    try:
        result = collection.delete_many(query)
        return int(getattr(result, "deleted_count", 0) or 0)
    except Exception as exc:
        print(f"[branch] cleanup delete failed for {query}: {exc}")
        return 0


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
    return {"message": "Premium Poultry Farm API", "status": "ok", "docs": "/docs", "version": "2.2.0", "multi_tenant": True}

@app.get("/health")
def health():
    """Liveness plus real database state, so a sleeping DB is visible."""
    return {"status": "ok", "database": db_status()}

# --- also expose at /api/health for proxy ---
@api_router.get("/health")
def api_health():
    return {"status": "ok", "database": db_status()}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc: Exception):
    """Turn an AstraDB resume/hibernate error into a clear 503.

    Without this, a sleeping free-tier database surfaces as an opaque 500 and
    looks like an application bug rather than a few minutes of boot time.
    """
    if is_db_waking(exc):
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"message": DB_WAKING_MESSAGE, "code": "db_waking"},
        )
    print(f"[error] unhandled on {request.url.path}: {type(exc).__name__}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"message": "Unexpected server error"},
    )

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
    if requested_role in ("admin", "worker", "super_admin") and caller_role != "super_admin":
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

    # Rate limit before touching the database, and count every failed attempt.
    # Keyed on the normalised email so case/whitespace cannot be used to get a
    # fresh budget by retyping the same account.
    account = (email or "").strip().lower()
    try:
        enforce_login_rate_limit(account)
    except HTTPException as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content={"message": exc.detail},
            headers=exc.headers,
        )

    existing = user_collection.find_one({"email": email})
    if not existing:
        state = record_login_failure(account)
        # Same message and status whether the account is unknown or the password
        # is wrong, so this cannot be used to enumerate registered emails.
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"message": "Invalid email or password.", **state},
        )

    if not existing.get("is_active", True):
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"message": "Account is deactivated"})

    stored_hash = existing.get("password", "")
    is_argon = isinstance(stored_hash, str) and stored_hash.startswith("$argon2")

    def _reject() -> JSONResponse:
        """One response for every kind of bad password, and it counts the try."""
        state = record_login_failure(account)
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"message": "Invalid email or password.", **state},
        )

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
            return _reject()

    if is_argon and not verify_password(plain_pw, stored_hash):
        return _reject()

    # Credentials are good: clear the counter so a single typo does not
    # accumulate toward a lockout across separate visits.
    clear_login_failures(account)

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

    notify(
        user_id=str(existing.get("_id", "")),
        email=email,
        title="New account login",
        body="Your Premium Poultry Farm account was just signed in.",
        notification_type="login",
        data={"url": "/dashboard", "type": "login"},
        url="/dashboard",
    )

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
def list_users(limit: int = MAX_LIST_LIMIT, payload: dict = Depends(require_branch_staff)):
    # Branch staff see their own branch; super admins see every branch.
    role = payload.get("role")
    tenant_id = payload.get("tenant_id")
    if user_collection is None:
        return {"users": []}
    try:
        limit = max(1, min(limit, MAX_LIST_LIMIT))
        if role == "super_admin":
            docs = list(user_collection.find({}).limit(limit))
        else:
            docs = list(user_collection.find({"tenant_id": tenant_id}).limit(limit))
        users = [_build_user_response(d) for d in docs]
        return {"users": users, "total": len(users)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@users_router.put("/{user_id}/role")
def update_user_role(user_id: str, body: dict, payload: dict = Depends(require_role("admin", "super_admin"))):
    if user_collection is None:
        raise HTTPException(status_code=500, detail="DB unavailable")

    caller_role = payload.get("role", "customer")
    new_role = body.get("role")
    new_tenant = body.get("tenant_id") or payload.get("tenant_id")
    if new_role not in ("customer", "worker", "admin", "super_admin"):
        raise HTTPException(status_code=400, detail="Invalid role")
    if caller_role != "super_admin":
        # Branch admins may move customers into the worker role, but cannot
        # grant admin/super-admin access or move an account to another branch.
        new_tenant = payload.get("tenant_id")
        if new_role not in {"customer", "worker"}:
            raise HTTPException(
                status_code=403,
                detail="Branch admins can only promote customers to worker or restore customers",
            )
    elif new_role == "super_admin":
        new_tenant = None
    elif new_tenant and tenants_collection is not None:
        target_tenant = tenants_collection.find_one({"tenant_id": new_tenant}) or tenants_collection.find_one({"slug": new_tenant})
        if not target_tenant:
            raise HTTPException(status_code=400, detail="Target branch does not exist")
        new_tenant = target_tenant.get("tenant_id") or new_tenant

    # find by _id or email
    try:
        from bson import ObjectId
        try:
            doc = user_collection.find_one({"_id": ObjectId(user_id)})
        except Exception:
            doc = None
        if not doc:
            doc = user_collection.find_one({"email": user_id})
        if not doc:
            doc = user_collection.find_one({"_id": user_id})
        if not doc:
            raise HTTPException(status_code=404, detail="User not found")

        if caller_role != "super_admin":
            if doc.get("tenant_id") != payload.get("tenant_id"):
                raise HTTPException(status_code=403, detail="You can only manage users in your branch")
            if doc.get("role") == "super_admin":
                raise HTTPException(status_code=403, detail="Super Admin accounts cannot be changed by branch staff")
            if new_role not in {"customer", "worker", "admin"}:
                raise HTTPException(status_code=403, detail="Branch admins can only manage branch roles")

        update = {"role": new_role}
        if new_role == "super_admin":
            update["tenant_id"] = None
        else:
            update["tenant_id"] = new_tenant
        user_collection.update_one({"_id": doc["_id"]}, {"$set": update})
        return {"message": "Role updated", "user_id": str(doc["_id"]), "role": new_role}
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

BRANCH_FIELDS = (
    "code", "city", "region", "postal_code", "latitude", "longitude",
    "delivery_fee", "free_delivery_threshold", "delivery_radius_km",
    "opening_hours", "is_accepting_orders",
)


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
    # branch / farm-location fields
    for field in BRANCH_FIELDS:
        if data.get(field) is not None:
            doc[field] = data[field]
    if not doc.get("code"):
        doc["code"] = slug.split("-")[0].upper()[:6]
    if doc.get("delivery_fee") is None:
        doc["delivery_fee"] = 9.99
    if doc.get("free_delivery_threshold") is None:
        doc["free_delivery_threshold"] = 50.0
    try:
        tenants_collection.insert_one(doc)
        _seed_branch_inventory(doc["tenant_id"])
        return {"message": "Branch created", "tenant": doc}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@tenants_router.get("/{tenant_id}")
def get_tenant(tenant_id: str, payload: dict = Depends(require_auth)):
    if tenants_collection is None:
        raise HTTPException(status_code=500, detail="DB unavailable")
    role = payload.get("role")
    # The tenant is looked up by id or slug first, then ownership is checked
    # against the resolved document's real tenant_id (so slug lookups work).
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
    doc = tenants_collection.find_one({"tenant_id": tenant_id}) or tenants_collection.find_one({"slug": tenant_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if role != "super_admin" and doc.get("tenant_id") != payload.get("tenant_id"):
        raise HTTPException(status_code=403, detail="Admins can only update their own branch")
    data = body.model_dump(exclude_unset=True) if hasattr(body, "model_dump") else {k:v for k,v in dict(body).items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    try:
        tenants_collection.update_one({"tenant_id": doc["tenant_id"]}, {"$set": data})
        updated = tenants_collection.find_one({"tenant_id": doc["tenant_id"]})
        return {"message": "Tenant updated", "tenant": updated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@tenants_router.delete("/{tenant_id}")
def delete_tenant(
    tenant_id: str,
    cascade: bool = False,
    payload: dict = Depends(require_role("super_admin")),
):
    """Delete a branch, optionally removing its operational data.

    Accounts are deliberately preserved when cascade is enabled. Branch staff
    are detached and returned to customer accounts rather than being deleted;
    this prevents a branch removal from destroying login credentials or order
    history owned by the person who placed the order.
    """
    if tenants_collection is None:
        raise HTTPException(status_code=500, detail="DB unavailable")
    doc = tenants_collection.find_one({"tenant_id": tenant_id}) or tenants_collection.find_one({"slug": tenant_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Tenant not found")
    branch_id = doc.get("tenant_id") or doc.get("slug")
    cleanup = {"inventory": 0, "orders": 0, "notifications": 0, "push_subscriptions": 0, "preferences": 0, "care_sessions": 0}
    try:
        if cascade:
            cleanup["inventory"] = _delete_many_safe(inventory_collection, {"branch_id": branch_id})
            cleanup["orders"] = _delete_many_safe(orders_collection, {"branch_id": branch_id})
            cleanup["notifications"] = _delete_many_safe(notifications_collection, {"branch_id": branch_id})
            cleanup["push_subscriptions"] = _delete_many_safe(push_subscriptions_collection, {"tenant_id": branch_id})
            cleanup["preferences"] = _delete_many_safe(user_preferences_collection, {"branch_id": branch_id})
            cleanup["care_sessions"] = _delete_many_safe(care_sessions_collection, {"branch_id": branch_id})
            if user_collection is not None:
                # Keep accounts, but remove the deleted branch from their scope.
                user_collection.update_many(
                    {"tenant_id": branch_id},
                    {"$set": {"tenant_id": None, "role": "customer"}},
                )
        tenants_collection.delete_one({"tenant_id": branch_id})
        return {
            "message": "Branch deleted",
            "branch_id": branch_id,
            "cascade": cascade,
            "cleanup": cleanup,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ADMIN ====================

@admin_router.get("/stats")
def admin_stats(payload: dict = Depends(require_branch_staff)):
    role = payload.get("role")
    tenant_id = payload.get("tenant_id")
    try:
        user_query = {} if role == "super_admin" else {"tenant_id": tenant_id}
        tenant_query = {} if role == "super_admin" else {"tenant_id": tenant_id}
        order_query = {} if role == "super_admin" else {"branch_id": tenant_id}
        user_docs = list(user_collection.find(user_query)) if user_collection is not None else []
        tenant_docs = list(tenants_collection.find(tenant_query)) if tenants_collection is not None else []
        order_docs = list(orders_collection.find(order_query)) if orders_collection is not None else []
        inventory_query = {} if role == "super_admin" else {"branch_id": tenant_id}
        inventory_docs = list(inventory_collection.find(inventory_query)) if inventory_collection is not None else []
        product_docs = list(products_collection.find({})) if products_collection is not None else []

        product_count = len(inventory_docs) if inventory_docs else len(product_docs)
        low_stock = sum(
            1 for item in inventory_docs
            if 0 < int(item.get("stock_quantity", 0) or 0) <= int(item.get("low_stock_threshold", 10) or 10)
        )
        if not inventory_docs:
            low_stock = sum(
                1 for item in product_docs
                if 0 < int(item.get("stock_quantity", 0) or 0) <= 10
            )
        revenue = sum(
            float(item.get("total", 0) or 0)
            for item in order_docs
            if item.get("status") != "cancelled"
        )
        pending_orders = sum(
            1 for item in order_docs
            if item.get("status", "processing") not in {"delivered", "cancelled"}
        )

        return {
            "tenant_id": tenant_id,
            "role": role,
            "stats": {
                "users": len(user_docs),
                "tenants": len(tenant_docs),
                "products": product_count,
                "orders": len(order_docs),
                "revenue": round(revenue, 2),
                "low_stock": low_stock,
                "pending_orders": pending_orders,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@admin_router.get("/users")
def admin_users(limit: int = MAX_LIST_LIMIT, payload: dict = Depends(require_branch_staff)):
    # same as users list but tenant-scoped; super can filter via query param tenant_id handled in query
    role = payload.get("role")
    tenant_id = payload.get("tenant_id")
    if user_collection is None:
        return {"users": []}
    try:
        limit = max(1, min(limit, MAX_LIST_LIMIT))
        if role == "super_admin":
            # super sees all but can be filtered by frontend query; return all for admin endpoint to support Full Super Control
            docs = list(user_collection.find({}).limit(limit))
        else:
            docs = list(user_collection.find({"tenant_id": tenant_id}).limit(limit))
        return {"users": [_build_user_response(d) for d in docs], "total": len(docs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== SUPER ====================

@super_router.get("/stats")
def super_stats(payload: dict = Depends(require_role("super_admin"))):
    try:
        users = list(user_collection.find({})) if user_collection is not None else []
        tenants = list(tenants_collection.find({})) if tenants_collection is not None else []
        products = list(products_collection.find({})) if products_collection is not None else []
        orders = list(orders_collection.find({})) if orders_collection is not None else []

        role_counts = {"customer": 0, "worker": 0, "admin": 0, "super_admin": 0}
        for user in users:
            role = user.get("role", "customer")
            if role in role_counts:
                role_counts[role] += 1

        per_tenant = []
        for tenant in tenants:
            branch_id = tenant.get("tenant_id") or tenant.get("slug")
            branch_users = [user for user in users if user.get("tenant_id") == branch_id]
            branch_orders = [order for order in orders if order.get("branch_id") == branch_id]
            per_tenant.append({
                "tenant_id": branch_id,
                "name": tenant.get("name"),
                "users": len(branch_users),
                "workers": sum(1 for user in branch_users if user.get("role") in {"worker", "admin"}),
                "orders": len(branch_orders),
                "revenue": round(sum(
                    float(order.get("total", 0) or 0)
                    for order in branch_orders
                    if order.get("status") != "cancelled"
                ), 2),
                "status": tenant.get("status"),
            })

        revenue = round(sum(
            float(order.get("total", 0) or 0)
            for order in orders
            if order.get("status") != "cancelled"
        ), 2)
        return {
            "totals": {
                "users": len(users),
                "tenants": len(tenants),
                "products": len(products),
                "orders": len(orders),
                "revenue": revenue,
            },
            "role_breakdown": role_counts,
            "per_tenant": per_tenant,
            "system": {
                "db": "connected" if user_collection is not None else "disconnected",
                "version": "2.2.0",
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@super_router.get("/users")
def super_users(limit: int = MAX_LIST_LIMIT, payload: dict = Depends(require_role("super_admin"))):
    if user_collection is None:
        return {"users": []}
    limit = max(1, min(limit, MAX_LIST_LIMIT))
    docs = list(user_collection.find({}).limit(limit))
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
def list_products(category: str = None, branch_id: str = None):
    """Catalogue. Pass branch_id to get that branch's stock instead of shared stock."""
    if products_collection is None:
        return {"products": [], "total": 0}
    try:
        query = {}
        if category:
            query["category"] = category
        docs = list(products_collection.find(query))
        stock = _branch_stock_map(branch_id) if branch_id else {}
        products = []
        for d in docs:
            pid = _product_identifier(d)
            entry = {
                "product_id": pid,
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
            }
            if branch_id:
                entry["branch_id"] = branch_id
                entry["branch_stock"] = stock.get(pid, 0)
                # branch stock is authoritative when inventory rows exist
                if stock:
                    entry["stock_quantity"] = stock.get(pid, 0)
            products.append(entry)
        return {"products": products, "total": len(products), "branch_id": branch_id}
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
                "product_id": _product_identifier(doc),
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

# ==================== PUSH NOTIFICATIONS ====================

def _vapid_is_configured() -> bool:
    return bool(os.getenv("VAPID_PUBLIC_KEY") and os.getenv("VAPID_PRIVATE_KEY"))


@notifications_router.get("/vapid-public-key")
def get_vapid_public_key():
    if not _vapid_is_configured():
        raise HTTPException(status_code=503, detail="Push notifications are not configured")
    return {"public_key": os.environ["VAPID_PUBLIC_KEY"]}


@notifications_router.post("/subscribe")
def subscribe_to_push(subscription: dict, payload: dict = Depends(require_auth)):
    if push_subscriptions_collection is None:
        raise HTTPException(status_code=503, detail="Push notification storage is unavailable")
    if not _vapid_is_configured():
        raise HTTPException(status_code=503, detail="Push notifications are not configured")
    endpoint = subscription.get("endpoint")
    keys = subscription.get("keys") or {}
    if not endpoint or not keys.get("p256dh") or not keys.get("auth"):
        raise HTTPException(status_code=400, detail="Invalid push subscription")

    user_id = payload.get("user_id") or payload.get("sub")
    email = payload.get("email") or payload.get("sub")
    now = datetime.utcnow().isoformat()
    push_subscriptions_collection.update_one(
        {"endpoint": endpoint},
        {"$set": {
            "endpoint": endpoint,
            "keys": keys,
            "user_id": user_id,
            "email": email,
            "tenant_id": payload.get("tenant_id"),
            "updated_at": now,
        }, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return {"message": "Push notifications enabled"}


@notifications_router.post("/unsubscribe")
def unsubscribe_from_push(subscription: dict, payload: dict = Depends(require_auth)):
    if push_subscriptions_collection is None:
        return {"message": "Push notifications disabled"}
    endpoint = subscription.get("endpoint")
    if endpoint:
        push_subscriptions_collection.delete_many({"endpoint": endpoint, "email": payload.get("email")})
    return {"message": "Push notifications disabled"}


@notifications_router.post("/test")
def send_test_push(payload: dict = Depends(require_auth)):
    user_id = payload.get("user_id") or payload.get("sub")
    email = payload.get("email") or payload.get("sub")
    result = notify(
        user_id=user_id,
        email=email,
        title="Premium Poultry Farm",
        body="Notifications are working. We will keep you updated on your orders.",
        notification_type="test",
        branch_id=payload.get("tenant_id"),
        data={"type": "test"},
        url="/dashboard",
    )
    return {
        "message": "Test notification sent",
        "sent": result["pushed"],
        "stored": result["stored"],
        "push_available": result["push_available"],
    }


# ==================== IN-APP NOTIFICATION CENTRE ====================

def _notification_public(doc: dict) -> dict:
    return {
        "notification_id": doc.get("notification_id", ""),
        "user_id": doc.get("user_id", ""),
        "branch_id": doc.get("branch_id"),
        "type": doc.get("type", "general"),
        "title": doc.get("title", ""),
        "body": doc.get("body", ""),
        "data": doc.get("data", {}) or {},
        "read": bool(doc.get("read", False)),
        "created_at": doc.get("created_at", ""),
    }


@notifications_router.get("/")
def list_notifications(
    limit: int = 40,
    unread_only: bool = False,
    payload: dict = Depends(require_auth),
):
    """Current user's notifications, newest first (in-app notification centre)."""
    if notifications_collection is None:
        return {"notifications": [], "total": 0, "unread": 0}
    user_id = payload.get("user_id") or payload.get("sub")
    try:
        query: dict = {"user_id": user_id}
        if unread_only:
            query["read"] = False
        docs = list(notifications_collection.find(query).limit(min(limit, 200)))
        # Sort here rather than in the query: astrapy's cursor sort() takes a
        # keyword direction, and these lists are small.
        docs.sort(key=lambda d: str(d.get("created_at", "")), reverse=True)
        # Count in Python: astrapy's count_documents() needs a keyword-only bound.
        unread = sum(1 for d in notifications_collection.find({"user_id": user_id, "read": False}))
        return {
            "notifications": [_notification_public(d) for d in docs],
            "total": len(docs),
            "unread": unread,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@notifications_router.get("/unread-count")
def unread_count(payload: dict = Depends(require_auth)):
    """Lightweight poll target for the header badge."""
    if notifications_collection is None:
        return {"unread": 0}
    user_id = payload.get("user_id") or payload.get("sub")
    try:
        return {"unread": len(list(notifications_collection.find({"user_id": user_id, "read": False})))}
    except Exception:
        return {"unread": 0}


@notifications_router.post("/{notification_id}/read")
def mark_notification_read(notification_id: str, payload: dict = Depends(require_auth)):
    if notifications_collection is None:
        return {"message": "Notification store unavailable"}
    user_id = payload.get("user_id") or payload.get("sub")
    try:
        notifications_collection.update_one(
            {"notification_id": notification_id, "user_id": user_id},
            {"$set": {"read": True, "read_at": datetime.utcnow().isoformat()}},
        )
        return {"message": "Marked as read", "notification_id": notification_id}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@notifications_router.post("/read-all")
def mark_all_notifications_read(payload: dict = Depends(require_auth)):
    if notifications_collection is None:
        return {"message": "Notification store unavailable", "updated": 0}
    user_id = payload.get("user_id") or payload.get("sub")
    try:
        notifications_collection.update_many(
            {"user_id": user_id, "read": False},
            {"$set": {"read": True, "read_at": datetime.utcnow().isoformat()}},
        )
        remaining = len(list(notifications_collection.find({"user_id": user_id, "read": False})))
        return {"message": "All notifications marked as read", "unread": remaining}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@notifications_router.post("/broadcast")
def broadcast_notification(
    body: NotificationCreate,
    payload: dict = Depends(require_role("admin", "super_admin")),
):
    """Admin announcement -> in-app notifications for every targeted customer, plus web push."""
    if user_collection is None:
        raise HTTPException(status_code=503, detail="DB unavailable")
    role = payload.get("role")
    branch_id = body.branch_id or payload.get("tenant_id")

    if role != "super_admin" and branch_id != payload.get("tenant_id"):
        raise HTTPException(status_code=403, detail="Admins can only notify their own branch")

    query: dict = {"role": "customer"}
    if body.target == "branch":
        query["tenant_id"] = branch_id
    elif body.target == "all_customers":
        pass  # every customer across all branches
    else:  # "all" - customers and staff
        query = {}

    try:
        recipients = [
            str(u.get("_id", u.get("user_id", "")))
            for u in user_collection.find(query)
        ]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    result = notify_many(
        user_ids=recipients,
        title=body.title,
        body=body.body,
        notification_type=body.type,
        branch_id=branch_id,
        data={"url": body.url or "/"},
        url=body.url or "/",
    )
    return {"message": "Announcement sent", **result}


# ==================== BRANCHES (farm locations) ====================

@branches_router.get("/")
def list_branches(
    include_inactive: bool = False,
    payload: dict = Depends(get_current_user_payload),
):
    """Public list of farm branches so a customer can pick one before logging in."""
    if tenants_collection is None:
        return {"branches": [], "total": 0}
    try:
        query = {} if include_inactive else {"status": "active"}
        docs = list(tenants_collection.find(query))
        branches = []
        for d in docs:
            pub = _branch_public(d)
            pub.update(_branch_stock_totals(pub["branch_id"]))
            branches.append(pub)
        branches.sort(key=lambda b: (not b.get("is_accepting_orders", True), b.get("name", "")))
        return {"branches": branches, "total": len(branches)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@branches_router.get("/mine")
def get_my_branch(payload: dict = Depends(require_auth)):
    """The branch this customer last selected (falls back to their tenant).

    Declared before /{branch_id} so the literal path wins over the parameter.
    """
    user_id = payload.get("user_id") or payload.get("sub")
    branch_id = payload.get("tenant_id")
    if user_preferences_collection is not None:
        try:
            pref = user_preferences_collection.find_one({"user_id": user_id})
            if pref and pref.get("branch_id"):
                branch_id = pref["branch_id"]
        except Exception:
            pass
    doc = _find_branch_doc(branch_id) if branch_id else None
    if not doc:
        return {"branch": None}
    pub = _branch_public(doc)
    pub.update(_branch_stock_totals(pub["branch_id"]))
    return {"branch": pub}


@branches_router.get("/{branch_id}")
def get_branch(branch_id: str, payload: dict = Depends(get_current_user_payload)):
    doc = _require_branch_doc(branch_id)
    pub = _branch_public(doc)
    pub.update(_branch_stock_totals(pub["branch_id"]))
    return {"branch": pub}


@branches_router.get("/{branch_id}/inventory")
def get_branch_inventory(branch_id: str, payload: dict = Depends(get_current_user_payload)):
    """Stock levels for one branch.

    Any visitor may read stock (the storefront needs it to show what a branch can
    actually fulfil). Customers get a slim payload without staff-only fields such
    as the low-stock threshold; admins additionally must belong to that branch,
    except super_admin who may inspect any.
    """
    doc = _require_branch_doc(branch_id)
    # get_current_user_payload returns None for anonymous visitors.
    role = (payload or {}).get("role")
    is_staff = role in ("admin", "super_admin")
    if is_staff and role != "super_admin" and (payload or {}).get("tenant_id") != doc.get("tenant_id"):
        raise HTTPException(status_code=403, detail="Admins can only view their own branch inventory")

    if inventory_collection is None or products_collection is None:
        return {"branch_id": branch_id, "items": [], "total": 0, "can_edit": is_staff}

    try:
        items = []
        for row in inventory_collection.find({"branch_id": doc.get("tenant_id")}):
            item = {
                "product_id": row.get("product_id"),
                "name": row.get("name", ""),
                "category": row.get("category", ""),
                "image": row.get("image", ""),
                "price": row.get("price", 0),
                "stock_quantity": row.get("stock_quantity", 0),
            }
            if is_staff:
                item["low_stock_threshold"] = row.get("low_stock_threshold", 10)
                item["updated_at"] = row.get("updated_at")
            items.append(item)
        # fall back to catalogue products if a branch has no inventory rows yet
        if not items:
            created = _seed_branch_inventory(doc.get("tenant_id"))
            if created:
                return get_branch_inventory(branch_id, payload)
        items.sort(key=lambda x: (x.get("category", ""), x.get("name", "")))
        return {
            "branch_id": doc.get("tenant_id"),
            "items": items,
            "total": len(items),
            "can_edit": is_staff,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@branches_router.put("/{branch_id}/inventory/{product_id}")
def update_branch_inventory(
    branch_id: str,
    product_id: str,
    body: InventoryUpdate,
    payload: dict = Depends(require_role("admin", "super_admin")),
):
    """Set stock for one product at one branch, and warn staff when it runs low."""
    if inventory_collection is None:
        raise HTTPException(status_code=503, detail="Inventory store unavailable")
    doc = _require_branch_doc(branch_id)
    role = payload.get("role")
    if role != "super_admin" and payload.get("tenant_id") != doc.get("tenant_id"):
        raise HTTPException(status_code=403, detail="Admins can only update their own branch")

    branch_real_id = doc.get("tenant_id")
    threshold = body.low_stock_threshold if body.low_stock_threshold is not None else 10
    now = datetime.utcnow().isoformat()

    try:
        inventory_collection.update_one(
            {"branch_id": branch_real_id, "product_id": product_id},
            {
                "$set": {
                    "stock_quantity": body.stock_quantity,
                    "low_stock_threshold": threshold,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "branch_id": branch_real_id,
                    "product_id": product_id,
                    "name": "",
                    "category": "",
                    "image": "",
                    "price": 0,
                    "created_at": now,
                },
            },
            upsert=True,
        )
        row = inventory_collection.find_one({"branch_id": branch_real_id, "product_id": product_id}) or {}
        product_name = row.get("name") or product_id

        # notify the branch's admins about low / out of stock
        if body.stock_quantity <= threshold:
            severity = "out of stock" if body.stock_quantity <= 0 else "running low"
            message = f"{product_name} is {severity} at {doc.get('name')} ({body.stock_quantity} left)."
            try:
                admins = user_collection.find({"role": "admin", "tenant_id": branch_real_id}) if user_collection else []
                for a in admins:
                    notify(
                        user_id=str(a.get("_id", "")),
                        email=a.get("email"),
                        title="Low stock alert",
                        body=message,
                        notification_type="stock_alert",
                        branch_id=branch_real_id,
                        data={"product_id": product_id, "stock": body.stock_quantity},
                        url="/admin",
                        push=False,  # in-app only: alerts must not spam every device
                    )
            except Exception as exc:
                print(f"[branch] low-stock alert failed: {exc}")

        return {
            "message": "Stock updated",
            "branch_id": branch_real_id,
            "product_id": product_id,
            "stock_quantity": body.stock_quantity,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@branches_router.put("/{branch_id}/settings")
def update_branch_settings(
    branch_id: str,
    body: TenantUpdate,
    payload: dict = Depends(require_role("admin", "super_admin")),
):
    """Update a branch's location, hours and delivery rules."""
    if tenants_collection is None:
        raise HTTPException(status_code=503, detail="DB unavailable")
    doc = _require_branch_doc(branch_id)
    role = payload.get("role")
    if role != "super_admin" and payload.get("tenant_id") != doc.get("tenant_id"):
        raise HTTPException(status_code=403, detail="Admins can only update their own branch")

    data = body.model_dump(exclude_unset=True) if hasattr(body, "model_dump") else dict(body)
    allowed = set(BRANCH_FIELDS) | {"name", "phone", "address", "status"}
    update = {k: v for k, v in data.items() if k in allowed and v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No branch fields to update")

    try:
        tenants_collection.update_one({"tenant_id": doc["tenant_id"]}, {"$set": update})
        updated = _find_branch_doc(branch_id)
        return {"message": "Branch updated", "branch": _branch_public(updated)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@branches_router.post("/select")
def select_branch(body: BranchSelect, payload: dict = Depends(require_auth)):
    """Remember the customer's chosen farm branch."""
    doc = _require_branch_doc(body.branch_id)
    user_id = payload.get("user_id") or payload.get("sub")
    if user_preferences_collection is not None:
        try:
            user_preferences_collection.update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        "branch_id": doc.get("tenant_id"),
                        "branch_name": doc.get("name"),
                        "updated_at": datetime.utcnow().isoformat(),
                    },
                    "$setOnInsert": {"user_id": user_id, "created_at": datetime.utcnow().isoformat()},
                },
                upsert=True,
            )
        except Exception as exc:
            print(f"[branch] could not save preference: {exc}")
    return {"message": "Branch selected", "branch": _branch_public(doc)}


# ==================== ORDERS ====================

# Promo codes are defined here, never on the client. The browser sends the code
# string it typed; the discount it is worth is decided by the server, so a
# hand-crafted request cannot invent its own reduction.
PROMO_CODES = {
    "FARM10": 0.10,
    "FRESH5": 0.05,
}


def _catalogue_prices(product_ids) -> dict:
    """Authoritative unit price per product id, from the products collection.

    Order totals are money, so they are computed from what the catalogue says a
    product costs rather than from whatever the request claims it costs.
    """
    prices: dict = {}
    if products_collection is None:
        return prices
    for pid in product_ids:
        if pid in prices:
            continue
        try:
            doc = products_collection.find_one({"product_id": pid}) or products_collection.find_one({"_id": pid})
        except Exception as exc:
            print(f"[orders] price lookup failed for {pid}: {exc}")
            doc = None
        if doc is not None:
            try:
                prices[pid] = float(doc.get("price", 0) or 0)
            except (TypeError, ValueError):
                prices[pid] = 0.0
    return prices


def _resolve_promo(code: Optional[str], subtotal: float) -> float:
    """Discount for a promo code, computed server-side. 0.0 when absent/unknown."""
    if not code:
        return 0.0
    rate = PROMO_CODES.get(str(code).strip().upper())
    if rate is None:
        return 0.0
    return round(subtotal * rate, 2)


def _update_matched(result) -> bool:
    """Did a conditional update actually find its document?

    astrapy's CollectionUpdateResult reports through `update_info` (with `n` for
    the matched count), not through a `matched_count` attribute like PyMongo.
    Reading it defensively keeps this correct for either driver.
    """
    if result is None:
        return False
    info = getattr(result, "update_info", None)
    if isinstance(info, dict):
        return bool(int(info.get("n", 0) or 0))
    return bool(getattr(result, "matched_count", 0))


@orders_router.post("/")
def create_order(body: OrderCreate, payload: dict = Depends(require_auth)):
    if orders_collection is None:
        raise HTTPException(status_code=500, detail="DB unavailable")
    user_id = payload.get("user_id") or payload.get("sub")
    email = payload.get("sub") or payload.get("email")
    order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"

    # ---- resolve fulfilling branch: explicit > saved preference > tenant ----
    branch_id = body.branch_id
    if not branch_id and user_preferences_collection is not None:
        try:
            pref = user_preferences_collection.find_one({"user_id": user_id})
            if pref and pref.get("branch_id"):
                branch_id = pref["branch_id"]
        except Exception:
            pass
    if not branch_id:
        branch_id = payload.get("tenant_id")
    if not branch_id:
        branch_id = _ensure_default_tenant_id()

    branch_doc = _find_branch_doc(branch_id)
    branch_real_id = (branch_doc or {}).get("tenant_id", branch_id)
    branch_name = (branch_doc or {}).get("name")

    if branch_doc and not branch_doc.get("is_accepting_orders", True):
        raise HTTPException(
            status_code=409,
            detail=f"{branch_doc.get('name')} is not accepting orders right now",
        )

    # ---- branch-aware availability check ----
    if inventory_collection is not None and not _branch_stock_map(branch_real_id):
        _seed_branch_inventory(branch_real_id)
    stock = _branch_stock_map(branch_real_id)

    # A product this branch has no inventory line for is treated as unavailable,
    # not as "unlimited": otherwise a product missing from `stock` would skip
    # the check entirely and could be ordered in any quantity. When the whole
    # branch has no stock lines the map is empty and we cannot judge, so the
    # check is skipped rather than rejecting every order.
    unavailable = [
        {
            "product_id": item.product_id,
            "name": item.name,
            "requested": item.quantity,
            "available": stock.get(item.product_id, 0),
        }
        for item in body.items
        if not stock or stock.get(item.product_id, 0) < item.quantity
    ]
    if unavailable:
        raise HTTPException(
            status_code=409,
            detail={"message": "Some items are no longer available at this branch", "unavailable": unavailable},
        )

    # ---- totals are recomputed from catalogue prices, this branch's delivery
    #      rules, and the server's own promo table ----
    # The prices and promo_discount in the request are display hints from the
    # cart, not billing inputs. Every product must be in the catalogue; an
    # unknown id means the client is asking for something we do not sell.
    catalogue = _catalogue_prices({item.product_id for item in body.items})
    unknown = sorted({item.product_id for item in body.items} - set(catalogue))
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown product(s): {', '.join(unknown)}",
        )

    priced_items = []
    for item in body.items:
        unit_price = catalogue[item.product_id]
        priced_items.append({**item.model_dump(), "price": unit_price})

    subtotal = round(
        sum(item["price"] * item["quantity"] for item in priced_items), 2
    )
    settings = (branch_doc or {}).get("settings") or {}
    if body.delivery_mode == "pickup":
        shipping = 0.0
    else:
        threshold = (branch_doc or {}).get(
            "free_delivery_threshold", settings.get("freeShippingThreshold", 50)
        )
        fee = (branch_doc or {}).get("delivery_fee", settings.get("deliveryFee", 9.99))
        shipping = 0.0 if subtotal >= threshold else float(fee)

    promo_discount = _resolve_promo(body.promo_code, subtotal)
    # Never let a discount drive the order below zero.
    total = round(max(0.0, subtotal - promo_discount + shipping), 2)

    doc = {
        "order_id": order_id,
        "user_id": user_id,
        "email": email,
        "items": priced_items,
        "subtotal": subtotal,
        "shipping": shipping,
        "promo_discount": promo_discount,
        "promo_code": body.promo_code,
        "total": total,
        "status": "processing",
        "delivery_mode": body.delivery_mode,
        "shipping_address": body.shipping_address,
        "phone": body.phone,
        "notes": body.notes,
        "payment_method": body.payment_method,
        # No payment gateway is wired up: Checkout.jsx only validates the card
        # shape and discards it. So the order is recorded as awaiting payment
        # rather than pretending money moved.
        "payment_status": "pending",
        "branch_id": branch_real_id,
        "branch_name": branch_name,
        "created_at": datetime.utcnow().isoformat(),
    }
    try:
        orders_collection.insert_one(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # ---- decrement only this branch's stock ----
    # The availability check above was a read, so two orders racing for the last
    # unit could both pass it. Each decrement is therefore conditional on the
    # stock still being there, and a line that loses the race is given back
    # before the order is rejected.
    if inventory_collection is not None:
        now = datetime.utcnow().isoformat()
        for position, item in enumerate(priced_items):
            try:
                result = inventory_collection.update_one(
                    {
                        "branch_id": branch_real_id,
                        "product_id": item["product_id"],
                        "stock_quantity": {"$gte": item["quantity"]},
                    },
                    {
                        "$inc": {"stock_quantity": -item["quantity"]},
                        "$set": {"updated_at": now},
                    },
                )
            except Exception as exc:
                print(f"[branch] stock decrement failed for {item['product_id']}: {exc}")
                result = None

            if _update_matched(result):
                continue

            # Someone else took this stock between the check and now. Undo the
            # decrements that already succeeded, drop the half-made order, and
            # tell the customer to try again.
            for done in priced_items[:position]:
                try:
                    inventory_collection.update_one(
                        {"branch_id": branch_real_id, "product_id": done["product_id"]},
                        {
                            "$inc": {"stock_quantity": done["quantity"]},
                            "$set": {"updated_at": now},
                        },
                    )
                except Exception as exc:
                    print(f"[branch] rollback failed for {done['product_id']}: {exc}")
            try:
                orders_collection.delete_one({"order_id": order_id})
            except Exception as exc:
                print(f"[orders] could not withdraw {order_id}: {exc}")
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Some items sold out while your order was being placed",
                    "unavailable": [
                        {
                            "product_id": item["product_id"],
                            "name": item["name"],
                            "requested": item["quantity"],
                            "available": 0,
                        }
                    ],
                },
            )

    # ---- notify the customer (in-app + web push) ----
    try:
        notify(
            user_id=user_id,
            email=email,
            title="Order received",
            body=(
                f"Order {order_id} from {branch_name or 'our farm'} is being prepared. "
                f"Total ${total:.2f}."
            ),
            notification_type="order_update",
            branch_id=branch_real_id,
            data={"order_id": order_id, "status": "processing", "total": total},
            url="/dashboard",
        )
    except Exception as exc:
        print(f"[push] order notification failed: {exc}")

    return {
        "message": "Order placed successfully",
        "order_id": order_id,
        "subtotal": subtotal,
        "total": total,
        "shipping": shipping,
        "promo_discount": promo_discount,
        "branch_id": branch_real_id,
        "branch_name": branch_name,
    }


@orders_router.put("/{order_id}/status")
def update_order_status(
    order_id: str,
    body: OrderStatusUpdate,
    payload: dict = Depends(require_branch_staff),
):
    """Change an order's status and notify the customer."""
    if orders_collection is None:
        raise HTTPException(status_code=500, detail="DB unavailable")
    doc = orders_collection.find_one({"order_id": order_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")

    if payload.get("role") != "super_admin" and doc.get("branch_id") != payload.get("tenant_id"):
        raise HTTPException(
            status_code=403, detail="Admins can only update orders for their own branch"
        )

    previous = doc.get("status", "processing")
    update = {"status": body.status, "status_updated_at": datetime.utcnow().isoformat()}
    if body.note:
        update["status_note"] = body.note
    if body.status == "cancelled" and previous != "cancelled":
        update["payment_status"] = "refunded"

    try:
        orders_collection.update_one({"order_id": order_id}, {"$set": update})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    friendly = body.status.replace("_", " ").lower()
    note = f" {body.note}" if body.note else ""
    try:
        notify(
            user_id=doc.get("user_id"),
            email=doc.get("email"),
            title=f"Order {body.status.replace('_', ' ').title()}",
            body=f"Your order {order_id} is now {friendly}.{note}",
            notification_type="order_update",
            branch_id=doc.get("branch_id"),
            data={"order_id": order_id, "status": body.status},
            url="/dashboard",
        )
    except Exception as exc:
        print(f"[push] order status notification failed: {exc}")

    return {"message": "Order status updated", "order_id": order_id, "status": body.status}


@orders_router.get("/")
def list_orders(branch_id: str = None, limit: int = 50, payload: dict = Depends(require_auth)):
    """Customers see their own orders; admins see their branch's orders.

    `limit` is capped so one account with a long history cannot pull the whole
    collection into memory. The response is still complete for normal use;
    paging is the next step if order volume ever outgrows the cap.
    """
    limit = max(1, min(limit, MAX_LIST_LIMIT))
    if orders_collection is None:
        return {"orders": [], "total": 0}
    user_id = payload.get("user_id") or payload.get("sub")
    email = payload.get("sub") or payload.get("email")
    role = payload.get("role")
    try:
        if role in ("admin", "worker", "super_admin"):
            query: dict = {}
            if role in ("admin", "worker"):
                query["branch_id"] = payload.get("tenant_id")
            if branch_id:
                query["branch_id"] = branch_id
            docs = list(orders_collection.find(query).limit(limit))
        else:
            docs = list(
                orders_collection.find(
                    {"$or": [{"user_id": user_id}, {"email": email}]}
                ).limit(limit)
            )
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
                "branch_id": d.get("branch_id"),
                "branch_name": d.get("branch_name"),
                "status_note": d.get("status_note"),
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
        email = payload.get("sub") or payload.get("email")
        is_branch_staff = role in ("admin", "worker") and doc.get("branch_id") == payload.get("tenant_id")
        is_owner = doc.get("user_id") == user_id or (email and doc.get("email") == email)
        if role != "super_admin" and not is_branch_staff and not is_owner:
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
                "branch_id": doc.get("branch_id"),
                "branch_name": doc.get("branch_name"),
                "status_note": doc.get("status_note"),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== CUSTOMER CARE LIVE CHAT ====================
# A care session is one support conversation between a customer and the staff of
# the branch they shop with. Each session owns a private Jitsi room (video/voice)
# plus a persisted message thread, so support continues even when nobody is
# online. Customers open and follow their own sessions; branch admins and workers
# work the branch queue; the super admin can cover every branch.

CARE_STAFF_ROLES = {"admin", "worker", "super_admin"}


def _care_room_name(branch_id: str, session_id: str) -> str:
    """Deterministic, unguessable Jitsi room for one session."""
    branch_part = re.sub(r"[^a-zA-Z0-9_-]", "-", str(branch_id or "farm"))
    return f"PremiumPoultry-Care-{branch_part}-{session_id.replace('CARE-', '')}"


def _care_room_url(room_name: str, display_name: str) -> str:
    return (
        f"https://meet.jit.si/{room_name}"
        "#config.prejoinPageEnabled=false"
        "&config.startWithAudioMuted=true"
        f"&userInfo.displayName={display_name}"
    )


def _care_message_public(msg: dict) -> dict:
    return {
        "message_id": msg.get("message_id", ""),
        "sender_id": msg.get("sender_id", ""),
        "sender_name": msg.get("sender_name", ""),
        "sender_role": msg.get("sender_role", "customer"),
        "body": msg.get("body", ""),
        "created_at": msg.get("created_at", ""),
    }


def _care_session_public(doc: dict, viewer: str) -> dict:
    """Shape a session for the viewer.

    `viewer` is the audience: "staff" or "customer" (role names such as "admin"
    are also accepted). It decides who the unread counter is computed for: staff
    see how many messages the customer added, customers see how many staff
    replied.
    """
    messages = doc.get("messages", []) or []
    customer_id = doc.get("customer_id")
    viewer_is_customer = viewer not in CARE_STAFF_ROLES and viewer != "staff"
    last_read_at = doc.get("last_customer_read_at" if viewer_is_customer else "last_staff_read_at")
    unread = 0
    for msg in messages:
        is_from_customer = msg.get("sender_role") == "customer"
        if viewer_is_customer and is_from_customer:
            continue
        if not viewer_is_customer and not is_from_customer:
            continue
        if not last_read_at or str(msg.get("created_at", "")) > str(last_read_at):
            unread += 1

    room_name = doc.get("room_name") or ""
    last = messages[-1] if messages else None
    return {
        "session_id": doc.get("session_id", ""),
        "branch_id": doc.get("branch_id"),
        "branch_name": doc.get("branch_name"),
        "topic": doc.get("topic", "General support"),
        "status": doc.get("status", "waiting"),
        "priority": doc.get("priority", "normal"),
        "order_id": doc.get("order_id"),
        "customer_id": customer_id,
        "customer_name": doc.get("customer_name"),
        "customer_email": doc.get("customer_email"),
        "assigned_to": doc.get("assigned_to"),
        "assigned_name": doc.get("assigned_name"),
        "room_name": room_name,
        "room_url": _care_room_url(room_name, doc.get("customer_name") or "Guest")
        if room_name else "",
        "messages": [_care_message_public(m) for m in messages],
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
        "resolved_at": doc.get("resolved_at"),
        "resolution_note": doc.get("resolution_note"),
        "last_message": (last or {}).get("body"),
        "last_message_at": (last or {}).get("created_at"),
        "unread_for_staff": doc.get("unread_for_staff", 0),
        "unread_for_customer": doc.get("unread_for_customer", 0),
        "viewer_unread": unread,
    }


def _care_session_for_staff(session: dict) -> bool:
    """Is this staff member allowed to handle the session?"""
    role = session.get("_role")
    tenant_id = session.get("_tenant_id")
    if role == "super_admin":
        return True
    if role not in CARE_STAFF_ROLES:
        return False
    return bool(tenant_id) and session.get("branch_id") == tenant_id


def _care_access(session: dict, payload: dict) -> str:
    """Return the viewer's audience ('staff' | 'customer') or raise 403."""
    role = payload.get("role", "customer")
    if role in CARE_STAFF_ROLES:
        if not _care_session_for_staff(session):
            raise HTTPException(status_code=403, detail="This care room belongs to another branch")
        return "staff"
    if session.get("customer_id") and session.get("customer_id") == payload.get("user_id"):
        return "customer"
    email = payload.get("email") or payload.get("sub")
    if email and session.get("customer_email") == email:
        return "customer"
    raise HTTPException(status_code=403, detail="You can only view your own care conversations")


def _care_recipients_for_branch(branch_id: str) -> list:
    """Admins and workers who should be alerted about a branch's care queue."""
    if user_collection is None or not branch_id:
        return []
    try:
        return [
            str(u.get("_id", ""))
            for u in user_collection.find({"tenant_id": branch_id, "role": {"$in": ["admin", "worker"]}})
        ]
    except Exception as exc:
        print(f"[care] could not resolve branch staff: {exc}")
        return []


@care_router.post("/sessions")
def create_care_session(body: CareSessionCreate, payload: dict = Depends(require_auth)):
    """Customer opens a support request; branch staff are alerted immediately."""
    if care_sessions_collection is None:
        raise HTTPException(status_code=503, detail="Care chat is unavailable")
    user_id = payload.get("user_id") or payload.get("sub")
    email = payload.get("email") or payload.get("sub")

    # Resolve which branch handles this request.
    branch_id = body.branch_id
    if not branch_id and user_preferences_collection is not None:
        try:
            pref = user_preferences_collection.find_one({"user_id": user_id})
            if pref and pref.get("branch_id"):
                branch_id = pref["branch_id"]
        except Exception:
            pass
    if not branch_id:
        branch_id = payload.get("tenant_id")
    if not branch_id:
        branch_id = _ensure_default_tenant_id()
    branch_doc = _find_branch_doc(branch_id) or {}
    branch_real_id = branch_doc.get("tenant_id", branch_id)

    session_id = f"CARE-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.utcnow().isoformat()
    room_name = _care_room_name(branch_real_id, session_id)
    first_message = {
        "message_id": uuid.uuid4().hex[:10],
        "sender_id": user_id,
        "sender_name": payload.get("full_name") or email,
        "sender_role": "customer",
        "body": body.message.strip(),
        "created_at": now,
    }
    doc = {
        "session_id": session_id,
        "branch_id": branch_real_id,
        "branch_name": branch_doc.get("name"),
        "topic": (body.topic or "General support").strip()[:120],
        "status": "waiting",
        "priority": body.priority,
        "order_id": body.order_id,
        "customer_id": user_id,
        "customer_name": payload.get("full_name") or email,
        "customer_email": email,
        "assigned_to": None,
        "assigned_name": None,
        "room_name": room_name,
        "messages": [first_message],
        "unread_for_staff": 1,
        "unread_for_customer": 0,
        "last_staff_read_at": None,
        "last_customer_read_at": now,
        "created_at": now,
        "updated_at": now,
        "resolved_at": None,
    }
    try:
        care_sessions_collection.insert_one(doc)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    staff = _care_recipients_for_branch(branch_real_id)
    if staff:
        try:
            notify_many(
                user_ids=staff,
                title="New customer care request",
                body=f"{doc['customer_name']} needs help: {doc['topic']}",
                notification_type="care_request",
                branch_id=branch_real_id,
                data={"session_id": session_id, "url": "/care-chat"},
                url="/care-chat",
            )
        except Exception as exc:
            print(f"[care] staff notification failed: {exc}")

    return {
        "message": "Care request sent",
        "session": _care_session_public(doc, "customer"),
    }


@care_router.get("/sessions")
def list_care_sessions(
    status: str = None,
    branch_id: str = None,
    payload: dict = Depends(require_auth),
):
    """Branch staff see their queue; customers see their own conversations."""
    if care_sessions_collection is None:
        return {"sessions": [], "total": 0, "waiting": 0}
    role = payload.get("role", "customer")
    user_id = payload.get("user_id") or payload.get("sub")
    email = payload.get("email") or payload.get("sub")
    try:
        if role in CARE_STAFF_ROLES:
            query: dict = {}
            if role != "super_admin":
                tenant_id = payload.get("tenant_id")
                if not tenant_id:
                    return {"sessions": [], "total": 0, "waiting": 0}
                query["branch_id"] = tenant_id
            if branch_id:
                query["branch_id"] = branch_id
        else:
            query = {"$or": [{"customer_id": user_id}, {"customer_email": email}]}
        if status and status != "all":
            # "open" is a UI grouping, not a stored status: it means anything
            # still waiting or being handled.
            query["status"] = (
                {"$in": ["waiting", "accepted"]} if status == "open" else status
            )

        docs = list(care_sessions_collection.find(query).limit(MAX_LIST_LIMIT))
        docs.sort(key=lambda d: str(d.get("updated_at", "")), reverse=True)
        sessions = [_care_session_public(d, role) for d in docs]
        waiting = sum(1 for d in docs if d.get("status") == "waiting")
        return {"sessions": sessions, "total": len(sessions), "waiting": waiting}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@care_router.get("/unread-count")
def care_unread_count(payload: dict = Depends(require_auth)):
    """Badge count for the header's Live Care link."""
    if care_sessions_collection is None:
        return {"unread": 0}
    role = payload.get("role", "customer")
    user_id = payload.get("user_id") or payload.get("sub")
    email = payload.get("email") or payload.get("sub")
    try:
        if role in CARE_STAFF_ROLES:
            query: dict = {"status": {"$in": ["waiting", "accepted"]}}
            if role != "super_admin":
                query["branch_id"] = payload.get("tenant_id")
            docs = list(care_sessions_collection.find(query))
            total = sum(int(d.get("unread_for_staff", 0) or 0) for d in docs)
        else:
            docs = list(care_sessions_collection.find({"$or": [{"customer_id": user_id}, {"customer_email": email}]}))
            total = sum(int(d.get("unread_for_customer", 0) or 0) for d in docs)
        return {"unread": total}
    except Exception:
        return {"unread": 0}


@care_router.get("/sessions/{session_id}")
def get_care_session(session_id: str, payload: dict = Depends(require_auth)):
    if care_sessions_collection is None:
        raise HTTPException(status_code=503, detail="Care chat is unavailable")
    session = care_sessions_collection.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Care conversation not found")
    session["_role"] = payload.get("role", "customer")
    session["_tenant_id"] = payload.get("tenant_id")
    audience = _care_access(session, payload)
    return {"session": _care_session_public(session, audience)}


@care_router.post("/sessions/{session_id}/messages")
def send_care_message(
    session_id: str,
    body: CareMessageCreate,
    payload: dict = Depends(require_auth),
):
    """Append a message and notify the other side of the conversation."""
    if care_sessions_collection is None:
        raise HTTPException(status_code=503, detail="Care chat is unavailable")
    session = care_sessions_collection.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Care conversation not found")
    session["_role"] = payload.get("role", "customer")
    session["_tenant_id"] = payload.get("tenant_id")
    audience = _care_access(session, payload)

    now = datetime.utcnow().isoformat()
    message = {
        "message_id": uuid.uuid4().hex[:10],
        "sender_id": payload.get("user_id") or payload.get("sub"),
        "sender_name": payload.get("full_name") or payload.get("email") or payload.get("sub"),
        "sender_role": "staff" if audience == "staff" else "customer",
        "body": body.body.strip(),
        "created_at": now,
    }
    update = {
        "$push": {"messages": message},
        "$set": {"updated_at": now},
    }
    if audience == "staff":
        # Staff reply also moves a waiting request into "accepted".
        if session.get("status") == "waiting":
            update["$set"]["status"] = "accepted"
            update["$set"]["assigned_to"] = message["sender_id"]
            update["$set"]["assigned_name"] = message["sender_name"]
        update["$inc"] = {"unread_for_customer": 1}
    else:
        update["$inc"] = {"unread_for_staff": 1}

    try:
        care_sessions_collection.update_one({"session_id": session_id}, update)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # Notify the counterpart.
    try:
        if audience == "staff":
            notify(
                user_id=session.get("customer_id"),
                email=session.get("customer_email"),
                title=f"Reply from {session.get('branch_name') or 'customer care'}",
                body=message["body"][:160],
                notification_type="care_message",
                branch_id=session.get("branch_id"),
                data={"session_id": session_id, "url": "/care-chat"},
                url="/care-chat",
            )
        else:
            staff = _care_recipients_for_branch(session.get("branch_id"))
            if staff:
                notify_many(
                    user_ids=staff,
                    title=f"New reply from {session.get('customer_name') or 'a customer'}",
                    body=message["body"][:160],
                    notification_type="care_message",
                    branch_id=session.get("branch_id"),
                    data={"session_id": session_id, "url": "/care-chat"},
                    url="/care-chat",
                )
    except Exception as exc:
        print(f"[care] message notification failed: {exc}")

    fresh = care_sessions_collection.find_one({"session_id": session_id}) or session
    return {"message": "Message sent", "session": _care_session_public(fresh, audience)}


@care_router.put("/sessions/{session_id}/read")
def mark_care_session_read(session_id: str, payload: dict = Depends(require_auth)):
    """Clear the unread badge for the caller's side of the conversation."""
    if care_sessions_collection is None:
        raise HTTPException(status_code=503, detail="Care chat is unavailable")
    session = care_sessions_collection.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Care conversation not found")
    session["_role"] = payload.get("role", "customer")
    session["_tenant_id"] = payload.get("tenant_id")
    audience = _care_access(session, payload)
    field = "last_customer_read_at" if audience == "customer" else "last_staff_read_at"
    counter = "unread_for_customer" if audience == "customer" else "unread_for_staff"
    now = datetime.utcnow().isoformat()
    try:
        care_sessions_collection.update_one(
            {"session_id": session_id},
            {"$set": {field: now, counter: 0}},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"message": "Marked as read", "session_id": session_id}


@care_router.put("/sessions/{session_id}/status")
def update_care_session_status(
    session_id: str,
    body: CareStatusUpdate,
    payload: dict = Depends(require_branch_staff),
):
    """Staff accept/resolve a request; the customer is notified on every change."""
    if care_sessions_collection is None:
        raise HTTPException(status_code=503, detail="Care chat is unavailable")
    session = care_sessions_collection.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Care conversation not found")
    session["_role"] = payload.get("role", "customer")
    session["_tenant_id"] = payload.get("tenant_id")
    _care_access(session, payload)  # enforces branch ownership for staff

    now = datetime.utcnow().isoformat()
    update: dict = {"status": body.status, "updated_at": now}
    if body.status == "accepted":
        update["assigned_to"] = payload.get("user_id") or payload.get("sub")
        update["assigned_name"] = payload.get("full_name") or payload.get("email")
    if body.status in ("resolved", "closed"):
        update["resolved_at"] = now
    if body.note:
        update["resolution_note"] = body.note

    try:
        care_sessions_collection.update_one({"session_id": session_id}, {"$set": update})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    try:
        labels = {
            "accepted": "is being handled",
            "resolved": "was resolved",
            "closed": "was closed",
            "waiting": "is waiting for staff",
        }
        note = f" {body.note}" if body.note else ""
        notify(
            user_id=session.get("customer_id"),
            email=session.get("customer_email"),
            title=f"Care request {body.status}",
            body=f"Your support request \"{session.get('topic')}\" {labels.get(body.status, body.status)}.{note}",
            notification_type="care_status",
            branch_id=session.get("branch_id"),
            data={"session_id": session_id, "url": "/care-chat"},
            url="/care-chat",
        )
    except Exception as exc:
        print(f"[care] status notification failed: {exc}")

    fresh = care_sessions_collection.find_one({"session_id": session_id}) or session
    return {"message": "Care session updated", "session": _care_session_public(fresh, "staff")}


# Mount routers
api_router.include_router(users_router)
api_router.include_router(tenants_router)
api_router.include_router(admin_router)
api_router.include_router(super_router)
api_router.include_router(products_router)
api_router.include_router(orders_router)
api_router.include_router(notifications_router)
api_router.include_router(branches_router)
api_router.include_router(care_router)
app.include_router(api_router)

# --- Legacy routes (keep for backwards compat with old frontend) ---
@app.post("/register", include_in_schema=False)
def legacy_register(user: User):
    # `current_payload` must be passed explicitly: calling the endpoint function
    # directly leaves the FastAPI `Depends` marker in place, and
    # `payload.get(...)` on it raises instead of treating the caller as anonymous.
    return register_user(user, None)

@app.post("/login", include_in_schema=False)
def legacy_login(user: UserLogin):
    return login_user(user)