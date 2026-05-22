import json
import uuid
from datetime import datetime
import google.generativeai as genai
from backend.core.config import settings
from backend.core.celery_app import celery_app
from backend.db.session import SessionLocal
from backend.models.story import Story as DBStory
from backend.schemas.story import AIGeneratedStory, StoryNode

@celery_app.task(name="generate_story_task", bind=True)
def generate_story_task(self, theme: str):
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured in settings.")
        
    # Configure Gemini API
    genai.configure(api_key=settings.GEMINI_API_KEY)
    
    # Prompt instructing the model to generate the story tree structure
    prompt = f"""
    Create a highly engaging choose-your-own-adventure (CYOA) story based on the theme: "{theme}".
    
    The story must adhere strictly to these rules:
    1. Create a root node with ID "root" which starts the adventure.
    2. Design multiple options/choices for the reader at each node that lead to other node IDs.
    3. The choices must branch out, with at least 5-8 total story nodes.
    4. At least one path of choices MUST lead to a clear, satisfying "win" (is_winning = true).
    5. At least one path can lead to a "loss" or "game over" (is_losing = true).
    6. For winning and losing nodes, the "options" list must be completely empty.
    7. Each node must have unique ID (e.g. "root", "explore_corridor", "open_box", "escape", "trapped").
    """
    
    # Initialize the standard gemini-1.5-flash model
    model = genai.GenerativeModel("gemini-2.5-flash")
    
    # Generate content with structured JSON matching our AIGeneratedStory Pydantic model
    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            response_schema=AIGeneratedStory,
            temperature=0.7
        )
    )
    
    # Parse output JSON
    generated_data = json.loads(response.text)
    
    # Validate with Pydantic model
    validated_ai_story = AIGeneratedStory(**generated_data)
    
    # Convert list of nodes to a flat dictionary mapped by node ID
    nodes_dict = {}
    for node in validated_ai_story.nodes:
        nodes_dict[node.id] = StoryNode(
            id=node.id,
            title=node.title,
            content=node.content,
            is_winning=node.is_winning,
            is_losing=node.is_losing,
            options=node.options
        )
        
    # Ensure root_node_id exists in nodes_dict
    root_id = validated_ai_story.root_node_id
    if root_id not in nodes_dict:
        if "root" in nodes_dict:
            root_id = "root"
        elif nodes_dict:
            root_id = next(iter(nodes_dict.keys()))
        else:
            raise ValueError("AI failed to generate any valid story nodes.")
            
    # Ensure at least one winning path exists
    has_win = any(node.is_winning for node in nodes_dict.values())
    if not has_win and nodes_dict:
        # Fallback: make the first leaf node a winning node
        for node in nodes_dict.values():
            if not node.options and not node.is_losing:
                node.is_winning = True
                break
                
    story_id = str(uuid.uuid4())
    
    # Build complete StoryResponse JSON structure
    story_response = {
        "id": story_id,
        "title": validated_ai_story.title,
        "theme": theme,
        "root_node_id": root_id,
        "nodes": {k: v.model_dump() for k, v in nodes_dict.items()},
        "created_at": datetime.utcnow().isoformat()
    }
    
    # Write to SQLite database
    db = SessionLocal()
    try:
        db_story = DBStory(
            id=story_id,
            title=validated_ai_story.title,
            theme=theme,
            story_data=json.dumps(story_response)
        )
        db.add(db_story)
        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()
        
    return story_response
