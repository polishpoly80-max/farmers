from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal
from datetime import datetime
import uuid

RoleType = Literal["customer", "admin", "super_admin"]

class Tenant(BaseModel):
    tenant_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = Field(..., min_length=2, max_length=80)
    slug: str = Field(..., pattern=r"^[a-z0-9-]+$", description="url-friendly id")
    owner_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: Literal["active", "inactive"] = "active"
    settings: Optional[dict] = Field(default_factory=lambda: {"currency": "USD", "freeShippingThreshold": 50, "deliveryRadius": 50})
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

    model_config = {"extra": "ignore"}

class TenantCreate(BaseModel):
    name: str = Field(..., min_length=2)
    slug: Optional[str] = None
    owner_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: Literal["active", "inactive"] = "active"

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    owner_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: Optional[Literal["active", "inactive"]] = None
    settings: Optional[dict] = None
    model_config = {"extra": "ignore"}

class User(BaseModel):
    """Registration payload - aligned with frontend Register.jsx"""
    email: EmailStr
    full_name: Optional[str] = Field(default=None, description="Full name from frontend")
    name: Optional[str] = None  # legacy
    phone: Optional[str] = None
    address: Optional[str] = None
    password: str = Field(..., min_length=6)
    # multi-tenant fields
    role: RoleType = Field(default="customer", description="customer | admin | super_admin")
    tenant_id: Optional[str] = Field(default=None, description="Tenant this user belongs to; null for super_admin/platform")
    is_active: bool = True

    def get_display_name(self) -> str:
        return self.full_name or self.name or self.email.split("@")[0]

    model_config = {"extra": "ignore"}

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    """What we return to frontend (never includes password)"""
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    user_id: Optional[str] = None
    role: RoleType = "customer"
    tenant_id: Optional[str] = None
    tenant_name: Optional[str] = None
    is_active: bool = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class OrderItem(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int = 1
    weight: Optional[str] = None
    image: Optional[str] = None

class OrderCreate(BaseModel):
    items: list[OrderItem]
    total: float
    delivery_mode: str = "delivery"
    shipping_address: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    payment_method: str = "card"
    promo_code: Optional[str] = None
    promo_discount: float = 0.0

class OrderResponse(BaseModel):
    order_id: str
    user_id: str
    items: list[OrderItem]
    subtotal: float
    shipping: float
    promo_discount: float
    total: float
    status: str = "processing"
    delivery_mode: str = "delivery"
    shipping_address: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    payment_method: str = "card"
    payment_status: str = "pending"
    created_at: str = ""

class ProductResponse(BaseModel):
    product_id: str
    name: str
    description: Optional[str] = None
    price: float
    originalPrice: Optional[float] = None
    category: str = ""
    stock_quantity: int = 0
    weight: str = ""
    badge: Optional[str] = None
    image: str = ""
    tenant_id: Optional[str] = None
