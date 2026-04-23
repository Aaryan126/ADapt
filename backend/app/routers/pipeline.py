import json
import logging
import time
from fastapi import APIRouter, UploadFile, File, Form
from typing import Optional
from app.models import (
    AdInfo,
    CustomInstructions,
    StrategyRequest,
    GenerateRequest,
    LocalizationStrategy,
)
from app.services.markets import get_market
from app.services.gmi_client import analyze_image, chat_completion
from app.services.billing import require_active_subscription
from app.routers.intake import IMAGE_ANALYSIS_PROMPT
from app.routers.strategy import build_strategy_prompt
from app.routers.generate import generate_outputs
from app.config import get_settings

logger = logging.getLogger("ad-gen")

router = APIRouter(prefix="/pipeline")


@router.post("/run")
async def run_pipeline(
    market_code: str = Form("SG"),
    ad_text: Optional[str] = Form(None),
    tone: Optional[str] = Form(None),
    language_mix: Optional[str] = Form(None),
    audience_segment: Optional[str] = Form(None),
    platform: Optional[str] = Form(None),
    freeform_notes: Optional[str] = Form(None),
    customer_email: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
):
    settings = get_settings()
    steps_completed = []
    pipeline_start = time.time()
    logger.info("=" * 60)
    logger.info("[PIPELINE] Starting pipeline run")
    logger.info(f"[PIPELINE] Market={market_code}, has_image={image is not None}, has_text={bool(ad_text)}")

    # --- Step 1: Ad Intake ---
    logger.info("[STEP 1] Ad Intake")
    step_start = time.time()
    require_active_subscription(customer_email)
    if image:
        image_bytes = await image.read()
        mime_type = image.content_type or "image/png"
        logger.info(f"[STEP 1] Analyzing uploaded image ({len(image_bytes)} bytes, filename={image.filename})")
        result = await analyze_image(image_bytes, IMAGE_ANALYSIS_PROMPT, mime_type=mime_type)
        logger.info(f"[STEP 1] Image analysis complete in {time.time() - step_start:.1f}s")
        logger.info(f"[STEP 1] Extracted: {result[:200]}...")
        try:
            start = result.find("{")
            end = result.rfind("}") + 1
            if start != -1 and end > start:
                parsed = json.loads(result[start:end])
                ad_info = AdInfo(**parsed, raw_text=result)
                logger.info(f"[STEP 1] Parsed ad info: product={ad_info.product}, headline={ad_info.headline}")
            else:
                ad_info = AdInfo(raw_text=result)
                logger.warning("[STEP 1] Could not find JSON in response, using raw text")
        except (json.JSONDecodeError, ValueError) as e:
            ad_info = AdInfo(raw_text=result)
            logger.warning(f"[STEP 1] JSON parse error: {e}, using raw text")
        steps_completed.append("image_analysis")
    elif ad_text:
        ad_info = AdInfo(raw_text=ad_text)
        logger.info(f"[STEP 1] Text input received ({len(ad_text)} chars)")
        steps_completed.append("text_intake")
    else:
        logger.error("[STEP 1] No input provided")
        return {"status": "error", "error": "Provide either ad_text or an image file"}

    # --- Step 2: Market Selection ---
    logger.info(f"[STEP 2] Market Selection: {market_code}")
    market = get_market(market_code)
    if not market:
        logger.error(f"[STEP 2] Market '{market_code}' not found")
        return {"status": "error", "error": f"Market '{market_code}' not found"}
    logger.info(f"[STEP 2] Selected: {market.name} (primary={market.primary_language}, secondary={market.secondary_languages})")
    steps_completed.append("market_selection")

    # --- Step 3: Custom Instructions ---
    custom = CustomInstructions(
        tone=tone,
        language_mix=language_mix,
        audience_segment=audience_segment,
        platform=platform,
        freeform_notes=freeform_notes,
    )
    active = [f"{k}={v}" for k, v in custom.model_dump().items() if v]
    logger.info(f"[STEP 3] Custom Instructions: {', '.join(active) if active else 'none'}")
    steps_completed.append("custom_instructions")

    # --- Step 4: Strategy ---
    logger.info(f"[STEP 4] Generating localization strategy (model={settings.model_strategy})")
    step_start = time.time()
    strategy_req = StrategyRequest(
        ad_info=ad_info,
        market=market,
        custom_instructions=custom,
    )
    strategy_prompt = build_strategy_prompt(strategy_req)
    try:
        strategy_result = await chat_completion(
            messages=[{"role": "user", "content": strategy_prompt}],
            model=settings.model_strategy,
            temperature=0.7,
            max_tokens=2000,
        )
    except Exception as e:
        logger.error(f"[STEP 4] Strategy generation failed: {e}")
        return {"status": "error", "error": f"Strategy generation failed: {e}"}

    logger.info(f"[STEP 4] Strategy generated in {time.time() - step_start:.1f}s")

    try:
        start = strategy_result.find("{")
        end = strategy_result.rfind("}") + 1
        if start != -1 and end > start:
            parsed = json.loads(strategy_result[start:end])
            strategy = LocalizationStrategy(**parsed)
            logger.info(f"[STEP 4] Strategy parsed: {len(strategy.keep)} keeps, {len(strategy.change)} changes, {len(strategy.cultural_adaptations)} adaptations")
        else:
            strategy = LocalizationStrategy(reasoning=strategy_result)
            logger.warning("[STEP 4] Could not parse strategy JSON, using raw text")
    except (json.JSONDecodeError, ValueError):
        strategy = LocalizationStrategy(reasoning=strategy_result)
        logger.warning("[STEP 4] Strategy JSON parse error, using raw text")
    steps_completed.append("strategy")

    # --- Step 5: Generate Outputs ---
    logger.info("[STEP 5] Generating outputs (copy + image brief + image)")
    step_start = time.time()
    gen_req = GenerateRequest(
        ad_info=ad_info,
        market=market,
        strategy=strategy,
        custom_instructions=custom,
    )

    gen_result = await generate_outputs(gen_req)
    logger.info(f"[STEP 5] Outputs generated in {time.time() - step_start:.1f}s")
    steps_completed.append("generation")

    total_time = time.time() - pipeline_start
    logger.info(f"[PIPELINE] Complete! Total time: {total_time:.1f}s, steps: {steps_completed}")
    logger.info("=" * 60)

    return {
        "status": "ok",
        "data": {
            "steps_completed": steps_completed,
            "ad_info": ad_info.model_dump(),
            "market": market.model_dump(),
            "strategy": strategy.model_dump(),
            "outputs": gen_result["data"],
        },
    }
