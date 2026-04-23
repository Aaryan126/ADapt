import logging
import time
import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form
from app.services.gmi_client import generate_image
from app.services.billing import require_active_subscription
from app.config import get_settings

logger = logging.getLogger("ad-gen")

router = APIRouter(prefix="/direct-edit")

OUTPUT_DIR = Path(__file__).parent.parent.parent.parent / "output"


def _build_output_url(filename: str) -> str:
    settings = get_settings()
    return f"{settings.app_base_url.rstrip('/')}/output/{filename}"


@router.post("/run")
async def run_direct_edit(
    instructions: str = Form(...),
    customer_email: str = Form(...),
    image: UploadFile = File(...),
):
    settings = get_settings()
    pipeline_start = time.time()

    logger.info("=" * 60)
    logger.info("[DIRECT EDIT] Starting direct edit pipeline")
    logger.info(f"[DIRECT EDIT] Image: {image.filename}, Instructions: {instructions[:100]}...")
    require_active_subscription(customer_email)

    # Read the source image
    original_bytes = await image.read()
    image_mime = image.content_type or "image/png"
    logger.info(f"[DIRECT EDIT] Image loaded ({len(original_bytes)} bytes, mime={image_mime})")

    # Build the edit prompt
    prompt = f"""Edit this image with the following changes. Keep EVERYTHING else exactly the same.
Do not change the composition, lighting, camera angle, background, or any element not mentioned below.
Only make these specific changes:

{instructions}

This is a surgical edit. The output should look identical to the input except for the changes listed above."""

    logger.info(f"[DIRECT EDIT] Sending to {settings.model_direct_edit} for editing")
    step_start = time.time()

    try:
        edited_image_bytes = await generate_image(
            prompt=prompt,
            model_override=settings.model_direct_edit,
            source_image_bytes=original_bytes,
            source_image_mime=image_mime,
        )
    except Exception as e:
        logger.error(f"[DIRECT EDIT] Image edit failed: {e}")
        return {"status": "error", "error": f"Image editing failed: {e}"}

    logger.info(f"[DIRECT EDIT] Edit completed in {time.time() - step_start:.1f}s")

    if not edited_image_bytes:
        return {"status": "error", "error": "Image editing returned no result. The model may have timed out."}

    # Save the edited image
    image_path = None
    image_url = None
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    file_id = uuid.uuid4().hex[:8]
    filename = f"edit_{file_id}.png"
    image_path = str(OUTPUT_DIR / filename)
    with open(image_path, "wb") as f:
        f.write(edited_image_bytes)
    image_url = _build_output_url(filename)
    logger.info(f"[DIRECT EDIT] Saved to {image_path} ({len(edited_image_bytes)} bytes)")

    # Save the original for reference
    original_path = str(OUTPUT_DIR / f"edit_{file_id}_original.png")
    with open(original_path, "wb") as f:
        f.write(original_bytes)

    total_time = time.time() - pipeline_start
    logger.info(f"[DIRECT EDIT] Complete! Total time: {total_time:.1f}s")
    logger.info("=" * 60)

    return {
        "status": "ok",
        "data": {
            "image_url": image_url,
            "image_path": image_path,
            "original_path": original_path,
            "instructions": instructions,
        },
    }
