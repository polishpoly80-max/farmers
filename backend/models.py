from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal
from datetime import datetime
import uuid

RoleType = Literal["customer", "worker", "admin", "super_admin"]

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
    # --- branch / farm-location fields ---
    code: Optional[str] = Field(default=None, description="Short branch code, e.g. MAIN / NORTH")
    city: Optional[str] = None
    region: Optional[str] = None
    postal_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    delivery_fee: Optional[float] = None
    free_delivery_threshold: Optional[float] = None
    delivery_radius_km: Optional[float] = None
    opening_hours: Optional[str] = None
    is_accepting_orders: bool = True

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    owner_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: Optional[Literal["active", "inactive"]] = None
    settings: Optional[dict] = None
    # --- branch / farm-location fields ---
    code: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    postal_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    delivery_fee: Optional[float] = None
    free_delivery_threshold: Optional[float] = None
    delivery_radius_km: Optional[float] = None
    opening_hours: Optional[str] = None
    is_accepting_orders: Optional[bool] = None
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
    role: RoleType = Field(default="customer", description="customer | worker | admin | super_admin")
    tenant_id: Optional[str] = Field(default=None, description="Branch this user belongs to; null for super_admin/platform")
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
    # which farm branch fulfils this order
    branch_id: Optional[str] = None

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
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None

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


# ==================== BRANCHES (farm locations) ====================

class BranchResponse(BaseModel):
    """Public shape of a farm branch, safe to expose before login."""
    branch_id: str
    name: str
    slug: Optional[str] = None
    code: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    postal_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: str = "active"
    is_accepting_orders: bool = True
    delivery_fee: float = 9.99
    free_delivery_threshold: float = 50.0
    delivery_radius_km: Optional[float] = None
    opening_hours: Optional[str] = None
    # optional, only included on detail calls
    product_count: Optional[int] = None
    low_stock_count: Optional[int] = None
    out_of_stock_count: Optional[int] = None


class BranchInventoryItem(BaseModel):
    product_id: str
    name: str = ""
    category: str = ""
    image: str = ""
    price: float = 0
    stock_quantity: int = 0
    low_stock_threshold: int = 10
    updated_at: Optional[str] = None


class InventoryUpdate(BaseModel):
    stock_quantity: int = Field(..., ge=0)
    low_stock_threshold: Optional[int] = Field(default=None, ge=0)


class BranchSelect(BaseModel):
    """Customer picks which branch serves them."""
    branch_id: str


# ==================== NOTIFICATIONS ====================

class NotificationResponse(BaseModel):
    notification_id: str
    user_id: str = ""
    branch_id: Optional[str] = None
    type: str = "general"
    title: str = ""
    body: str = ""
    data: dict = {}
    read: bool = False
    created_at: str = ""


class NotificationCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    body: str = Field(..., min_length=1, max_length=400)
    type: str = "announcement"
    url: Optional[str] = "/"
    # admin broadcast targeting
    target: Literal["branch", "all_customers", "all"] = "branch"
    branch_id: Optional[str] = None


class PushSubscription(BaseModel):
    endpoint: str = Field(..., min_length=8)
    keys: dict = Field(default_factory=dict)


class PushSubscribeRequest(BaseModel):
    subscription: PushSubscription
    user_agent: Optional[str] = None


# ==================== CUSTOMER CARE LIVE CHAT ====================

CareStatus = Literal["waiting", "accepted", "resolved", "closed"]


class CareSessionCreate(BaseModel):
    """A customer opens a support request against a branch."""
    branch_id: Optional[str] = None
    topic: str = Field(default="General support", max_length=120)
    message: str = Field(..., min_length=1, max_length=2000)
    order_id: Optional[str] = None
    priority: Literal["normal", "urgent"] = "normal"


class CareMessageCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


class CareStatusUpdate(BaseModel):
    status: CareStatus
    note: Optional[str] = None


class CareMessage(BaseModel):
    message_id: str
    sender_id: str = ""
    sender_name: str = ""
    sender_role: str = "customer"
    body: str = ""
    created_at: str = ""


class CareSessionResponse(BaseModel):
    session_id: str
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None
    topic: str = "General support"
    status: CareStatus = "waiting"
    priority: str = "normal"
    order_id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_name: Optional[str] = None
    room_name: str = ""
    room_url: str = ""
    messages: list[CareMessage] = []
    created_at: str = ""
    updated_at: str = ""
    resolved_at: Optional[str] = None
    resolution_note: Optional[str] = None
    last_message: Optional[str] = None
    last_message_at: Optional[str] = None
    unread_for_staff: int = 0
    unread_for_customer: int = 0


# ==================== ORDER BRANCH / STATUS ====================

class OrderStatusUpdate(BaseModel):
    status: Literal[
        "processing", "confirmed", "packed", "out_for_delivery", "delivered", "cancelled"
    ]
    note: Optional[str] = None
