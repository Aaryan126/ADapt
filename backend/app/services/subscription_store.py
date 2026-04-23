import json
from pathlib import Path
from typing import Any

STORE_FILE = Path(__file__).parent.parent / "data" / "subscriptions.json"


def _load_store() -> dict[str, dict[str, Any]]:
    if not STORE_FILE.exists():
        return {}
    with open(STORE_FILE) as f:
        return json.load(f)


def _save_store(data: dict[str, dict[str, Any]]) -> None:
    STORE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STORE_FILE, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_subscription_record(email: str) -> dict[str, Any] | None:
    store = _load_store()
    return store.get(normalize_email(email))


def save_subscription_record(email: str, record: dict[str, Any]) -> dict[str, Any]:
    store = _load_store()
    key = normalize_email(email)
    store[key] = {
        **store.get(key, {}),
        **record,
        "email": key,
    }
    _save_store(store)
    return store[key]


def find_record_by_customer_id(customer_id: str) -> dict[str, Any] | None:
    store = _load_store()
    for record in store.values():
        if record.get("customer_id") == customer_id:
            return record
    return None
