from pydantic_settings import BaseSettings, SettingsConfigDict


from typing import Optional

class Settings(BaseSettings):
    gemini_api_key: str
    supabase_url: str
    supabase_key: str
    mongo_uri: str
    encryption_key: Optional[str] = None
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8",extra="ignore")

# Instantiate a global settings object 
settings = Settings()



