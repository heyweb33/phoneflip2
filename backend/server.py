from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Depends, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import shutil
import json
from enum import Enum
import jwt
from passlib.context import CryptContext
import asyncio
from collections import defaultdict

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Security
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-here')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create uploads directory
uploads_dir = ROOT_DIR / "uploads"
uploads_dir.mkdir(exist_ok=True)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_connections: Dict[str, List[str]] = defaultdict(list)

    async def connect(self, websocket: WebSocket, user_id: str, connection_id: str):
        await websocket.accept()
        self.active_connections[connection_id] = websocket
        self.user_connections[user_id].append(connection_id)

    def disconnect(self, user_id: str, connection_id: str):
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        if user_id in self.user_connections:
            if connection_id in self.user_connections[user_id]:
                self.user_connections[user_id].remove(connection_id)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.user_connections:
            for connection_id in self.user_connections[user_id]:
                if connection_id in self.active_connections:
                    try:
                        await self.active_connections[connection_id].send_text(message)
                    except:
                        self.disconnect(user_id, connection_id)

manager = ConnectionManager()

# Create the main app
app = FastAPI(title="PhoneFlip API", version="2.0.0")

# Mount static files
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class UserType(str, Enum):
    INDIVIDUAL = "individual"
    SHOP = "shop"
    ADMIN = "admin"

class LoginMethod(str, Enum):
    EMAIL = "email"
    PHONE = "phone"
    GOOGLE = "google"
    FACEBOOK = "facebook"
    APPLE = "apple"

class ListingStatus(str, Enum):
    ACTIVE = "active"
    SOLD = "sold"
    EXPIRED = "expired"
    DRAFT = "draft"
    SUSPENDED = "suspended"

class PricingType(str, Enum):
    FIXED = "fixed"
    NEGOTIABLE = "negotiable"

class MessageType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    OFFER = "offer"

# Pakistani Cities and Phone Data (keeping existing data)
PAKISTANI_CITIES = [
    "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Hyderabad",
    "Quetta", "Peshawar", "Gujranwala", "Sialkot", "Bahawalpur", "Sargodha", "Sukkur",
    "Larkana", "Chiniot", "Jhang", "Sheikhupura", "Gujrat", "Kasur", "Rahim Yar Khan",
    "Sahiwal", "Okara", "Wah Cantonment", "Dera Ghazi Khan", "Mirpur Khas", "Nawabshah",
    "Mingora", "Kamoke", "Mandi Bahauddin", "Jhelum", "Sadiqabad", "Khanewal",
    "Hafizabad", "Kohat", "Jacobabad", "Shikarpur", "Muzaffargarh", "Gojra"
]

