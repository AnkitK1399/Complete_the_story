from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class StoryOptionLLM(BaseModel):
    text: str 
    next_node: Dict[str, Any] 

class StoryNodeLLM(BaseModel):
    content: str 
    is_ending: bool 
    is_winning_ending: bool 
    options: List[StoryOptionLLM] = Field(default_factory=list)


class StoryLLMResponse(BaseModel):
    title: str 
    rootNode: StoryNodeLLM 
    