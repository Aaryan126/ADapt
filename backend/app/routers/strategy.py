import json
from fastapi import APIRouter
from app.models import StrategyRequest, LocalizationStrategy
from app.services.gmi_client import chat_completion
from app.config import get_settings

router = APIRouter()


def build_strategy_prompt(req: StrategyRequest) -> str:
    market = req.market
    ad = req.ad_info
    custom = req.custom_instructions

    prompt = f"""You are an expert ad localization strategist for Southeast Asian markets.

## Original Ad
- Product/Service: {ad.product}
- Headline: {ad.headline}
- Body Copy: {ad.body_copy}
- CTA: {ad.cta}
- Visual Style: {ad.visual_style}
- Brand Identity: {ad.brand_identity}
{f'- Raw Description: {ad.raw_text}' if ad.raw_text else ''}

## Target Market: {market.name} ({market.code})
- Primary Language: {market.primary_language}
- Secondary Languages: {', '.join(market.secondary_languages)}
- Cultural Context: {market.cultural_context}
- Key Festivals: {market.festivals}
- Values: {market.values}
- Humor Style: {market.humor_style}
- Taboos: {market.taboos}
- Local Reference Brands: {market.local_brands}
- Preferred Platforms: {', '.join(market.preferred_platforms)}
"""

    if custom:
        parts = []
        if custom.tone:
            parts.append(f"- Tone: {custom.tone}")
        if custom.language_mix:
            parts.append(f"- Language Mix: {custom.language_mix}")
        if custom.audience_segment:
            parts.append(f"- Audience: {custom.audience_segment}")
        if custom.platform:
            parts.append(f"- Platform: {custom.platform}")
        if custom.freeform_notes:
            parts.append(f"- Notes: {custom.freeform_notes}")
        if parts:
            prompt += "\n## Custom Instructions\n" + "\n".join(parts)

    prompt += """

## Task
Produce a localization strategy as JSON with this structure:
{
  "keep": ["list of elements to keep from the original ad and why"],
  "change": ["list of elements to change and what to change them to"],
  "reasoning": "overall strategic reasoning for the localization approach",
  "cultural_adaptations": ["specific cultural adaptations needed"],
  "language_decisions": "which languages to use, how to handle code-switching, dialect choices"
}

Be specific and actionable. Reference the target market's cultural context directly."""

    return prompt


@router.post("/strategy")
async def generate_strategy(req: StrategyRequest):
    settings = get_settings()
    prompt = build_strategy_prompt(req)

    try:
        result = await chat_completion(
            messages=[{"role": "user", "content": prompt}],
            model=settings.model_strategy,
            temperature=0.7,
            max_tokens=2000,
        )
    except Exception as e:
        return {"status": "error", "error": str(e)}

    try:
        start = result.find("{")
        end = result.rfind("}") + 1
        if start != -1 and end > start:
            parsed = json.loads(result[start:end])
            strategy = LocalizationStrategy(**parsed)
        else:
            strategy = LocalizationStrategy(reasoning=result)
    except (json.JSONDecodeError, ValueError):
        strategy = LocalizationStrategy(reasoning=result)

    return {
        "status": "ok",
        "data": {"strategy": strategy.model_dump(), "raw": result},
    }
