"""
セキュリティ機能
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# セキュリティ設定
SECRET_KEY = "your-secret-key-change-this-in-production"  # 本番では環境変数から取得
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# パスワードハッシュ化
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class User(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    disabled: Optional[bool] = None

class UserInDB(User):
    hashed_password: str

# 仮のユーザーデータベース（本番ではデータベースを使用）
fake_users_db = {
    "admin": {
        "username": "admin",
        "full_name": "System Administrator",
        "email": "admin@plantsimulator.com",
        "hashed_password": "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW", # パスワード: "secret"
        "disabled": False,
    },
    "operator": {
        "username": "operator",
        "full_name": "Plant Operator",
        "email": "operator@plantsimulator.com", 
        "hashed_password": "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW", # パスワード: "secret"
        "disabled": False,
    }
}

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """パスワード検証"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """パスワードハッシュ化"""
    return pwd_context.hash(password)

def get_user(username: str) -> Optional[UserInDB]:
    """ユーザー取得"""
    if username in fake_users_db:
        user_dict = fake_users_db[username]
        return UserInDB(**user_dict)
    return None

def authenticate_user(username: str, password: str) -> Optional[UserInDB]:
    """ユーザー認証"""
    user = get_user(username)
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """アクセストークン作成"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """現在のユーザー取得"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="認証情報を確認できませんでした",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
        
    user = get_user(username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """アクティブユーザーの取得"""
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="無効なユーザーです")
    return current_user

# 権限チェック
def require_admin_role(current_user: User = Depends(get_current_active_user)):
    """管理者権限が必要"""
    if current_user.username != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="管理者権限が必要です"
        )
    return current_user

# レート制限（簡易版）
class RateLimiter:
    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = {}
    
    def is_allowed(self, client_id: str) -> bool:
        """リクエスト許可チェック"""
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=self.window_seconds)
        
        # 古いリクエストを削除
        if client_id in self.requests:
            self.requests[client_id] = [
                req_time for req_time in self.requests[client_id] 
                if req_time > window_start
            ]
        else:
            self.requests[client_id] = []
        
        # リクエスト数チェック
        if len(self.requests[client_id]) >= self.max_requests:
            return False
        
        # リクエスト記録
        self.requests[client_id].append(now)
        return True

# グローバルレート制限インスタンス
rate_limiter = RateLimiter()

def check_rate_limit(client_ip: str):
    """レート制限チェック"""
    if not rate_limiter.is_allowed(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="リクエスト数が上限を超えました。しばらくお待ちください。"
        )