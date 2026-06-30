from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from backend.db.session import get_db 
from backend.schemas.story import StoryCreate
from backend.schemas.auth import StoryPlayCreate, AdminStoryListItem
from backend.models import Story, StoryNode, User, UserStoryPlay

from backend.core.celery_app import celery_app
# pyrefly: ignore [missing-import]
from celery.result import AsyncResult
from backend.core.celery_tasks import generate_story_task
from backend.routers.auth import get_current_user, get_admin_user

router = APIRouter(prefix="/stories", tags=["stories"])

@router.get("/all_plays", response_model=List[AdminStoryListItem])
def get_all_plays(
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    plays = db.query(UserStoryPlay).order_by(UserStoryPlay.played_at.desc()).all()
    result = []
    for p in plays:
        story = db.query(Story).filter(Story.id == p.story_id).first()
        user = db.query(User).filter(User.id == p.user_id).first()
        result.append({
            "story_title": story.title if story else "Unknown Story",
            "username": user.username if user else "Unknown User",
            "outcome": p.outcome
        })
    return result

@router.post("/generate", status_code=status.HTTP_202_ACCEPTED)
def generate_story(
    payload: StoryCreate,
    current_user: User = Depends(get_current_user)
):
    task = generate_story_task.delay(
        theme=payload.theme,
        min_levels=payload.min_levels,
        max_levels=payload.max_levels
    )

    return {
        "task_id": task.id,
        "message": "Story generation started. Use the task_id to check the status."
    }

@router.get("/tasks/{task_id}")
def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
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
def get_story(
    story_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
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
    story_nodes = db.query(StoryNode).filter(StoryNode.story_id == db_story.id).all()
    story_list = []
    for node in story_nodes:
        s = {
            "id": node.id,
            "content": node.content,
            "is_ending": node.is_ending,
            "is_winning_ending": node.is_winning_ending,
            "options": node.options
        }
        story_list.append(s)

    return story_list


@router.post("/{story_id}/play", status_code=status.HTTP_200_OK)
def record_story_play(
    story_id: int,
    payload: StoryPlayCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_story = db.query(Story).filter(Story.id == story_id).first()
    if not db_story:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Story not found"
        )
    
    score_change = 0
    if payload.outcome == "win":
        score_change = 50
    elif payload.outcome == "loss":
        # loosing will not be deducted if he has less than 20 score
        if current_user.score >= 20:
            score_change = -20
            
    current_user.score += score_change
    
    play_record = UserStoryPlay(
        user_id=current_user.id,
        story_id=story_id,
        outcome=payload.outcome
    )
    db.add(play_record)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    
    return {
        "message": f"Play recorded successfully. Outcome: {payload.outcome}.",
        "score_change": score_change,
        "new_score": current_user.score
    }


@router.get("/")
def home():
    return {
        "message": "Story API is running successfully"
    }