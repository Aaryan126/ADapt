import json
import logging
import time
import uuid
from pathlib import Path
from fastapi import APIRouter
from app.models import (
    GenerateRequest,
    GenerateResponse,
    LocalizedCopy,
    ImageDirectionBrief,
)
from app.services.gmi_client import chat_completion, generate_image
from app.config import get_settings

logger = logging.getLogger("ad-gen")

router = APIRouter()

OUTPUT_DIR = Path(__file__).parent.parent.parent.parent / "output"


def build_copy_prompt(req: GenerateRequest) -> str:
    market = req.market
    ad = req.ad_info
    strategy = req.strategy
    custom = req.custom_instructions

    prompt = f"""You are an expert multilingual ad copywriter for Southeast Asian markets.

## Original Ad
- Product: {ad.product}
- Headline: {ad.headline}
- Body: {ad.body_copy}
- CTA: {ad.cta}

## Target Market: {market.name}
- Primary Language: {market.primary_language}
- Secondary Languages: {', '.join(market.secondary_languages)}

## Localization Strategy
- Keep: {json.dumps(strategy.keep)}
- Change: {json.dumps(strategy.change)}
- Cultural Adaptations: {json.dumps(strategy.cultural_adaptations)}
- Language Decisions: {strategy.language_decisions}
"""

    if custom:
        if custom.tone:
            prompt += f"\n- Tone Override: {custom.tone}"
        if custom.language_mix:
            prompt += f"\n- Language Mix: {custom.language_mix}"
        if custom.audience_segment:
            prompt += f"\n- Audience: {custom.audience_segment}"
        if custom.platform:
            prompt += f"\n- Platform: {custom.platform}"

    prompt += """

## Task
Generate localized ad copy for EACH target language (primary + secondary). Return as JSON:
{
  "copies": [
    {
      "language": "language name",
      "headline": "localized headline",
      "body": "localized body copy",
      "cta": "localized call to action",
      "tone_notes": "notes on tone choices",
      "cultural_reasoning": "why these choices work for this market"
    }
  ]
}

Make each version feel native, not translated. Use local idioms, slang, and cultural references where appropriate."""

    return prompt


def build_image_brief_prompt(req: GenerateRequest, copies: list[LocalizedCopy]) -> str:
    ad = req.ad_info
    market = req.market
    strategy = req.strategy

    primary_copy = copies[0] if copies else None

    prompt = f"""You are a creative director specializing in Southeast Asian advertising visuals.

## Original Ad Visual Style
{ad.visual_style}

## Brand Identity
{ad.brand_identity}

## Target Market: {market.name}
- Cultural Context: {market.cultural_context}
- Values: {market.values}
- Taboos: {market.taboos}

## Localization Strategy
- Cultural Adaptations: {json.dumps(strategy.cultural_adaptations)}

## Primary Localized Headline
{primary_copy.headline if primary_copy else ad.headline}

## Task
Create a detailed image direction brief for the localized ad visual. Return as JSON:
{{
  "description": "detailed description of what the localized visual should look like (2-3 paragraphs)",
  "style_notes": "notes on visual style, photography direction, design elements",
  "cultural_elements": ["list of cultural elements to include"],
  "colors": ["recommended color palette"],
  "text_overlays": ["text that should appear on the image"]
}}

The visual should feel authentic to {market.name}, not like a translated Western ad."""

    return prompt