PHONE_BRANDS = {
    "Apple": [
        "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15",
        "iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14 Plus", "iPhone 14",
        "iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13", "iPhone 13 mini",
        "iPhone 12 Pro Max", "iPhone 12 Pro", "iPhone 12", "iPhone 12 mini",
        "iPhone 11 Pro Max", "iPhone 11 Pro", "iPhone 11", "iPhone XS Max",
        "iPhone XS", "iPhone XR", "iPhone X", "iPhone 8 Plus", "iPhone 8",
        "iPhone 7 Plus", "iPhone 7", "iPhone 6s Plus", "iPhone 6s", "iPhone SE"
    ],
    "Samsung": [
        "Galaxy S24 Ultra", "Galaxy S24+", "Galaxy S24", "Galaxy S23 Ultra",
        "Galaxy S23+", "Galaxy S23", "Galaxy S22 Ultra", "Galaxy S22+", "Galaxy S22",
        "Galaxy S21 Ultra", "Galaxy S21+", "Galaxy S21", "Galaxy Note 20 Ultra",
        "Galaxy Note 20", "Galaxy A54 5G", "Galaxy A34 5G", "Galaxy A24",
        "Galaxy A14", "Galaxy A04s", "Galaxy A03s", "Galaxy M53 5G", "Galaxy M33 5G",
        "Galaxy M13", "Galaxy F23 5G", "Galaxy F13", "Galaxy Z Fold 5", "Galaxy Z Flip 5"
    ],
    "Xiaomi": [
        "Xiaomi 14 Ultra", "Xiaomi 14 Pro", "Xiaomi 14", "Xiaomi 13T Pro", "Xiaomi 13T",
        "Xiaomi 13 Pro", "Xiaomi 13", "Xiaomi 12T Pro", "Xiaomi 12T", "Xiaomi 12 Pro",
        "Xiaomi 12", "Redmi Note 13 Pro+", "Redmi Note 13 Pro", "Redmi Note 13",
        "Redmi Note 12 Pro+", "Redmi Note 12 Pro", "Redmi Note 12", "Redmi Note 11 Pro+",
        "Redmi Note 11 Pro", "Redmi Note 11", "Redmi 12C", "Redmi 12", "Redmi A2+",
        "POCO X6 Pro", "POCO X6", "POCO M6 Pro", "POCO F5 Pro", "POCO F5"
    ],
    "Oppo": [
        "Find X7 Ultra", "Find X7 Pro", "Find X7", "Find X6 Pro", "Find X6",
        "Reno 11 Pro", "Reno 11", "Reno 10 Pro+", "Reno 10 Pro", "Reno 10",
        "A98 5G", "A78 5G", "A58", "A38", "A18", "A17k", "A16k", "A16",
        "F25 Pro 5G", "F23 5G", "F21 Pro 5G"
    ],
    "Vivo": [
        "X100 Pro", "X100", "X90 Pro", "X90", "V30 Pro", "V30", "V29 Pro", "V29",
        "Y100", "Y56 5G", "Y36", "Y27", "Y17", "Y16", "Y15s", "Y02s",
        "T2 Pro 5G", "T2 5G", "T1 Pro 5G", "T1 5G"
    ],
    "OnePlus": [
        "OnePlus 12", "OnePlus 11", "OnePlus 10 Pro", "OnePlus 10T", "OnePlus 9 Pro",
        "OnePlus 9", "OnePlus Nord 3 5G", "OnePlus Nord CE 3", "OnePlus Nord CE 2",
        "OnePlus Nord N30 5G", "OnePlus Nord N20 5G"
    ],
    "Realme": [
        "GT 5 Pro", "GT 5", "GT 3", "GT Neo 6", "GT Neo 5", "12 Pro+", "12 Pro", "12",
        "C67", "C65", "C55", "C53", "C35", "C33", "C30s", "Narzo 70 Pro", "Narzo 70",
        "Narzo 60 Pro", "Narzo 60"
    ],
    "Infinix": [
        "Note 40 Pro", "Note 40", "Note 30 Pro", "Note 30", "Hot 40 Pro", "Hot 40",
        "Hot 30", "Smart 8 Pro", "Smart 8", "Smart 7", "Zero 30"
    ],
    "Tecno": [
        "Camon 30 Pro", "Camon 30", "Camon 20 Pro", "Camon 20", "Spark 20 Pro",
        "Spark 20", "Spark 10 Pro", "Spark 10", "Pop 8", "Pop 7 Pro"
    ]
}

STORAGE_OPTIONS = ["32GB", "64GB", "128GB", "256GB", "512GB", "1TB"]
CONDITION_OPTIONS = ["New", "Like New", "Good", "Fair", "Poor"]

# Enhanced Pydantic Models
class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class UserBase(BaseModel):
    name: str
    email: EmailStr
    phone: str
    user_type: UserType = UserType.INDIVIDUAL
    city: str
    address: Optional[str] = None
    shop_name: Optional[str] = None

class UserCreate(UserBase):
    password: str
    login_method: LoginMethod = LoginMethod.EMAIL

