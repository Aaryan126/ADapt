import httpx
import asyncio
import logging
import time
from app.config import get_settings

logger = logging.getLogger("ad-gen")

PUBLER_BASE = "https://app.publer.com/api/v1"


def _headers(content_type: str | None = "application/json") -> dict:
    settings = get_settings()
    h = {
        "Authorization": f"Bearer-API {settings.publer_api_key}",
        "Publer-Workspace-Id": settings.publer_workspace_id,
    }
    if content_type:
        h["Content-Type"] = content_type
    return h


async def upload_media(image_url: str) -> dict | None:
    """Download image from URL, convert to JPEG, and upload to Publer."""
    logger.info(f"[PUBLER] Downloading image from: {image_url[:80]}...")

    async with httpx.AsyncClient(timeout=60) as client:
        img_resp = await client.get(image_url)
        img_resp.raise_for_status()
        image_bytes = img_resp.content
        logger.info(f"[PUBLER] Downloaded {len(image_bytes)} bytes")

        # Convert to JPEG (TikTok does not accept PNG)
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        jpeg_buf = io.BytesIO()
        img.save(jpeg_buf, format="JPEG", quality=95)
        jpeg_bytes = jpeg_buf.getvalue()
        logger.info(f"[PUBLER] Converted to JPEG ({len(jpeg_bytes)} bytes), uploading...")

        resp = await client.post(
            f"{PUBLER_BASE}/media",
            headers=_headers(content_type=None),
            files={"file": ("ad_image.jpg", jpeg_bytes, "image/jpeg")},
        )

        if resp.status_code != 200:
            logger.error(f"[PUBLER] Media upload failed: {resp.status_code} - {resp.text}")
            return None

        data = resp.json()
        logger.info(f"[PUBLER] Media uploaded: id={data.get('id')}, path={data.get('path','')[:80]}")
        return data


async def _poll_job(job_id: str, max_wait: int = 60) -> dict | None:
    """Poll a Publer job until completion."""
    logger.info(f"[PUBLER] Polling job {job_id}...")
    elapsed = 0
    poll_interval = 2

    async with httpx.AsyncClient(timeout=30) as client:
        while elapsed < max_wait:
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval

            resp = await client.get(
                f"{PUBLER_BASE}/job_status/{job_id}",
                headers=_headers(),
            )
            if resp.status_code != 200:
                logger.error(f"[PUBLER] Job poll error: {resp.status_code}")
                continue

            data = resp.json()
            result = data.get("data", data)
            status = result.get("status", "")
            logger.info(f"[PUBLER] Job {job_id}: status={status} ({elapsed}s)")

            if status in ("complete", "completed"):
                return result
            if status == "failed":
                payload = result.get("payload", {})
                logger.error(f"[PUBLER] Job failed: {payload}")
                return result

    logger.error(f"[PUBLER] Job timed out after {max_wait}s")
    return None


async def publish_to_tiktok(
    caption: str,
    image_url: str,
) -> dict:
    """Upload image then publish to TikTok via Publer."""
    settings = get_settings()

    if not settings.publer_api_key:
        return {"error": "Publer API key not configured"}
    if not settings.publer_tiktok_account_id:
        return {"error": "TikTok account ID not configured"}

    logger.info("[PUBLER] Publishing to TikTok...")
    logger.info(f"[PUBLER] Caption: {caption[:100]}...")
    start_time = time.time()

    # Step 1: Upload media to Publer
    media = await upload_media(image_url)
    if not media:
        return {"error": "Failed to upload image to Publer"}

    logger.info(f"[PUBLER] Media ID: {media.get('id')}")

    # Step 2: Create the TikTok post
    post_body = {
        "bulk": {
            "state": "scheduled",
            "posts": [
                {
                    "networks": {
                        "tiktok": {
                            "type": "photo",
                            "text": caption,
                            "media": [
                                {
                                    "id": media.get("id"),
                                    "path": media.get("path"),
                                    "caption": "",
                                },
                            ],
                            "details": {
                                "privacy": "PUBLIC_TO_EVERYONE",
                                "comment": True,
                                "auto_add_music": True,
                                "promotional": False,
                                "paid": False,
                            },
                        }
                    },
                    "accounts": [
                        {"id": settings.publer_tiktok_account_id}
                    ],
                }
            ],
        }
    }

    logger.info("[PUBLER] Submitting TikTok photo post...")

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{PUBLER_BASE}/posts/schedule/publish",
            headers=_headers(),
            json=post_body,
        )

        if resp.status_code != 200:
            logger.error(f"[PUBLER] Post submit failed: {resp.status_code} - {resp.text}")
            return {"error": f"Publer API error: {resp.status_code} - {resp.text}"}

        data = resp.json()
        logger.info(f"[PUBLER] Post submit response: {data}")

        job_id = data.get("job_id") or data.get("data", {}).get("job_id")
        if not job_id:
            return {"error": "No job_id returned from Publer", "raw": data}

    # Step 3: Poll for completion
    result = await _poll_job(job_id, max_wait=90)
    total = time.time() - start_time
    logger.info(f"[PUBLER] Publish completed in {total:.1f}s")

    if not result:
        return {"error": "Publish timed out"}

    # Step 4: Fetch the newly created post to get the TikTok link
    await asyncio.sleep(3)
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{PUBLER_BASE}/posts?limit=1&account_id={settings.publer_tiktok_account_id}",
            headers=_headers(),
        )
        if resp.status_code == 200:
            posts = resp.json().get("posts", [])
            if posts:
                post = posts[0]
                post_link = post.get("post_link")
                post_state = post.get("state")
                post_error = post.get("error")
                logger.info(f"[PUBLER] Post state={post_state}, link={post_link}, error={post_error}")
                return {
                    "status": "complete",
                    "post_id": post.get("id"),
                    "post_link": post_link,
                    "state": post_state,
                    "error": post_error,
                }

    return result
