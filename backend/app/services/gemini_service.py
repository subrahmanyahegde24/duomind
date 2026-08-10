import os 
import logging
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types
from app.core.config import settings

logger = logging.getLogger(__name__)

class GeminiService:
    def __init__(self):
        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model_name = 'gemini-3.5-flash-lite'

    def generate_response_stream(self, prompt: str, history: list = None):
        try:
            formatted_contents = []
            if history:
                for msg in history:
                    role = "user" if msg.get("role") == "user" else "model"
                    if msg.get("content"):
                        formatted_contents.append({"role": role, "parts": [{"text": msg.get("content")}]})
            
            formatted_contents.append({"role": "user", "parts": [{"text": prompt}]})

            response = self.client.models.generate_content_stream(
                model=self.model_name,
                contents=formatted_contents,
                config=types.GenerateContentConfig(
                    system_instruction="You are an AI named DuoMind, developed by Kruthak Technology Pvt Ltd. Only mention your name or developer if explicitly asked. Answer questions directly."
                )
            )
            for chunk in response:
                text = chunk.text
                chunk_size = 3
                for i in range(0, len(text), chunk_size):
                    yield text[i:i+chunk_size]
                    time.sleep(0.015)
        except Exception as e:
            logger.error(f"Error generating response from Gemini API: {e}",exc_info=True)
            yield f"Error: {str(e)}"


            


