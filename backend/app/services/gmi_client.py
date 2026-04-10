import httpx
import asyncio
import base64
import logging
import time
from app.config import get_settings

logger = logging.getLogger("ad-gen")


async def chat_completion(
    messages: list[dict],
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 2000,
    max_retries: int = 3,
) -> str:
    settings = get_settings()
    model = model or settings.model_strategy

    # OpenAI GPT-5.x models use max_completion_tokens instead of max_tokens
    is_openai = model.startswith("openai/")
    token_param = "max_completion_tokens" if is_openai else "max_tokens"

    logger.info(f"[LLM] Calling model={model}, {token_param}={max_tokens}")
    start_time = time.time()

    for attempt in range(max_retries):
        async with httpx.AsyncClient(timeout=120) as client:
            body = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                token_param: max_tokens,
                "stream": False,
            }
            resp = await client.post(
                f"{settings.gmi_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.gmi_api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
            if resp.status_code == 429:
                wait = 2 ** attempt + 1
                logger.warning(f"[LLM] Rate limited (429), retrying in {wait}s (attempt {attempt + 1}/{max_retries})")
                await asyncio.sleep(wait)
                continue
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            elapsed = time.time() - start_time
            logger.info(
                f"[LLM] Response from {model} in {elapsed:.1f}s "
                f"(tokens: {usage.get('prompt_tokens', '?')} in / {usage.get('completion_tokens', '?')} out)"
            )
            return content

    raise httpx.HTTPStatusError(
        "Rate limited after max retries",
        request=httpx.Request("POST", f"{settings.gmi_base_url}/chat/completions"),
        response=resp,
    )


async def analyze_image(image_bytes: bytes, prompt: str) -> str:
    settings = get_settings()
    b64 = base64.b64encode(image_bytes).decode()
    logger.info(f"[LLM] Analyzing image ({len(image_bytes)} bytes) with {settings.model_image_analysis}")

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{b64}"},
                },
            ],
        }
    ]

    return await chat_completion(
        messages=messages,
        model=settings.model_image_analysis,
        max_tokens=1500,
    )


async def generate_image(
    prompt: str,
    max_wait: int = 120,
    model_override: str | None = None,
    source_image_b64: str | None = None,
) -> str | None:
    """Generate or edit image via GMI queue-based API. Returns image URL on success.

    If source_image_b64 is provided, uses image-to-image editing (e.g. gpt-image-1.5).
    Otherwise, uses text-to-image generation.
    """
    settings = get_settings()
    model = model_override or settings.model_image_gen
    mode = "edit" if source_image_b64 else "generate"
    logger.info(f"[IMAGE] Submitting image {mode} request (model={model})")
    start_time = time.time()

    payload = {"prompt": prompt}
    if source_image_b64:
        # Use Gemini's contents format for image editing (multi-turn style)
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "inlineData": {
                                "mimeType": "image/png",
                                "data": source_image_b64,
                            }
                        },
                        {"text": prompt},
                    ],
                }
            ],
            "image_size": "1K",
        }

    # Submit request to queue API (generous timeout - GMI can be slow to accept)
    submit_timeout = 120
    async with httpx.AsyncClient(timeout=submit_timeout) as client:
        try:
            resp = await client.post(
                f"{settings.gmi_queue_url}/requests",
                headers={
                    "Authorization": f"Bearer {settings.gmi_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "payload": payload,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            request_id = data.get("request_id")
            if not request_id:
                logger.error(f"[IMAGE] No request_id in response: {data}")
                return None
            logger.info(f"[IMAGE] Request submitted, id={request_id}")
        except httpx.HTTPStatusError as e:
            logger.error(f"[IMAGE] Submit failed: {e.response.status_code} - {e.response.text}")
            return None

    # Poll for completion
    elapsed = 0
    poll_interval = 3
    async with httpx.AsyncClient(timeout=30) as client:
        while elapsed < max_wait:
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval

            try:
                resp = await client.get(
                    f"{settings.gmi_queue_url}/requests/{request_id}",
                    headers={"Authorization": f"Bearer {settings.gmi_api_key}"},
                )
                resp.raise_for_status()
                data = resp.json()
                status = data.get("status", "")
                logger.info(f"[IMAGE] Poll: status={status} (elapsed={elapsed}s)")

                if status == "success":
                    outcome = data.get("outcome", {})
                    # Try multiple response formats for image URLs
                    image_url = outcome.get("image_url") or outcome.get("url")

                    # Handle media_urls array format (used by Gemini image models)
                    if not image_url:
                        media_urls = outcome.get("media_urls", [])
                        if media_urls and isinstance(media_urls, list):
                            first = media_urls[0]
                            if isinstance(first, dict):
                                image_url = first.get("url")
                            elif isinstance(first, str):
                                image_url = first

                    # Try thumbnail as fallback
                    if not image_url:
                        image_url = outcome.get("thumbnail_image_url")

                    if not image_url:
                        image_urls = outcome.get("image_urls", [])
                        if image_urls:
                            image_url = image_urls[0]

                    total_time = time.time() - start_time
                    if image_url:
                        logger.info(f"[IMAGE] Generated successfully in {total_time:.1f}s: {image_url[:80]}...")
                        return image_url
                    logger.warning(f"[IMAGE] Success but no URL found in outcome keys: {list(outcome.keys())}")
                    return str(outcome)

                if status in ("failed", "error", "cancelled"):
                    logger.error(f"[IMAGE] Failed with status={status}")
                    return None

            except httpx.HTTPStatusError as e:
                logger.error(f"[IMAGE] Poll error: {e.response.status_code}")
                return None

    logger.error(f"[IMAGE] Timed out after {max_wait}s for request {request_id}")
    return None


async def list_models() -> list[dict]:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{settings.gmi_base_url}/models",
            headers={"Authorization": f"Bearer {settings.gmi_api_key}"},
        )
        resp.raise_for_status()
        return resp.json().get("data", [])
