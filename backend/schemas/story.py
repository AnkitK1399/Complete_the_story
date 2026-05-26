from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from datetime import datetime

class StoryCreate(BaseModel):
    theme: str = Field(..., description="The theme of the story to generate.")


