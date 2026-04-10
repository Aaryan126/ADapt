import json
from pathlib import Path
from app.models import MarketPreset

MARKETS_FILE = Path(__file__).parent.parent / "data" / "markets.json"


def load_markets() -> list[MarketPreset]:
    with open(MARKETS_FILE) as f:
        data = json.load(f)
    return [MarketPreset(**m) for m in data]


def get_market(code: str) -> MarketPreset | None:
    for m in load_markets():
        if m.code.upper() == code.upper():
            return m
    return None
