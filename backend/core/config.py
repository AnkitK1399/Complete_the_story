from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )
    
    DATABASE_URL: str = "sqlite:///./complete_the_story.db"
    REDIS_URL: str = "redis://localhost:6379/0"
    GEMINI_API_KEY: str = ""

settings = Settings()
