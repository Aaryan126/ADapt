from fastapi import APIRouter, UploadFile, File
from app.models import AdInfo
from app.services.gmi_client import analyze_image

router = APIRouter(prefix="/intake")

IMAGE_ANALYSIS_PROMPT = """Analyze this advertisement image and extract the following information in a structured format:

1. **Product/Service**: What is being advertised?
2. **Headline**: The main headline or tagline
3. **Body Copy**: Any supporting text or description
4. **CTA (Call to Action)**: Any call-to-action text (e.g., "Buy Now", "Learn More")
5. **Visual Style**: Describe the visual style (colors, layout, photography style, design elements)
6. **Brand Identity Cues**: Logo, brand colors, brand name, brand personality conveyed

Respond in this exact JSON format:
{
  "product": "...",
  "headline": "...",
  "body_copy": "...",
  "cta": "...",
  "visual_style": "...",
  "brand_identity": "..."
}"""


@router.post("/text")
async def intake_text(ad_info: AdInfo):
    return {
        "status": "ok",
        "data": {"ad_info": ad_info.model_dump()},
    }


@router.post("/image")
async def intake_image(file: UploadFile = File(...)):
    image_bytes = await file.read()
    mime_type = file.content_type or "image/png"

    result = await analyze_image(image_bytes, IMAGE_ANALYSIS_PROMPT, mime_type=mime_type)

    # Try to parse JSON from the response
    import json
    try:
        # Find JSON in the response
        start = result.find("{")
        end = result.rfind("}") + 1
        if start != -1 and end > start:
            parsed = json.loads(result[start:end])
            ad_info = AdInfo(**parsed, raw_text=result)
        else:
            ad_info = AdInfo(raw_text=result)
    except (json.JSONDecodeError, ValueError):
        ad_info = AdInfo(raw_text=result)

    return {
        "status": "ok",
        "data": {"ad_info": ad_info.model_dump()},
    }
