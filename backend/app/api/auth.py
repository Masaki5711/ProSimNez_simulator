"""
認証関連のAPIエンドポイント
"""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from app.core.security import (
    authenticate_user, create_access_token, get_current_active_user,
    ACCESS_TOKEN_EXPIRE_MINUTES, Token, User
)

router = APIRouter()

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """ユーザーログイン"""
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ユーザー名またはパスワードが正しくありません",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """現在のユーザー情報取得"""
    return current_user

@router.post("/logout")
async def logout(current_user: User = Depends(get_current_active_user)):
    """ログアウト（トークン無効化は実装していません）"""
    return {"message": "ログアウトしました"}

@router.get("/test-auth")
async def test_auth(current_user: User = Depends(get_current_active_user)):
    """認証テスト用エンドポイント"""
    return {"message": f"Hello {current_user.username}! 認証が成功しました。"}