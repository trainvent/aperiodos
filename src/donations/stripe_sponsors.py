from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Any

try:
    import stripe
except ModuleNotFoundError:  # pragma: no cover
    stripe = None

try:
    from google.cloud import firestore
except ModuleNotFoundError:  # pragma: no cover
    firestore = None


class DonationError(RuntimeError):
    """Raised when donation setup/configuration is missing or invalid."""


def _to_bool(value: Any, default: bool = True) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _trimmed_text(value: Any, *, max_length: int, fallback: str = "") -> str:
    text = str(value or "").strip()
    if not text:
        return fallback
    return text[:max_length]


@dataclass(frozen=True)
class CheckoutUrls:
    success_url: str
    cancel_url: str


class SponsorsStore:
    def __init__(self, source: str | Path = "firestore"):
        self._source = str(source).strip()
        self._firestore_client = None
        self._init_lock = Lock()
        self._initialized = False

    def _connect(self):
        if firestore is None:
            raise DonationError(
                "Firestore support is unavailable. "
                "Add `google-cloud-firestore` to requirements."
            )

        if self._firestore_client is None:
            project_id = (
                os.environ.get("FIRESTORE_PROJECT_ID")
                or os.environ.get("GOOGLE_CLOUD_PROJECT")
                or os.environ.get("GCLOUD_PROJECT")
                or None
            )
            database_id = os.environ.get("FIRESTORE_DATABASE_ID") or "(default)"
            self._firestore_client = firestore.Client(
                project=project_id,
                database=database_id,
            )
        return self._firestore_client

    def ensure_schema(self) -> None:
        if self._initialized:
            return
        with self._init_lock:
            if self._initialized:
                return
            self._connect()
            self._initialized = True

    def has_processed_event(self, event_id: str) -> bool:
        self.ensure_schema()
        connection = self._connect()
        doc = connection.collection("stripe_events").document(event_id).get()
        return doc.exists

    def mark_event_processed(self, event_id: str) -> None:
        self.ensure_schema()
        now_iso = datetime.now(UTC).replace(microsecond=0).isoformat()
        connection = self._connect()
        connection.collection("stripe_events").document(event_id).set(
            {"created_at": now_iso}
        )

    def add_sponsor(
        self,
        *,
        stripe_session_id: str,
        stripe_event_id: str,
        donor_name: str,
        amount_cents: int,
        currency: str,
        message: str,
        is_public: bool,
        created_at: str,
    ) -> bool:
        self.ensure_schema()
        connection = self._connect()
        sponsor_ref = connection.collection("sponsors").document(stripe_session_id)
        if sponsor_ref.get().exists:
            return False

        sponsor_ref.create(
            {
                "stripe_session_id": stripe_session_id,
                "stripe_event_id": stripe_event_id,
                "donor_name": donor_name,
                "amount_cents": amount_cents,
                "currency": currency.lower(),
                "message": message,
                "is_public": bool(is_public),
                "created_at": created_at,
            }
        )
        return True

    def list_public_sponsors(self, limit: int = 100) -> list[dict[str, Any]]:
        self.ensure_schema()
        safe_limit = min(max(int(limit), 1), 500)
        connection = self._connect()
        query = (
            connection.collection("sponsors")
            .where("is_public", "==", True)
            .order_by("created_at", direction=firestore.Query.DESCENDING)
            .limit(safe_limit)
        )
        rows = query.stream()
        sponsor_rows = []
        for row in rows:
            data = row.to_dict() or {}
            sponsor_rows.append(
                {
                    "name": data.get("donor_name", ""),
                    "amount_cents": int(data.get("amount_cents", 0)),
                    "currency": data.get("currency", ""),
                    "message": data.get("message", "") or "",
                    "created_at": data.get("created_at", ""),
                }
            )
        return sponsor_rows


def build_checkout_urls(base_url: str, *, donate_path: str = "/donate") -> CheckoutUrls:
    normalized = base_url.rstrip("/")
    return CheckoutUrls(
        success_url=(
            f"{normalized}{donate_path}?status=success&"
            "session_id={CHECKOUT_SESSION_ID}"
        ),
        cancel_url=f"{normalized}{donate_path}?status=cancelled",
    )


