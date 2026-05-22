import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text
from backend.db.base_class import Base

class Story(Base):
    __tablename__ = "stories"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    theme = Column(String(255), nullable=False)
    story_data = Column(Text, nullable=False)  # JSON-encoded StoryResponse dictionary
    created_at = Column(DateTime, default=datetime.utcnow)
