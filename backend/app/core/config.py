from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    gemini_api_key: str
    supabase_url: str
    supabase_key: str
    mongo_uri: str
    encryption_key: str | None = None
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8",extra="ignore")

# Instantiate a global settings object 
settings = Settings()