def create_donation_checkout_session(
    *,
    stripe_secret_key: str,
    amount_cents: int,
    currency: str,
    donor_name: str,
    donor_message: str,
    is_public: bool,
    success_url: str,
    cancel_url: str,
    statement_descriptor_suffix: str = "Aperiodos",
) -> dict[str, str]:
    if stripe is None:
        raise DonationError(
            "Stripe SDK is not installed. Add `stripe` to requirements."
        )
    if not stripe_secret_key:
        raise DonationError("Missing Stripe secret key.")

    clean_name = _trimmed_text(
        donor_name,
        max_length=120,
        fallback="Anonymous Sponsor",
    )
    clean_message = _trimmed_text(donor_message, max_length=280)
    metadata = {
        "donor_name": clean_name,
        "donor_message": clean_message,
        "is_public": "1" if is_public else "0",
    }

    stripe.api_key = stripe_secret_key
    session = stripe.checkout.Session.create(
        mode="payment",
        submit_type="donate",
        success_url=success_url,
        cancel_url=cancel_url,
        allow_promotion_codes=True,
        customer_creation="always",
        line_items=[
            {
                "quantity": 1,
                "price_data": {
                    "currency": currency.lower(),
                    "unit_amount": int(amount_cents),
                    "product_data": {
                        "name": "Aperiodos Sponsor Donation",
                    },
                },
            }
        ],
        payment_intent_data={
            "metadata": metadata,
            "statement_descriptor_suffix": statement_descriptor_suffix[:22],
        },
        metadata=metadata,
    )

    return {"id": session.id, "url": session.url}


def retrieve_checkout_session(
    *,
    stripe_secret_key: str,
    checkout_session_id: str,
) -> dict[str, Any]:
    if stripe is None:
        raise DonationError(
            "Stripe SDK is not installed. Add `stripe` to requirements."
        )
    if not stripe_secret_key:
        raise DonationError("Missing Stripe secret key.")

    clean_session_id = _trimmed_text(checkout_session_id, max_length=200)
    if not clean_session_id:
        raise DonationError("Missing Stripe checkout session id.")

    stripe.api_key = stripe_secret_key
    session = stripe.checkout.Session.retrieve(clean_session_id)
    return session if isinstance(session, dict) else dict(session)


def parse_stripe_event(
    *,
    payload: bytes,
    signature_header: str,
    stripe_secret_key: str,
    webhook_secret: str,
) -> dict[str, Any]:
    if stripe is None:
        raise DonationError(
            "Stripe SDK is not installed. Add `stripe` to requirements."
        )
    if not stripe_secret_key:
        raise DonationError("Missing Stripe secret key.")

    stripe.api_key = stripe_secret_key

    if webhook_secret:
        try:
            event = stripe.Webhook.construct_event(
                payload,
                signature_header,
                webhook_secret,
            )
        except Exception as exc:  # noqa: BLE001
            raise DonationError("Invalid Stripe webhook signature.") from exc
        return event

    try:
        decoded = payload.decode("utf-8")
        return json.loads(decoded)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise DonationError("Webhook payload is not valid JSON.") from exc


def record_sponsor_from_event(
    store: SponsorsStore,
    event: dict[str, Any],
) -> bool:
    event_id = str(event.get("id") or "").strip()
    event_type = str(event.get("type") or "")
    if not event_id or event_type not in {
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
    }:
        return False

    if store.has_processed_event(event_id):
        return False

    data = event.get("data") or {}
    session = data.get("object") or {}
    session_id = str(session.get("id") or "").strip()
    return record_sponsor_from_checkout_session(
        store,
        session=session,
        event_id=event_id,
        session_id=session_id,
        created_ts=event.get("created"),
    )


def record_sponsor_from_checkout_session(
    store: SponsorsStore,
    *,
    session: dict[str, Any],
    event_id: str = "",
    session_id: str = "",
    created_ts: int | float | None = None,
) -> bool:
    session_id = str(session_id or session.get("id") or "").strip()
    if not session_id:
        if event_id:
            store.mark_event_processed(event_id)
        return False

    payment_status = str(session.get("payment_status") or "").lower()
    if payment_status and payment_status != "paid":
        if event_id:
            store.mark_event_processed(event_id)
        return False

    metadata = session.get("metadata") or {}
    customer_details = session.get("customer_details") or {}
    donor_name = _trimmed_text(
        metadata.get("donor_name") or customer_details.get("name"),
        max_length=120,
        fallback="Anonymous Sponsor",
    )
    donor_message = _trimmed_text(
        metadata.get("donor_message"),
        max_length=280,
    )
    is_public = _to_bool(metadata.get("is_public"), default=True)
    amount_cents = int(session.get("amount_total") or 0)
    currency = str(session.get("currency") or "eur").lower()
    if amount_cents <= 0:
        if event_id:
            store.mark_event_processed(event_id)
        return False

    if isinstance(created_ts, (int, float)):
        created_at = datetime.fromtimestamp(
            created_ts,
            tz=UTC,
        ).replace(microsecond=0).isoformat()
    else:
        created_at = datetime.now(UTC).replace(microsecond=0).isoformat()

    store.add_sponsor(
        stripe_session_id=session_id,
        stripe_event_id=event_id,
        donor_name=donor_name,
        amount_cents=amount_cents,
        currency=currency,
        message=donor_message,
        is_public=is_public,
        created_at=created_at,
    )
    if event_id:
        store.mark_event_processed(event_id)
    return True
