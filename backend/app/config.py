from pydantic_settings import BaseSettings
from functools import lru_cache
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))


class Settings(BaseSettings):
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    app_base_url: str = "http://localhost:8000"
    frontend_base_url: str = "http://localhost:5173"

    # Model assignments
    model_image_analysis: str = "gpt-4.1-mini"
    model_strategy: str = "gpt-4.1"
    model_copywriting: str = "gpt-4.1"
    model_image_gen: str = "gpt-image-1"
    model_direct_edit: str = "gpt-image-1"

    # Publer (social media publishing)
    publer_api_key: str = ""
    publer_workspace_id: str = ""
    publer_tiktok_account_id: str = ""

    # Stripe billing
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_id: str = ""
    stripe_plan_name: str = "ADapt Pro"
    stripe_price_display: str = "$29/month"
    stripe_publishable_key: str = ""

    class Config:
        env_prefix = ""
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
