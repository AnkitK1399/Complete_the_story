from backend.db.base_class import Base
from sqlalchemy import Column, Integer, String


class Job_status(Base):
    __tablename__ = "job_status"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(255), nullable=False, unique=True)
    status = Column(String(50), nullable=False)