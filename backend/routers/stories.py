from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from backend.db.session import get_db 
from backend.schemas.story import StoryCreate
from backend.models.story import Story, StoryNode
from backend.core.celery_app import celery_app
from celery.result import AsyncResult
from backend.core.celery_tasks import generate_story_task
router = APIRouter(prefix="/stories", tags=["stories"])

@router.post("/generate", status_code=status.HTTP_202_ACCEPTED)
def generate_story(payload: StoryCreate):
    task = generate_story_task.delay(theme=payload.theme)

    return {
        "task_id": task.id,
        "message": "Story generation started. Use the task_id to check the status."
    }

@router.get("/tasks/{task_id}")
def get_task_status(task_id: str):
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



@router.get("/{story_id}")
def get_story(story_id: int, db: Session = Depends(get_db)):
    db_story = db.query(Story).filter(Story.id == story_id).first()
    if not db_story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Story not found"
        )
    
    complete_story = build_complete_story(db_story, db)

    return {
        "id": db_story.id,
        "title": db_story.title,
        "nodes": complete_story,
    }

def build_complete_story(db_story: Story, db: Session):
    story_node = db.query(StoryNode).filter(StoryNode.story_id == db_story.id).all()
    story_list = []
    for node in story_node:
       s = {
        "id": node.id,
        "content": node.content,
        "is_ending": node.is_ending,
        "is_winning_ending": node.is_winning_ending,
        "options": node.options
        }
       story_list.append(s)

    return story_list

@router.get("/")
def home():
    return {
        "message": "Story API is running successfully"
    }