from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import List, Optional

class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    mobile: str = Field(..., min_length=10, max_length=15)
    gender: str = Field(..., description="e.g., Male, Female, Other")

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    username: str
    role: str

class UserProfile(BaseModel):
    id: int
    username: str
    name: str
    email: EmailStr
    mobile: str
    gender: str
    score: int
    role: str

    class Config:
        from_attributes = True

class UserScoreboard(BaseModel):
    username: str
    score: int

    class Config:
        from_attributes = True

class UserHistoryItem(BaseModel):
    story_id: int
    story_title: str
    played_at: datetime
    outcome: str

class StoryPlayCreate(BaseModel):
    outcome: str = Field(..., pattern="^(win|loss)$", description="Must be 'win' or 'loss'")

class AdminUserListItem(BaseModel):
    serial_no: int
    id: int
    name: str
    api_calls: int
    wins: int
    losses: int
    total_score: int

    class Config:
        from_attributes = True

class AdminStoryListItem(BaseModel):
    story_title: str
    username: str
    outcome: str

    class Config:
        from_attributes = True
