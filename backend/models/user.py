# pyrefly: ignore [missing-import]
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
# pyrefly: ignore [missing-import]
from sqlalchemy.sql import func
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import relationship
from backend.db.base_class import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    mobile = Column(String(20), nullable=False)
    gender = Column(String(20), nullable=False)
    score = Column(Integer, default=0, nullable=False)
    role = Column(String(20), default="user", nullable=False)

    plays = relationship("UserStoryPlay", back_populates="user", cascade="all, delete-orphan")


class UserStoryPlay(Base):
    __tablename__ = "user_story_plays"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    story_id = Column(Integer, ForeignKey("stories.id", ondelete="CASCADE"), nullable=False, index=True)
    played_at = Column(DateTime(timezone=True), server_default=func.now())
    outcome = Column(String(50), nullable=False)  

    user = relationship("User", back_populates="plays")
    story = relationship("Story")
