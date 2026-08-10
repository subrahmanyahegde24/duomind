from functools import lru_cache
from app.services.gemini_service import GeminiService


@lru_cache()
def get_gemini_service() -> GeminiService:
    return GeminiService()

