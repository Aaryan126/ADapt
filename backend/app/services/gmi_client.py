import httpx
import asyncio
import base64
import logging
import time
from app.config import get_settings

logger = logging.getLogger("ad-gen")


def _auth_headers() -> dict[str, str]:
    settings = get_settings()
    return {
        "Authorization": f"Bearer {settings.openai_api_key}",
    }


def _extract_response_text(data: dict) -> str:
    output_text = data.get("output_text")
    if output_text:
        return output_text

    texts: list[str] = []
    for item in data.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") in {"output_text", "text"} and content.get("text"):
                texts.append(content["text"])
    return "\n".join(texts).strip()


def _fallback_model(model: str) -> str | None:
    fallbacks = {
        "gpt-5": "gpt-4.1",
        "gpt-5-mini": "gpt-4.1-mini",
    }
    return fallbacks.get(model)


async def chat_completion(
    messages: list[dict],
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 2000,
    max_retries: int = 3,
) -> str:
    settings = get_settings()
    model = model or settings.model_strategy
    current_model = model
    retried_with_fallback = False
    logger.info(f"[LLM] Calling OpenAI Responses API model={current_model}, max_output_tokens={max_tokens}")
    start_time = time.time()

    for attempt in range(max_retries):
        async with httpx.AsyncClient(timeout=120) as client:
            body = {
                "model": current_model,
                "input": messages,
                "temperature": temperature,
                "max_output_tokens": max_tokens,
            }
            resp = await client.post(
                f"{settings.openai_base_url}/responses",
                headers={**_auth_headers(), "Content-Type": "application/json"},
                json=body,
            )
            if resp.status_code == 429:
                wait = 2 ** attempt + 1
                logger.warning(f"[LLM] Rate limited (429), retrying in {wait}s (attempt {attempt + 1}/{max_retries})")
                await asyncio.sleep(wait)
                continue
            if resp.status_code == 400:
                fallback = _fallback_model(current_model)
                logger.error(f"[LLM] 400 from {current_model}: {resp.text}")
                if fallback and not retried_with_fallback:
                    logger.warning(f"[LLM] Retrying with fallback model={fallback}")
                    current_model = fallback
                    retried_with_fallback = True
                    continue
            resp.raise_for_status()
            data = resp.json()
            content = _extract_response_text(data)
            usage = data.get("usage", {})
            elapsed = time.time() - start_time
            logger.info(
                f"[LLM] Response from {current_model} in {elapsed:.1f}s "
                f"(tokens: {usage.get('input_tokens', '?')} in / {usage.get('output_tokens', '?')} out)"
            )
            return content

    raise httpx.HTTPStatusError(
        "Rate limited after max retries",
        request=httpx.Request("POST", f"{settings.openai_base_url}/responses"),
        response=resp,
    )


async def analyze_image(image_bytes: bytes, prompt: str, mime_type: str = "image/png") -> str:
    settings = get_settings()
    b64 = base64.b64encode(image_bytes).decode()
    logger.info(f"[LLM] Analyzing image ({len(image_bytes)} bytes) with {settings.model_image_analysis}")

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": prompt},
                {
                    "type": "input_image",
                    "image_url": f"data:{mime_type};base64,{b64}",
                    "detail": "high",
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
    model_override: str | None = None,
    source_image_bytes: bytes | None = None,
    source_image_mime: str = "image/png",
) -> bytes | None:
    """Generate or edit an image with the OpenAI Images API."""
    settings = get_settings()
    model = model_override or settings.model_image_gen
    mode = "edit" if source_image_bytes else "generate"
    logger.info(f"[IMAGE] Submitting image {mode} request to OpenAI Images API (model={model})")
    start_time = time.time()

    headers = _auth_headers()

    payload = {
        "model": model,
        "prompt": prompt,
        "size": "1536x1024",
        "quality": "medium",
    }

    endpoint = f"{settings.openai_base_url}/images/generations"
    request_kwargs: dict = {"headers": headers}

    if source_image_bytes:
        endpoint = f"{settings.openai_base_url}/images/edits"
        files = {
            "image": ("source-image", source_image_bytes, source_image_mime),
        }
        data = {
            "model": model,
            "prompt": prompt,
            "size": "1536x1024",
            "quality": "medium",
        }
        request_kwargs["files"] = files
        request_kwargs["data"] = data
    else:
        request_kwargs["json"] = payload
        request_kwargs["headers"] = {**headers, "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=180) as client:
        try:
            resp = await client.post(endpoint, **request_kwargs)
            resp.raise_for_status()
            data = resp.json()
            image_data = data.get("data", [])
            if not image_data:
                logger.error(f"[IMAGE] No image data returned: {data}")
                return None

            b64_json = image_data[0].get("b64_json")
            if not b64_json:
                logger.error(f"[IMAGE] No b64_json returned in image response: {image_data[0]}")
                return None

            total_time = time.time() - start_time
            logger.info(f"[IMAGE] Image {mode} completed in {total_time:.1f}s")
            return base64.b64decode(b64_json)
        except httpx.HTTPStatusError as e:
            logger.error(f"[IMAGE] Submit failed: {e.response.status_code} - {e.response.text}")
            return None


async def list_models() -> list[dict]:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{settings.openai_base_url}/models",
            headers=_auth_headers(),
        )
        resp.raise_for_status()
        return resp.json().get("data", [])
