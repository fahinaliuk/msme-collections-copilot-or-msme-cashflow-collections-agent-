"""Authentication API routes."""

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.utils.rate_limiter import limiter
from backend.app.schemas import Token, UserOut, UserSignup
from backend.app.utils.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# Explicit OPTIONS handlers for CORS preflight. slowapi's @limiter.limit
# decorator can interfere with browser OPTIONS preflight requests, causing
# the server to return 400 instead of allowing CORSMiddleware to handle
# them. These handlers let the browser complete the CORS handshake so that
# the CORSMiddleware's send_wrapper can attach the Access-Control-Allow-Origin
# header matching the request origin.
@router.options("/signup")
@router.options("/login")
@router.options("/me")
async def auth_options():
    """Allow CORS preflight to complete when CORSMiddleware is bypassed."""
    return Response(status_code=200)


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def signup(request: Request, user_data: UserSignup, db: AsyncSession = Depends(get_db)):
    """Create a new user account."""
    # Check if user already exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing_user = result.scalars().first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address is already registered.",
        )

    # Hash the password and create the user record
    hashed_pwd = hash_password(user_data.password)
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_pwd,
        full_name=user_data.full_name,
        business_name=user_data.business_name,
    )
    
    db.add(new_user)
    await db.flush()  # Flushes to DB to obtain the auto-generated UUID
    
    # Generate access token
    access_token = create_access_token(data={"sub": str(new_user.id)})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(new_user),
    )


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Authenticate credentials and return a access token."""
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account has been deactivated.",
        )

    # Generate token
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Fetch the active authenticated user profile details."""
    return current_user
