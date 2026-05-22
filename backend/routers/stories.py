import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.db.session import get_db
from backend.models.story import Story as DBStory
from backend.schemas.story import StoryCreate, StoryResponse, TaskStatusResponse
from backend.core.celery_app import celery_app
from celery.result import AsyncResult

router = APIRouter(prefix="/stories", tags=["stories"])

@router.post("/generate", status_code=status.HTTP_202_ACCEPTED)
def generate_story(payload: StoryCreate):
    from backend.core.celery_tasks import generate_story_task
    # Trigger background Celery task
    task = generate_story_task.delay(theme=payload.theme)
    return {"task_id": task.id, "status": task.status}

@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
def get_task_status(task_id: str, db: Session = Depends(get_db)):
    result = AsyncResult(task_id, app=celery_app)
    
    if result.state == "SUCCESS":
        story_result = result.result
        return {
            "task_id": task_id,
            "status": result.state,
            "result": story_result
        }
    elif result.state == "FAILURE":
        return {
            "task_id": task_id,
            "status": result.state,
            "error": str(result.info)
        }
    else:
        return {
            "task_id": task_id,
            "status": result.state
        }

@router.get("/", response_model=List[StoryResponse])
def list_stories(db: Session = Depends(get_db)):
    db_stories = db.query(DBStory).all()
    stories = []
    for s in db_stories:
        try:
            stories.append(json.loads(s.story_data))
        except Exception:
            continue
    return stories

@router.get("/{story_id}", response_model=StoryResponse)
def get_story(story_id: str, db: Session = Depends(get_db)):
    db_story = db.query(DBStory).filter(DBStory.id == story_id).first()
    if not db_story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Story not found"
        )
    return json.loads(db_story.story_data)
