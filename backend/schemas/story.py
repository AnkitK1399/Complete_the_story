from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from datetime import datetime

class StoryOption(BaseModel):
    text: str = Field(..., description="The label text for the player choice.")
    target_node_id: str = Field(..., description="The ID of the story node this option leads to.")

class StoryNode(BaseModel):
    id: str = Field(..., description="Unique identifier for the story node.")
    title: str = Field(..., description="A short, catchy subtitle or location name for this section.")
    content: str = Field(..., description="The narrative text of the story at this stage.")
    is_winning: bool = Field(False, description="Set to true if selecting this path successfully completes the story.")
    is_losing: bool = Field(False, description="Set to true if selecting this path leads to failure/death/game over.")
    options: List[StoryOption] = Field(default=[], description="List of choices leading to other nodes. Must be empty if is_winning or is_losing is true.")

class StoryCreate(BaseModel):
    theme: str = Field(..., description="The theme of the story to generate.")

class StoryResponse(BaseModel):
    id: str
    title: str
    theme: str
    root_node_id: str
    nodes: Dict[str, StoryNode]
    created_at: datetime

    class Config:
        from_attributes = True

class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    result: Optional[StoryResponse] = None
    error: Optional[str] = None

# AI Structured Generation Schemas
class AISortNode(BaseModel):
    id: str
    title: str
    content: str
    is_winning: bool
    is_losing: bool
    options: List[StoryOption]

class AIGeneratedStory(BaseModel):
    title: str
    theme: str
    root_node_id: str
    nodes: List[AISortNode]
