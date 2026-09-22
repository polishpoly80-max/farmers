import os
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

# Secret - fallback for dev, should be env in prod
JWT_SECRET = os.getenv("JWT_SECRET", "premium-poultry-dev-secret-change-in-prod-32chars!")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "72"))

bearer_scheme = HTTPBearer(auto_error=False)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=JWT_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}", headers={"WWW-Authenticate": "Bearer"})

def get_current_user_payload(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> Optional[dict]:
    if not credentials or not credentials.credentials:
        return None
    try:
        return decode_token(credentials.credentials)
    except HTTPException:
        return None

def require_auth(payload: Optional[dict] = Depends(get_current_user_payload)) -> dict:
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    return payload

def require_role(*allowed_roles: str):
    def _checker(payload: dict = Depends(require_auth)):
        role = payload.get("role", "customer")
        # super_admin can access admin routes (Full Super Control)
        effective_allowed = set(allowed_roles)
        if "admin" in effective_allowed and role == "super_admin":
            return payload
        if role not in effective_allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Forbidden: requires {', '.join(allowed_roles)} role")
        return payload
    return _checker

def get_tenant_id_from_payload(payload: dict) -> Optional[str]:
    return payload.get("tenant_id")

# Helper to fetch user doc and enrich with tenant name
def enrich_user_with_tenant(user_doc: dict) -> dict:
    tenant_name = None
    tenant_id = user_doc.get("tenant_id")
    if tenant_id:
        try:
            from db import tenants_collection
            # need robust import
        except ImportError:
            from backend.db import tenants_collection
        if tenants_collection is not None:
            try:
                t = tenants_collection.find_one({"tenant_id": tenant_id})
                if t:
                    tenant_name = t.get("name")
                else:
                    # fallback by _id or slug
                    t2 = tenants_collection.find_one({"slug": tenant_id})
                    if t2:
                        tenant_name = t2.get("name")
            except Exception:
                pass
    return tenant_name
