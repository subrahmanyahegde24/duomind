from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import chat
import logging

logging.basicConfig(level=logging.INFO)

def create_app() -> FastAPI:
    app = FastAPI(title="DuoMind API", version="1.0.0")

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Adjust this to your needs
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include the chat router
    app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])

    @app.get("/health", tags=["Health"])
    async def health_check():
        return {"status": "healthy"}
    
    return app

app = create_app()
