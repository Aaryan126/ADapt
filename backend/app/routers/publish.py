import logging
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.publer import publish_to_tiktok

logger = logging.getLogger("ad-gen")

router = APIRouter(prefix="/publish")


class TikTokPublishRequest(BaseModel):
    caption: str
    image_url: str


@router.post("/tiktok")
async def post_to_tiktok(req: TikTokPublishRequest):
    logger.info("=" * 60)
    logger.info("[PUBLISH] Publishing to TikTok via Publer")

    result = await publish_to_tiktok(
        caption=req.caption,
        image_url=req.image_url,
    )

    if isinstance(result, dict) and result.get("error"):
        logger.error(f"[PUBLISH] Failed: {result['error']}")
        return {"status": "error", "error": result["error"], "data": result}

    logger.info("[PUBLISH] Success!")
    logger.info("=" * 60)
    return {"status": "ok", "data": result}