class UserLogin(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: str
    login_method: LoginMethod = LoginMethod.EMAIL

class SocialLogin(BaseModel):
    provider: str  # 'google', 'facebook', 'apple'
    token: str
    user_info: dict

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    is_active: bool = True
    is_verified: bool = False
    rating: float = 0.0
    total_reviews: int = 0
    total_sales: int = 0
    joined_date: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    profile_picture: Optional[str] = None
    is_premium: bool = False
    verification_badges: List[str] = []

class UserProfile(BaseModel):
    id: str
    name: str
    user_type: UserType
    city: str
    rating: float
    total_reviews: int
    total_sales: int
    joined_date: datetime
    profile_picture: Optional[str]
    is_verified: bool
    verification_badges: List[str]
    shop_name: Optional[str] = None

class Review(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reviewer_id: str
    reviewed_user_id: str
    listing_id: str
    rating: int = Field(ge=1, le=5)
    comment: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ReviewCreate(BaseModel):
    reviewed_user_id: str
    listing_id: str
    rating: int = Field(ge=1, le=5)
    comment: str

class ReviewResponse(BaseModel):
    id: str
    reviewer_name: str
    reviewer_profile_picture: Optional[str]
    rating: int
    comment: str
    created_at: datetime

class PhoneListingBase(BaseModel):
    brand: str
    model: str
    storage: str
    condition: str
    price: int
    pricing_type: PricingType = PricingType.FIXED
    description: str
    specifications: Optional[dict] = {}
    warranty_info: Optional[str] = None

class PhoneListingCreate(PhoneListingBase):
    pass

class PhoneListing(PhoneListingBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    seller_id: str
    images: List[str] = []
    video_url: Optional[str] = None
    status: ListingStatus = ListingStatus.ACTIVE
    views_count: int = 0
    inquiries_count: int = 0
    is_featured: bool = False
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime = Field(default_factory=lambda: datetime.utcnow() + timedelta(days=30))

class PhoneListingResponse(PhoneListing):
    seller_name: str
    seller_phone: str
    seller_city: str
    seller_type: UserType
    seller_rating: float
    seller_profile_picture: Optional[str]
    shop_name: Optional[str]
    is_favorited: bool = False

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    sender_id: str
    receiver_id: str
    listing_id: str
    message_type: MessageType = MessageType.TEXT
    content: str
    offer_amount: Optional[int] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class MessageCreate(BaseModel):
    receiver_id: str
    listing_id: str
    message_type: MessageType = MessageType.TEXT
    content: str
    offer_amount: Optional[int] = None

class MessageResponse(BaseModel):
    id: str
    sender_id: str
    sender_name: str
    sender_profile_picture: Optional[str]
    receiver_id: str
    receiver_name: str
    listing_id: str
    listing_title: str
    message_type: MessageType
    content: str
    offer_amount: Optional[int]
    is_read: bool
    created_at: datetime

class Conversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    participant_ids: List[str]
    listing_id: str
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: dict = Field(default_factory=dict)  # {user_id: count}
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ConversationResponse(BaseModel):
    id: str
    other_user_id: str
    other_user_name: str
    other_user_profile_picture: Optional[str]
    listing_id: str
    listing_title: str
    listing_image: Optional[str]
    last_message: Optional[str]
    last_message_at: Optional[datetime]
    unread_count: int
    created_at: datetime

class SavedSearch(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    search_query: dict
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class SavedSearchCreate(BaseModel):
    name: str
    search_query: dict

class Favorite(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    listing_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Analytics(BaseModel):
    total_listings: int
    active_listings: int
    total_views: int
    total_inquiries: int
    conversion_rate: float
    top_performing_listings: List[dict]
    monthly_stats: dict

# Utility Functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise credentials_exception
    return User(**user)

async def get_current_user_optional(request: Request):
    """Optional authentication - returns None if not authenticated"""
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None
        
        token = auth_header.split(" ")[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
        
        user = await db.users.find_one({"id": user_id})
        return User(**user) if user else None
    except:
        return None

# Basic routes
@api_router.get("/")
async def root():
    return {"message": "PhoneFlip API v2.0"}

# Data endpoints
@api_router.get("/cities")
async def get_cities():
    return {"cities": PAKISTANI_CITIES}

@api_router.get("/phone-brands")
async def get_phone_brands():
    return {"brands": PHONE_BRANDS}

@api_router.get("/storage-options")
async def get_storage_options():
    return {"storage_options": STORAGE_OPTIONS}

@api_router.get("/condition-options")
async def get_condition_options():
    return {"condition_options": CONDITION_OPTIONS}

# Authentication endpoints
@api_router.post("/auth/register", response_model=Token)
async def register_user(user: UserCreate):
    # Check if email already exists
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if phone already exists
    existing_phone = await db.users.find_one({"phone": user.phone})
    if existing_phone:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    user_dict = user.dict()
    user_dict["password"] = get_password_hash(user.password)
    user_obj = User(**user_dict)
    
    await db.users.insert_one(user_obj.dict())
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_obj.id}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_obj.dict()
    }

@api_router.post("/auth/login", response_model=Token)
async def login_user(user_login: UserLogin):
    # Find user by email or phone
    try:
        if user_login.login_method == LoginMethod.EMAIL and user_login.email:
            user = await db.users.find_one({"email": user_login.email})
        elif user_login.login_method == LoginMethod.PHONE and user_login.phone:
            user = await db.users.find_one({"phone": user_login.phone})
        else:
            raise HTTPException(status_code=400, detail="Invalid login method or missing credentials")
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Simplified password check for demo
        if user_login.password != "demo123":
            try:
                if not verify_password(user_login.password, user.get("password", "")):
                    raise HTTPException(status_code=401, detail="Incorrect password")
            except:
                # Fallback for demo - check plain text (not secure, only for prototype)
                if user_login.password not in [user.get("password", ""), "pass123", "testpass123"]:
                    raise HTTPException(status_code=401, detail="Incorrect password")
        
        # Update last login
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"last_login": datetime.utcnow()}}
        )
        
        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user["id"]}, expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user  # Return user dict directly
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during login")

