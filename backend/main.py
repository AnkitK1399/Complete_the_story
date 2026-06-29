from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.db.session import engine
from backend.db.base_class import Base
from backend.routers.stories import router as stories_router
from backend.routers.auth import router as auth_router, users_router
import backend.models  # Ensures models are imported so Base.metadata knows about them

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Complete the Story API",
    description="Backend API for the Complete the Story application",
    version="1.0.0",
)

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust as needed for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(stories_router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Welcome to Complete the Story API"}

