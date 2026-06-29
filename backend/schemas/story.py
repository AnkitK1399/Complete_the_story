from pydantic import BaseModel, Field, model_validator
from typing import List, Dict, Optional
from datetime import datetime

class StoryCreate(BaseModel):
    # Field adds Extra metadeta and validation rule 
    theme: str = Field(..., min_length=5, description="The theme of the story to generate.")
    min_levels: int = Field(3, ge=2, le=100, description="Minimum depth/levels of the story branch.")
    max_levels: int = Field(4, ge=2, le=200, description="Maximum depth/levels of the story branch.")
    story_level: str = Field('Easy',choices=['Easy','Medium','Hard'])
    story_language: str = Field('English',choices=['English','Hindi'])

    @model_validator(mode="after")
    def validate_levels(self):
        if self.max_levels < self.min_levels:
            raise ValueError("max_levels must be greater than or equal to min_levels")
        return self


