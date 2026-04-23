from datetime import UTC, datetime
import logging

import stripe
from fastapi import HTTPException

from app.config import get_settings
from app.services.subscription_store import (
    find_record_by_customer_id,
    get_subscription_record,
    normalize_email,
    save_subscription_record,
)

logger = logging.getLogger("ad-gen")

ACTIVE_SUBSCRIPTION_STATUSES = {"active", "trialing"}


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _unix_to_iso(timestamp: int | None) -> str | None:
    if not timestamp:
        return None
    return datetime.fromtimestamp(timestamp, UTC).isoformat()


def _configure_stripe() -> None:
    settings = get_settings()
    stripe.api_key = settings.stripe_secret_key
    stripe.max_network_retries = 2


def stripe_enabled() -> bool:
    settings = get_settings()
    return bool(settings.stripe_secret_key and settings.stripe_price_id)


def get_billing_config() -> dict:
    settings = get_settings()
    return {
        "enabled": stripe_enabled(),
        "plan_name": settings.stripe_plan_name,
        "price_display": settings.stripe_price_display,
        "requires_subscription": True,
    }


def _find_customer_by_email(email: str):
    customers = stripe.Customer.list(email=email, limit=1)
    if customers.data:
        return customers.data[0]
    return None


def _get_or_create_customer(email: str):
    customer = _find_customer_by_email(email)
    if customer:
        return customer
    return stripe.Customer.create(email=email)


def _subscription_record_from_stripe(subscription, email: str, customer_id: str | None = None) -> dict:
    status = getattr(subscription, "status", None) or subscription.get("status", "inactive")
    current_period_end = getattr(subscription, "current_period_end", None) or subscription.get("current_period_end")
    subscription_id = getattr(subscription, "id", None) or subscription.get("id")
    return {
        "email": normalize_email(email),
        "active": status in ACTIVE_SUBSCRIPTION_STATUSES,
        "status": status,
        "customer_id": customer_id or getattr(subscription, "customer", None) or subscription.get("customer"),
        "subscription_id": subscription_id,
        "current_period_end": _unix_to_iso(current_period_end),
        "updated_at": _now_iso(),
    }


def _lookup_customer_email(customer_id: str | None, fallback_email: str | None = None) -> str | None:
    if fallback_email:
        return normalize_email(fallback_email)
    if not customer_id:
        return None
    record = find_record_by_customer_id(customer_id)
    if record and record.get("email"):
        return record["email"]
    customer = stripe.Customer.retrieve(customer_id)
    return normalize_email(getattr(customer, "email", None) or customer.get("email", ""))


def sync_subscription_object(subscription, email_hint: str | None = None) -> dict | None:
    customer_id = getattr(subscription, "customer", None) or subscription.get("customer")
    email = _lookup_customer_email(customer_id, email_hint)
    if not email:
        return None
    record = _subscription_record_from_stripe(subscription, email=email, customer_id=customer_id)
    return save_subscription_record(email, record)


def refresh_subscription_status(email: str) -> dict:
    normalized = normalize_email(email)
    if not stripe_enabled():
        return {
            "email": normalized,
            "active": False,
            "status": "billing_disabled",
        }

    _configure_stripe()
    customer = _find_customer_by_email(normalized)
    if not customer:
        existing = get_subscription_record(normalized)
        if existing:
            return existing
        return save_subscription_record(normalized, {
            "active": False,
            "status": "inactive",
            "updated_at": _now_iso(),
        })

    subscriptions = stripe.Subscription.list(customer=customer.id, status="all", limit=10).data
    chosen = next((sub for sub in subscriptions if getattr(sub, "status", None) in ACTIVE_SUBSCRIPTION_STATUSES), None)
    if not chosen and subscriptions:
        chosen = subscriptions[0]

    if chosen:
        return sync_subscription_object(chosen, email_hint=normalized) or {
            "email": normalized,
            "active": False,
            "status": "inactive",
        }

    return save_subscription_record(normalized, {
        "active": False,
        "status": "inactive",
        "customer_id": customer.id,
        "updated_at": _now_iso(),
    })


def require_active_subscription(email: str | None) -> dict | None:
    if not stripe_enabled():
        return None
    if not email:
        raise HTTPException(status_code=402, detail="A billing email is required for an active subscription.")
    record = refresh_subscription_status(email)
    if not record.get("active"):
        raise HTTPException(
            status_code=402,
            detail="An active subscription is required before generating or editing ads.",
        )
    return record


def create_checkout_session(email: str) -> dict:
    if not stripe_enabled():
        raise HTTPException(status_code=503, detail="Stripe billing is not configured.")

    normalized = normalize_email(email)
    settings = get_settings()
    _configure_stripe()

    customer = _get_or_create_customer(normalized)
    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=customer.id,
        success_url=f"{settings.frontend_base_url.rstrip('/')}/?checkout=success&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.frontend_base_url.rstrip('/')}/?checkout=cancelled",
        line_items=[{"price": settings.stripe_price_id, "quantity": 1}],
        allow_promotion_codes=True,
        client_reference_id=normalized,
        metadata={"email": normalized},
    )

    save_subscription_record(normalized, {
        "customer_id": customer.id,
        "status": "checkout_started",
        "active": False,
        "checkout_session_id": session.id,
        "updated_at": _now_iso(),
    })

    return {
        "email": normalized,
        "checkout_url": session.url,
        "customer_id": customer.id,
    }


def create_portal_session(email: str) -> dict:
    if not stripe_enabled():
        raise HTTPException(status_code=503, detail="Stripe billing is not configured.")

    normalized = normalize_email(email)
    settings = get_settings()
    _configure_stripe()

    customer = _find_customer_by_email(normalized)
    if not customer:
        raise HTTPException(status_code=404, detail="No Stripe customer found for that email.")

    session = stripe.billing_portal.Session.create(
        customer=customer.id,
        return_url=settings.frontend_base_url,
    )
    return {
        "email": normalized,
        "portal_url": session.url,
    }


def confirm_checkout_session(session_id: str) -> dict:
    if not stripe_enabled():
        raise HTTPException(status_code=503, detail="Stripe billing is not configured.")

    _configure_stripe()
    session = stripe.checkout.Session.retrieve(session_id, expand=["subscription"])
    subscription = getattr(session, "subscription", None) or session.get("subscription")
    email = None
    customer_details = getattr(session, "customer_details", None) or session.get("customer_details", {})
    if customer_details:
        email = getattr(customer_details, "email", None) or customer_details.get("email")
    if not email:
        metadata = getattr(session, "metadata", None) or session.get("metadata", {})
        email = metadata.get("email")
    if not subscription:
        raise HTTPException(status_code=400, detail="Checkout session has no subscription.")
    record = sync_subscription_object(subscription, email_hint=email)
    if not record:
        raise HTTPException(status_code=400, detail="Unable to resolve subscription email from checkout session.")
    return record


def handle_webhook(payload: bytes, signature: str | None) -> dict:
    settings = get_settings()
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Stripe webhook secret is not configured.")

    _configure_stripe()
    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=signature,
            secret=settings.stripe_webhook_secret,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid webhook payload: {exc}") from exc
    except stripe.error.SignatureVerificationError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid Stripe signature: {exc}") from exc

    event_type = event["type"]
    logger.info(f"[STRIPE] Webhook received: {event_type}")

    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        confirm_checkout_session(session["id"])
    elif event_type in {"customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"}:
        subscription = event["data"]["object"]
        sync_subscription_object(subscription)

    return {"received": True, "type": event_type}
