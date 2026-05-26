import json
import google.generativeai as genai

from sqlalchemy.orm import Session

from backend.core import prompts
from backend.core.models import StoryLLMResponse, StoryNodeLLM
from backend.core.config import settings
from backend.core.celery_app import celery_app

from backend.db.session import SessionLocal

from backend.models.story import Story, StoryNode


@celery_app.task(name="generate_story_task", bind=True)
def generate_story_task(self, theme: str):

    db = SessionLocal()

    try:

        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is not configured in settings.")

        genai.configure(api_key=settings.GEMINI_API_KEY)

        prompt = prompts.STORY_PROMPT.format(theme=theme)

        model = genai.GenerativeModel("gemini-2.5-flash")

        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.5
            )
        )

        generated_data = json.loads(response.text)

        validated_ai_story = StoryLLMResponse.model_validate(
            generated_data
        )

        story_response = Story(
            title=validated_ai_story.title
        )

        db.add(story_response)

        db.flush()

        root_node = validated_ai_story.rootNode

        if isinstance(root_node, dict):
            root_node = StoryNodeLLM.model_validate(root_node)

        process_story_node(
            node=root_node,
            story_id=story_response.id,
            is_root=True,
            db=db
        )

        db.commit()

        db.refresh(story_response)

        return {
            "id": story_response.id,
            "title": story_response.title
        }

    except Exception as e:

        db.rollback()

        raise e

    finally:

        db.close()


def process_story_node(
    node: StoryNodeLLM,
    story_id: int,
    is_root: bool = False,
    db: Session = None
) -> StoryNode:

    story_node = StoryNode(
        story_id=story_id,
        content=node.content,
        is_root=is_root,
        is_ending=node.is_ending,
        is_winning_ending=node.is_winning_ending,
        options=[]
    )

    db.add(story_node)

    db.flush()

    if not node.is_ending and node.options:

        options_data = []

        for option in node.options:

            next_node = option.next_node

            if isinstance(next_node, dict):
                next_node = StoryNodeLLM.model_validate(
                    next_node
                )

            child_node = process_story_node(
                node=next_node,
                story_id=story_id,
                is_root=False,
                db=db
            )

            options_data.append({
                "text": option.text,
                "next_node_id": child_node.id
            })

        story_node.options = options_data

        db.add(story_node)

        db.flush()

    return story_node

