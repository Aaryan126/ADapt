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


def _build_output_url(filename: str) -> str:
    settings = get_settings()
    return f"{settings.app_base_url.rstrip('/')}/output/{filename}"


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

    prompt += f"""

## Task
Generate localized ad copy for EACH of these target languages:
1. {market.primary_language} (PRIMARY - this is the most important version)
{chr(10).join(f'{i+2}. {lang}' for i, lang in enumerate(market.secondary_languages))}

IMPORTANT: The headline, body, and CTA for each language MUST be written IN THAT LANGUAGE, not in English.
For example, if the language is "Mandarin Chinese", write the headline/body/cta in Chinese characters.
If the language is "Thai", write in Thai script. Do NOT just write English translations.

Return as JSON:
{{
  "copies": [
    {{
      "language": "language name",
      "headline": "localized headline IN THIS LANGUAGE",
      "body": "localized body copy IN THIS LANGUAGE",
      "cta": "localized call to action IN THIS LANGUAGE",
      "tone_notes": "notes on tone choices (this can be in English)",
      "cultural_reasoning": "why these choices work for this market (this can be in English)"
    }}
  ]
}}

Make each version feel native, not translated. Use local idioms, slang, and cultural references where appropriate."""

    return prompt


def build_image_brief_prompt(req: GenerateRequest, copies: list[LocalizedCopy]) -> str:
    ad = req.ad_info
    market = req.market
    strategy = req.strategy
    custom = req.custom_instructions

    primary_copy = copies[0] if copies else None

    # Build the original image description block from all available info
    original_description_parts = []
    if ad.raw_text:
        original_description_parts.append(f"Full analysis of the original ad:\n{ad.raw_text}")
    if ad.visual_style:
        original_description_parts.append(f"Visual style: {ad.visual_style}")
    if ad.brand_identity:
        original_description_parts.append(f"Brand identity: {ad.brand_identity}")
    if ad.product:
        original_description_parts.append(f"Product: {ad.product}")
    original_description = "\n".join(original_description_parts)

    # Build explicit custom overrides block
    custom_overrides = ""
    if custom:
        override_parts = []
        if custom.freeform_notes:
            override_parts.append(f"EXPLICIT USER OVERRIDES: {custom.freeform_notes}")
        if custom.tone:
            override_parts.append(f"Tone override: {custom.tone}")
        if custom.language_mix:
            override_parts.append(f"Language mix: {custom.language_mix}")
        if custom.audience_segment:
            override_parts.append(f"Target audience: {custom.audience_segment}")
        if custom.platform:
            override_parts.append(f"Platform: {custom.platform}")
        if override_parts:
            custom_overrides = "\n## User's Custom Instructions (MUST FOLLOW)\n" + "\n".join(override_parts)

    prompt = f"""You are a creative director creating an image direction brief for a localized ad.

## CRITICAL RULE
You MUST preserve the original ad's composition, camera angle, lighting, mood, scene layout, and visual concept.
The localized image should look like a near-identical version of the original, with ONLY the specific changes listed below applied.
Do NOT reimagine the scene. Do NOT change the setting, number of subjects, or overall concept.
Think of this as a targeted edit, not a redesign.

## Original Ad Description (PRESERVE THIS EXACTLY)
{original_description}

## Target Market: {market.name}
- Cultural Context: {market.cultural_context}
- Taboos to avoid: {market.taboos}

## Specific Changes to Apply
- Cultural Adaptations from strategy: {json.dumps(strategy.cultural_adaptations)}
{custom_overrides}

## Primary Localized Headline
{primary_copy.headline if primary_copy else ad.headline}

## Task
Create a detailed image direction brief that keeps the original composition intact but applies ONLY the specific changes listed above.

Return as JSON:
{{
  "description": "Describe the image. Start by restating the original scene exactly, then note ONLY what changes. Be very specific about what stays the same vs what changes.",
  "style_notes": "MUST match the original style. Note the original lighting, mood, and photography style to preserve.",
  "cultural_elements": ["list ONLY elements that differ from the original"],
  "colors": ["color palette - should closely match original unless a specific change requires it"],
  "text_overlays": ["text that should appear on the image"]
}}

Remember: The output image should be immediately recognizable as the same ad, just localized."""

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
    # Build custom overrides reminder for the image gen prompt
    custom_reminder = ""
    if req.custom_instructions and req.custom_instructions.freeform_notes:
        custom_reminder = f"\n\nCRITICAL CHANGES TO APPLY: {req.custom_instructions.freeform_notes}"

    image_gen_prompt = f"""Recreate this advertisement image with targeted localization changes for the {req.market.name} market.

IMPORTANT: Keep the SAME composition, camera angle, lighting, mood, and overall scene layout as the original.
Only apply the specific changes described below. This is a localization edit, NOT a redesign.

Original scene and composition to preserve:
{image_brief.description}

Style (MATCH THIS EXACTLY): {image_brief.style_notes}
Specific changes: {', '.join(image_brief.cultural_elements)}
Color palette: {', '.join(image_brief.colors)}
Text overlays: {', '.join(image_brief.text_overlays)}{custom_reminder}"""

    logger.info(f"[STEP 5c] Generating ad image (model={settings.model_image_gen})")
    step_start = time.time()
    try:
        image_result = await generate_image(image_gen_prompt)
    except Exception as e:
        logger.error(f"[STEP 5c] Image generation error: {type(e).__name__}: {e}")
        image_result = None
    logger.info(f"[STEP 5c] Image generation finished in {time.time() - step_start:.1f}s (success={image_result is not None})")

    image_path = None
    image_url = None
    if image_result:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        file_id = uuid.uuid4().hex[:8]
        filename = f"ad_{req.market.code}_{file_id}.png"
        image_path = str(OUTPUT_DIR / filename)
        with open(image_path, "wb") as f:
            f.write(image_result)
        image_url = _build_output_url(filename)
        logger.info(f"[STEP 5c] Image saved to {image_path} ({len(image_result)} bytes)")

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