@router.post("/generate")
async def generate_outputs(req: GenerateRequest):
    settings = get_settings()

    # Step 5a: Generate localized copies
    logger.info(f"[STEP 5a] Generating localized ad copy (model={settings.model_copywriting})")
    step_start = time.time()
    copy_prompt = build_copy_prompt(req)
    copy_result = await chat_completion(
        messages=[{"role": "user", "content": copy_prompt}],
        model=settings.model_copywriting,
        temperature=0.7,
        max_tokens=3000,
    )
    logger.info(f"[STEP 5a] Ad copy generated in {time.time() - step_start:.1f}s")

    copies = []
    try:
        start = copy_result.find("{")
        end = copy_result.rfind("}") + 1
        if start != -1 and end > start:
            parsed = json.loads(copy_result[start:end])
            for c in parsed.get("copies", []):
                copies.append(LocalizedCopy(**c))
    except (json.JSONDecodeError, ValueError):
        pass

    if not copies:
        copies = [LocalizedCopy(
            language="raw",
            headline="",
            body=copy_result,
            cta="",
        )]
        logger.warning("[STEP 5a] Could not parse copies JSON, using raw text")
    else:
        langs = [c.language for c in copies]
        logger.info(f"[STEP 5a] Generated {len(copies)} copy versions: {', '.join(langs)}")

    # Step 5b: Generate image direction brief
    logger.info(f"[STEP 5b] Generating image direction brief (model={settings.model_copywriting})")
    step_start = time.time()
    brief_prompt = build_image_brief_prompt(req, copies)
    brief_result = await chat_completion(
        messages=[{"role": "user", "content": brief_prompt}],
        model=settings.model_copywriting,
        temperature=0.7,
        max_tokens=2000,
    )
    logger.info(f"[STEP 5b] Image brief generated in {time.time() - step_start:.1f}s")

    image_brief = ImageDirectionBrief(description=brief_result)
    try:
        start = brief_result.find("{")
        end = brief_result.rfind("}") + 1
        if start != -1 and end > start:
            parsed = json.loads(brief_result[start:end])
            image_brief = ImageDirectionBrief(**parsed)
            logger.info(f"[STEP 5b] Brief parsed: {len(image_brief.cultural_elements)} cultural elements, {len(image_brief.colors)} colors")
    except (json.JSONDecodeError, ValueError):
        logger.warning("[STEP 5b] Could not parse brief JSON, using raw text")

    # Step 5c: Generate localized ad image
    image_gen_prompt = f"""Create an advertisement image for {req.market.name} market.

{image_brief.description}

Style: {image_brief.style_notes}
Cultural elements: {', '.join(image_brief.cultural_elements)}
Colors: {', '.join(image_brief.colors)}
Text overlays: {', '.join(image_brief.text_overlays)}"""

    logger.info(f"[STEP 5c] Generating ad image (model={settings.model_image_gen})")
    step_start = time.time()
    try:
        image_result = await generate_image(image_gen_prompt)
    except Exception as e:
        logger.error(f"[STEP 5c] Image generation error: {e}")
        image_result = None
    logger.info(f"[STEP 5c] Image generation finished in {time.time() - step_start:.1f}s (success={image_result is not None})")

    image_path = None
    image_url = None
    if image_result:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        file_id = uuid.uuid4().hex[:8]
        if image_result.startswith("http"):
            image_url = image_result
            # Download the image and save locally
            import httpx
            try:
                logger.info(f"[STEP 5c] Downloading generated image...")
                async with httpx.AsyncClient(timeout=30) as dl_client:
                    img_resp = await dl_client.get(image_url)
                    img_resp.raise_for_status()
                    image_path = str(OUTPUT_DIR / f"ad_{req.market.code}_{file_id}.png")
                    with open(image_path, "wb") as f:
                        f.write(img_resp.content)
                    logger.info(f"[STEP 5c] Image saved to {image_path} ({len(img_resp.content)} bytes)")
            except Exception as e:
                logger.error(f"[STEP 5c] Failed to download image: {e}")
        else:
            # Save as text fallback
            image_path = str(OUTPUT_DIR / f"ad_{req.market.code}_{file_id}_brief.txt")
            with open(image_path, "w") as f:
                f.write(image_result)
            logger.info(f"[STEP 5c] Image result saved as text to {image_path}")

    # Save full results to JSON
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    result_file = OUTPUT_DIR / f"result_{req.market.code}_{uuid.uuid4().hex[:8]}.json"
    response = GenerateResponse(
        localized_copies=copies,
        image_brief=image_brief,
        image_url=image_url,
        image_path=image_path,
    )
    with open(result_file, "w") as f:
        json.dump(response.model_dump(), f, indent=2, ensure_ascii=False)
    logger.info(f"[STEP 5] Results saved to {result_file}")

    return {
        "status": "ok",
        "data": response.model_dump(),
    }
