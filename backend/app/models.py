from pydantic import BaseModel
from typing import Optional


class AdInfo(BaseModel):
    product: str = ""
    headline: str = ""
    body_copy: str = ""
    cta: str = ""
    visual_style: str = ""
    brand_identity: str = ""
    raw_text: str = ""


class MarketPreset(BaseModel):
    code: str
    name: str
    primary_language: str
    secondary_languages: list[str] = []
    cultural_context: str = ""
    local_brands: str = ""
    preferred_platforms: list[str] = []
    festivals: str = ""
    values: str = ""
    humor_style: str = ""
    taboos: str = ""


class CustomInstructions(BaseModel):
    tone: Optional[str] = None
    language_mix: Optional[str] = None
    audience_segment: Optional[str] = None
    platform: Optional[str] = None
    freeform_notes: Optional[str] = None


class StrategyRequest(BaseModel):
    ad_info: AdInfo
    market: MarketPreset
    custom_instructions: Optional[CustomInstructions] = None


class LocalizationStrategy(BaseModel):
    keep: list[str] = []
    change: list[str] = []
    reasoning: str = ""
    cultural_adaptations: list[str] = []
    language_decisions: str = ""


class LocalizedCopy(BaseModel):
    language: str
    headline: str
    body: str
    cta: str
    tone_notes: str = ""
    cultural_reasoning: str = ""


class ImageDirectionBrief(BaseModel):
    description: str
    style_notes: str = ""
    cultural_elements: list[str] = []
    colors: list[str] = []
    text_overlays: list[str] = []


class GenerateRequest(BaseModel):
    ad_info: AdInfo
    market: MarketPreset
    strategy: LocalizationStrategy
    custom_instructions: Optional[CustomInstructions] = None


class GenerateResponse(BaseModel):
    localized_copies: list[LocalizedCopy]
    image_brief: ImageDirectionBrief
    image_url: Optional[str] = None
    image_path: Optional[str] = None


class PipelineRequest(BaseModel):
    ad_text: Optional[str] = None
    market_code: str = "SG"
    custom_instructions: Optional[CustomInstructions] = None


class ApiResponse(BaseModel):
    status: str = "ok"
    data: dict = {}
    error: Optional[str] = None


class BillingEmailRequest(BaseModel):
    email: str


class BillingStatus(BaseModel):
    email: str
    active: bool = False
    status: str = "inactive"
    customer_id: Optional[str] = None
    subscription_id: Optional[str] = None
    current_period_end: Optional[str] = None
    checkout_url: Optional[str] = None
    portal_url: Optional[str] = None
