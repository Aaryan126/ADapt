from fastapi import APIRouter, HTTPException, Query, Request

from app.models import BillingEmailRequest
from app.services.billing import (
    confirm_checkout_session,
    create_checkout_session,
    create_portal_session,
    get_billing_config,
    handle_webhook,
    refresh_subscription_status,
)

router = APIRouter(prefix="/billing")


@router.get("/config")
async def billing_config():
    return {"status": "ok", "data": get_billing_config()}


@router.get("/status")
async def billing_status(email: str = Query(...)):
    return {"status": "ok", "data": refresh_subscription_status(email)}


@router.post("/checkout")
async def billing_checkout(req: BillingEmailRequest):
    return {"status": "ok", "data": create_checkout_session(req.email)}


@router.post("/portal")
async def billing_portal(req: BillingEmailRequest):
    return {"status": "ok", "data": create_portal_session(req.email)}


@router.get("/confirm")
async def billing_confirm(session_id: str = Query(...)):
    return {"status": "ok", "data": confirm_checkout_session(session_id)}


@router.post("/webhook")
async def billing_webhook(request: Request):
    signature = request.headers.get("stripe-signature")
    payload = await request.body()
    result = handle_webhook(payload, signature)
    return {"status": "ok", "data": result}
