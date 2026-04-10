from pydantic_settings import BaseSettings
from functools import lru_cache
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))


class Settings(BaseSettings):
    gmi_api_key: str = ""
    gmi_base_url: str = "https://api.gmi-serving.com/v1"
    gmi_queue_url: str = "https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey"

    # Model assignments (verified against GMI Cloud model list)
    model_image_analysis: str = "openai/gpt-5.4"
    model_strategy: str = "zai-org/GLM-5.1-FP8"
    model_copywriting: str = "zai-org/GLM-5.1-FP8"
    model_image_gen: str = "gemini-3.1-flash-image-preview"  # queue-based API
    model_direct_edit: str = "gemini-3.1-flash-image-preview"  # queue-based, supports image input

    # Publer (social media publishing)
    publer_api_key: str = ""
    publer_workspace_id: str = ""
    publer_tiktok_account_id: str = ""

    class Config:
        env_prefix = ""
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
