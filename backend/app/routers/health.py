from fastapi import APIRouter
from app.services.gmi_client import list_models

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/models")
async def available_models():
    models = await list_models()
    return {"status": "ok", "data": {"models": [m.get("id", m) for m in models]}}
