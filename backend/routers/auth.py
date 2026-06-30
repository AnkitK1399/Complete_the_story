import random
import re
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List

from backend.db.session import get_db
from backend.models import User, UserStoryPlay, Story

from backend.schemas.auth import UserRegister, UserLogin, Token, UserProfile, UserScoreboard, UserHistoryItem, AdminUserListItem, AdminStoryListItem
from backend.core.security import hash_password, verify_password, create_access_token, decode_access_token

router = APIRouter(prefix="/auth", tags=["auth"])
users_router = APIRouter(prefix="/users", tags=["users"])

security_scheme = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    username = payload["sub"]
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user

def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough privileges")
    return current_user

def generate_unique_username(name: str, db: Session) -> str:
    
    base = re.sub(r'[^a-zA-Z0-9]', '', name).lower()
    if not base:
        base = "user"
    
    
    while True:
        suffix = random.randint(1000, 9999)
        username = f"{base}{suffix}"
        
        exists = db.query(User).filter(User.username == username).first()
        if not exists:
            return username

@router.post("/register", response_model=UserProfile, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    username = generate_unique_username(payload.name, db)
    hashed_pwd = hash_password(payload.password)
    
    db_user = User(
        username=username,
        name=payload.name,
        email=payload.email,
        password_hash=hashed_pwd,
        mobile=payload.mobile,
        gender=payload.gender,
        score=0
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect username or password"
        )
    
    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role
    }

@users_router.get("/me", response_model=UserProfile)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@users_router.get("/scoreboard", response_model=List[UserScoreboard])
def get_scoreboard(db: Session = Depends(get_db)):
    # Order by score descending
    users = db.query(User).order_by(User.score.desc()).all()
    return users

@users_router.get("/history", response_model=List[UserHistoryItem])
def get_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    plays = db.query(UserStoryPlay).filter(
        UserStoryPlay.user_id == current_user.id
    ).order_by(UserStoryPlay.played_at.desc()).all()
    
    history_items = []
    for play in plays:
        story = db.query(Story).filter(Story.id == play.story_id).first()
        story_title = story.title if story else "Unknown Story"
        history_items.append({
            "story_id": story.id if story else 0,
            "story_title": story_title,
            "played_at": play.played_at,
            "outcome": play.outcome
        })
    return history_items

@users_router.get("/stats")
def get_admin_stats(
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    total_players = db.query(User).count()
    total_stories = db.query(Story).count()
    return {"total_players": total_players, "total_stories": total_stories}

@users_router.get("/all", response_model=List[AdminUserListItem])
def get_all_users(
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    result = []
    for idx, u in enumerate(users):
        plays = db.query(UserStoryPlay).filter(UserStoryPlay.user_id == u.id).all()
        wins = sum(1 for p in plays if p.outcome == "win")
        losses = sum(1 for p in plays if p.outcome == "loss")
        result.append({
            "serial_no": idx + 1,
            "id": u.id,
            "name": u.name,
            "api_calls": len(plays),
            "wins": wins,
            "losses": losses,
            "total_score": u.score
        })
    return result

@users_router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}

@users_router.get("/{user_id}/stories", response_model=List[UserHistoryItem])
def get_user_stories(
    user_id: int,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    plays = db.query(UserStoryPlay).filter(UserStoryPlay.user_id == user_id).order_by(UserStoryPlay.played_at.desc()).all()
    history_items = []
    for play in plays:
        story = db.query(Story).filter(Story.id == play.story_id).first()
        history_items.append({
            "story_id": story.id if story else 0,
            "story_title": story.title if story else "Unknown Story",
            "played_at": play.played_at,
            "outcome": play.outcome
        })
    return history_items
