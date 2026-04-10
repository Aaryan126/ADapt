import base64
import json
import logging
import time
import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form
from app.services.gmi_client import generate_image
from app.config import get_settings

logger = logging.getLogger("ad-gen")

router = APIRouter(prefix="/direct-edit")

OUTPUT_DIR = Path(__file__).parent.parent.parent.parent / "output"


@router.post("/run")
async def run_direct_edit(
    instructions: str = Form(...),
    image: UploadFile = File(...),
):
    settings = get_settings()
    pipeline_start = time.time()

    logger.info("=" * 60)
    logger.info("[DIRECT EDIT] Starting direct edit pipeline")
    logger.info(f"[DIRECT EDIT] Image: {image.filename}, Instructions: {instructions[:100]}...")

    # Read and encode the source image
    image_bytes = await image.read()
    image_b64 = base64.b64encode(image_bytes).decode()
    logger.info(f"[DIRECT EDIT] Image encoded ({len(image_bytes)} bytes)")

    # Build the edit prompt
    prompt = f"""Edit this image with the following changes. Keep EVERYTHING else exactly the same.
Do not change the composition, lighting, camera angle, background, or any element not mentioned below.
Only make these specific changes:

{instructions}

This is a surgical edit. The output should look identical to the input except for the changes listed above."""

    logger.info(f"[DIRECT EDIT] Sending to {settings.model_direct_edit} for editing")
    step_start = time.time()

    try:
        image_url = await generate_image(
            prompt=prompt,
            model_override=settings.model_direct_edit,
            source_image_b64=image_b64,
            max_wait=180,
        )
    except Exception as e:
        logger.error(f"[DIRECT EDIT] Image edit failed: {e}")
        return {"status": "error", "error": f"Image editing failed: {e}"}

    logger.info(f"[DIRECT EDIT] Edit completed in {time.time() - step_start:.1f}s")

    if not image_url:
        return {"status": "error", "error": "Image editing returned no result. The model may have timed out."}

    # Download and save the edited image
    image_path = None
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    file_id = uuid.uuid4().hex[:8]

    if image_url.startswith("http"):
        import httpx
        try:
            logger.info(f"[DIRECT EDIT] Downloading edited image...")
            async with httpx.AsyncClient(timeout=30) as dl_client:
                img_resp = await dl_client.get(image_url)
                img_resp.raise_for_status()
                image_path = str(OUTPUT_DIR / f"edit_{file_id}.png")
                with open(image_path, "wb") as f:
                    f.write(img_resp.content)
                logger.info(f"[DIRECT EDIT] Saved to {image_path} ({len(img_resp.content)} bytes)")
        except Exception as e:
            logger.error(f"[DIRECT EDIT] Download failed: {e}")

    # Save the original for reference
    original_path = str(OUTPUT_DIR / f"edit_{file_id}_original.png")
    with open(original_path, "wb") as f:
        f.write(image_bytes)

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
