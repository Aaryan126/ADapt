from fastapi import APIRouter
from app.services.markets import load_markets, get_market

router = APIRouter(prefix="/markets")


@router.get("")
async def list_markets():
    markets = load_markets()
    return {
        "status": "ok",
        "data": {"markets": [m.model_dump() for m in markets]},
    }


@router.get("/{code}")
async def get_market_preset(code: str):
    market = get_market(code)
    if not market:
        return {"status": "error", "error": f"Market '{code}' not found"}
    return {"status": "ok", "data": {"market": market.model_dump()}}