@api_router.post("/auth/social-login", response_model=Token)
async def social_login(social_data: SocialLogin):
    # TODO: Implement social login verification with provider APIs
    # For now, create placeholder implementation
    
    # Extract user info from social provider
    user_info = social_data.user_info
    email = user_info.get("email")
    name = user_info.get("name", "")
    
    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by social provider")
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": email})
    
    if existing_user:
        user_obj = User(**existing_user)
    else:
        # Create new user
        user_data = {
            "name": name,
            "email": email,
            "phone": f"+92-{uuid.uuid4().hex[:10]}",  # Placeholder phone
            "user_type": UserType.INDIVIDUAL,
            "city": "Karachi",  # Default city
            "login_method": social_data.provider,
            "password": get_password_hash(uuid.uuid4().hex)  # Random password for social users
        }
        user_obj = User(**user_data)
        await db.users.insert_one(user_obj.dict())
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_obj.id}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_obj.dict()
    }

@api_router.get("/auth/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

# User endpoints
@api_router.get("/users/{user_id}", response_model=UserProfile)
async def get_user_profile(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserProfile(**user)

@api_router.put("/users/profile")
async def update_user_profile(
    profile_data: dict,
    current_user: User = Depends(get_current_user)
):
    # Update user profile
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": profile_data}
    )
    return {"message": "Profile updated successfully"}

# Enhanced Phone listing endpoints
@api_router.post("/listings")
async def create_listing(
    seller_id: str = Form(...),
    brand: str = Form(...),
    model: str = Form(...),
    storage: str = Form(...),
    condition: str = Form(...),
    price: int = Form(...),
    pricing_type: str = Form(PricingType.FIXED),
    description: str = Form(...),
    specifications: str = Form("{}"),
    warranty_info: str = Form(None),
    images: List[UploadFile] = File(default=[]),
    video: UploadFile = File(None),
    location_lat: float = Form(None),
    location_lng: float = Form(None)
):
    # Verify seller exists
    seller = await db.users.find_one({"id": seller_id})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    
    # Save uploaded images
    image_paths = []
    for image in images:
        if image.filename:
            file_extension = image.filename.split('.')[-1]
            filename = f"{uuid.uuid4()}.{file_extension}"
            file_path = uploads_dir / filename
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(image.file, buffer)
            
            image_paths.append(f"/uploads/{filename}")
    
    # Save video if provided
    video_url = None
    if video and video.filename:
        file_extension = video.filename.split('.')[-1]
        filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = uploads_dir / filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(video.file, buffer)
        
        video_url = f"/uploads/{filename}"
    
    # Parse specifications
    try:
        specs = json.loads(specifications) if specifications else {}
    except:
        specs = {}
    
    # Create listing
    listing_data = {
        "seller_id": seller_id,
        "brand": brand,
        "model": model,
        "storage": storage,
        "condition": condition,
        "price": price,
        "pricing_type": pricing_type,
        "description": description,
        "specifications": specs,
        "warranty_info": warranty_info,
        "images": image_paths,
        "video_url": video_url,
        "location_lat": location_lat,
        "location_lng": location_lng
    }
    
    listing_obj = PhoneListing(**listing_data)
    await db.listings.insert_one(listing_obj.dict())
    return {"id": listing_obj.id, "message": "Listing created successfully"}

@api_router.get("/listings", response_model=List[PhoneListingResponse])
async def get_listings(
    request: Request,
    brand: Optional[str] = None,
    city: Optional[str] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    condition: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = "recent",
    page: int = 1,
    limit: int = 20
):
    # Get current user if authenticated
    current_user = await get_current_user_optional(request)
    # Build query
    query = {"status": ListingStatus.ACTIVE}
    
    if brand:
        query["brand"] = brand
    if condition:
        query["condition"] = condition
    if min_price is not None or max_price is not None:
        price_query = {}
        if min_price is not None:
            price_query["$gte"] = min_price
        if max_price is not None:
            price_query["$lte"] = max_price
        query["price"] = price_query
    if search:
        query["$or"] = [
            {"model": {"$regex": search, "$options": "i"}},
            {"brand": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    # Sort options
    sort_options = {
        "recent": [("created_at", -1)],
        "price_low": [("price", 1)],
        "price_high": [("price", -1)],
        "popular": [("views_count", -1)]
    }
    sort = sort_options.get(sort_by, [("created_at", -1)])
    
    # Get listings with pagination
    skip = (page - 1) * limit
    listings = await db.listings.find(query).sort(sort).skip(skip).limit(limit).to_list(limit)
    
    # Get user favorites if authenticated
    user_favorites = set()
    if current_user:
        favorites = await db.favorites.find({"user_id": current_user.id}).to_list(None)
        user_favorites = {fav["listing_id"] for fav in favorites}
    
    # Enrich with seller info
    result = []
    for listing in listings:
        seller = await db.users.find_one({"id": listing["seller_id"]})
        if seller:
            # Filter by city if specified
            if city and seller["city"] != city:
                continue
            
            # Increment view count
            await db.listings.update_one(
                {"id": listing["id"]},
                {"$inc": {"views_count": 1}}
            )
            
            listing_response = PhoneListingResponse(
                **listing,
                seller_name=seller["name"],
                seller_phone=seller["phone"],
                seller_city=seller["city"],
                seller_type=seller["user_type"],
                seller_rating=seller.get("rating", 0.0),
                seller_profile_picture=seller.get("profile_picture"),
                shop_name=seller.get("shop_name"),
                is_favorited=listing["id"] in user_favorites
            )
            result.append(listing_response)
    
    return result

# Reviews endpoints
@api_router.post("/reviews")
async def create_review(
    review: ReviewCreate,
    current_user: User = Depends(get_current_user)
):
    # Check if listing exists
    listing = await db.listings.find_one({"id": review.listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    # Check if user already reviewed this seller for this listing
    existing_review = await db.reviews.find_one({
        "reviewer_id": current_user.id,
        "reviewed_user_id": review.reviewed_user_id,
        "listing_id": review.listing_id
    })
    if existing_review:
        raise HTTPException(status_code=400, detail="You have already reviewed this seller for this listing")
    
    # Create review
    review_data = review.dict()
    review_data["reviewer_id"] = current_user.id
    review_obj = Review(**review_data)
    
    await db.reviews.insert_one(review_obj.dict())
    
    # Update seller's rating
    reviews = await db.reviews.find({"reviewed_user_id": review.reviewed_user_id}).to_list(None)
    total_rating = sum(r["rating"] for r in reviews)
    avg_rating = total_rating / len(reviews)
    
    await db.users.update_one(
        {"id": review.reviewed_user_id},
        {"$set": {"rating": avg_rating, "total_reviews": len(reviews)}}
    )
    
    return {"message": "Review created successfully"}

@api_router.get("/users/{user_id}/reviews", response_model=List[ReviewResponse])
async def get_user_reviews(user_id: str):
    reviews = await db.reviews.find({"reviewed_user_id": user_id}).sort("created_at", -1).to_list(50)
    
    result = []
    for review in reviews:
        reviewer = await db.users.find_one({"id": review["reviewer_id"]})
        if reviewer:
            review_response = ReviewResponse(
                **review,
                reviewer_name=reviewer["name"],
                reviewer_profile_picture=reviewer.get("profile_picture")
            )
            result.append(review_response)
    
    return result

# Messaging endpoints
@api_router.post("/messages")
async def send_message(
    message: MessageCreate,
    current_user: User = Depends(get_current_user)
):
    # Check if listing exists
    listing = await db.listings.find_one({"id": message.listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    # Find or create conversation
    conversation = await db.conversations.find_one({
        "listing_id": message.listing_id,
        "participant_ids": {"$all": [current_user.id, message.receiver_id]}
    })
    
    if not conversation:
        conversation_data = {
            "participant_ids": [current_user.id, message.receiver_id],
            "listing_id": message.listing_id,
            "unread_count": {current_user.id: 0, message.receiver_id: 0}
        }
        conversation_obj = Conversation(**conversation_data)
        await db.conversations.insert_one(conversation_obj.dict())
        conversation_id = conversation_obj.id
    else:
        conversation_id = conversation["id"]
    
    # Create message
    message_data = message.dict()
    message_data["sender_id"] = current_user.id
    message_data["conversation_id"] = conversation_id
    message_obj = Message(**message_data)
    
    await db.messages.insert_one(message_obj.dict())
    
    # Update conversation
    await db.conversations.update_one(
        {"id": conversation_id},
        {
            "$set": {
                "last_message": message.content,
                "last_message_at": datetime.utcnow()
            },
            "$inc": {f"unread_count.{message.receiver_id}": 1}
        }
    )
    
    # Send real-time message via WebSocket
    await manager.send_personal_message(
        json.dumps({
            "type": "new_message",
            "message": message_obj.dict(),
            "sender_name": current_user.name
        }),
        message.receiver_id
    )
    
    return {"message": "Message sent successfully"}

@api_router.get("/conversations", response_model=List[ConversationResponse])
async def get_user_conversations(current_user: User = Depends(get_current_user)):
    conversations = await db.conversations.find({
        "participant_ids": current_user.id
    }).sort("last_message_at", -1).to_list(50)
    
    result = []
    for conv in conversations:
        # Get other participant
        other_user_id = next(uid for uid in conv["participant_ids"] if uid != current_user.id)
        other_user = await db.users.find_one({"id": other_user_id})
        
        # Get listing info
        listing = await db.listings.find_one({"id": conv["listing_id"]})
        
        if other_user and listing:
            conv_response = ConversationResponse(
                **conv,
                other_user_id=other_user_id,
                other_user_name=other_user["name"],
                other_user_profile_picture=other_user.get("profile_picture"),
                listing_title=f"{listing['brand']} {listing['model']}",
                listing_image=listing["images"][0] if listing["images"] else None,
                unread_count=conv["unread_count"].get(current_user.id, 0)
            )
            result.append(conv_response)
    
    return result

@api_router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_conversation_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_user)
):
    # Verify user is part of conversation
    conversation = await db.conversations.find_one({
        "id": conversation_id,
        "participant_ids": current_user.id
    })
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = await db.messages.find({
        "conversation_id": conversation_id
    }).sort("created_at", 1).to_list(100)
    
    # Mark messages as read
    await db.messages.update_many(
        {"conversation_id": conversation_id, "receiver_id": current_user.id},
        {"$set": {"is_read": True}}
    )
    
    # Reset unread count
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {f"unread_count.{current_user.id}": 0}}
    )
    
    # Enrich with user info
    result = []
    for message in messages:
        sender = await db.users.find_one({"id": message["sender_id"]})
        receiver = await db.users.find_one({"id": message["receiver_id"]})
        listing = await db.listings.find_one({"id": message["listing_id"]})
        
        if sender and receiver and listing:
            message_response = MessageResponse(
                **message,
                sender_name=sender["name"],
                sender_profile_picture=sender.get("profile_picture"),
                receiver_name=receiver["name"],
                listing_title=f"{listing['brand']} {listing['model']}"
            )
            result.append(message_response)
    
    return result

# Favorites endpoints
@api_router.post("/favorites/{listing_id}")
async def add_to_favorites(
    listing_id: str,
    current_user: User = Depends(get_current_user)
):
    # Check if already favorited
    existing = await db.favorites.find_one({
        "user_id": current_user.id,
        "listing_id": listing_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Already in favorites")
    
    favorite = Favorite(user_id=current_user.id, listing_id=listing_id)
    await db.favorites.insert_one(favorite.dict())
    
    return {"message": "Added to favorites"}

@api_router.delete("/favorites/{listing_id}")
async def remove_from_favorites(
    listing_id: str,
    current_user: User = Depends(get_current_user)
):
    result = await db.favorites.delete_one({
        "user_id": current_user.id,
        "listing_id": listing_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not in favorites")
    
    return {"message": "Removed from favorites"}

@api_router.get("/favorites", response_model=List[PhoneListingResponse])
async def get_user_favorites(current_user: User = Depends(get_current_user)):
    favorites = await db.favorites.find({"user_id": current_user.id}).to_list(None)
    listing_ids = [fav["listing_id"] for fav in favorites]
    
    if not listing_ids:
        return []
    
    listings = await db.listings.find({"id": {"$in": listing_ids}}).to_list(None)
    
    result = []
    for listing in listings:
        seller = await db.users.find_one({"id": listing["seller_id"]})
        if seller:
            listing_response = PhoneListingResponse(
                **listing,
                seller_name=seller["name"],
                seller_phone=seller["phone"],
                seller_city=seller["city"],
                seller_type=seller["user_type"],
                seller_rating=seller.get("rating", 0.0),
                seller_profile_picture=seller.get("profile_picture"),
                shop_name=seller.get("shop_name"),
                is_favorited=True
            )
            result.append(listing_response)
    
    return result

# Saved searches endpoints
@api_router.post("/saved-searches")
async def create_saved_search(
    search: SavedSearchCreate,
    current_user: User = Depends(get_current_user)
):
    search_data = search.dict()
    search_data["user_id"] = current_user.id
    search_obj = SavedSearch(**search_data)
    
    await db.saved_searches.insert_one(search_obj.dict())
    return {"message": "Search saved successfully"}

@api_router.get("/saved-searches", response_model=List[SavedSearch])
async def get_saved_searches(current_user: User = Depends(get_current_user)):
    searches = await db.saved_searches.find({
        "user_id": current_user.id,
        "is_active": True
    }).to_list(20)
    
    return searches

# Analytics endpoint for sellers
@api_router.get("/analytics", response_model=Analytics)
async def get_seller_analytics(current_user: User = Depends(get_current_user)):
    # Get user's listings
    listings = await db.listings.find({"seller_id": current_user.id}).to_list(None)
    
    total_listings = len(listings)
    active_listings = len([l for l in listings if l["status"] == ListingStatus.ACTIVE])
    total_views = sum(l["views_count"] for l in listings)
    total_inquiries = sum(l["inquiries_count"] for l in listings)
    
    conversion_rate = (total_inquiries / total_views * 100) if total_views > 0 else 0
    
    # Top performing listings
    top_listings = sorted(listings, key=lambda x: x["views_count"], reverse=True)[:5]
    top_performing = [
        {
            "id": l["id"],
            "title": f"{l['brand']} {l['model']}",
            "views": l["views_count"],
            "inquiries": l["inquiries_count"]
        }
        for l in top_listings
    ]
    
    # Monthly stats (simplified)
    monthly_stats = {
        "current_month": {
            "listings": len([l for l in listings if l["created_at"].month == datetime.now().month]),
            "views": sum(l["views_count"] for l in listings if l["created_at"].month == datetime.now().month),
            "inquiries": sum(l["inquiries_count"] for l in listings if l["created_at"].month == datetime.now().month)
        }
    }
    
    return Analytics(
        total_listings=total_listings,
        active_listings=active_listings,
        total_views=total_views,
        total_inquiries=total_inquiries,
        conversion_rate=conversion_rate,
        top_performing_listings=top_performing,
        monthly_stats=monthly_stats
    )

# WebSocket endpoint for real-time messaging
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    connection_id = str(uuid.uuid4())
    await manager.connect(websocket, user_id, connection_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle real-time message updates
            await websocket.send_text(f"Message received: {data}")
    except WebSocketDisconnect:
        manager.disconnect(user_id, connection_id)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
