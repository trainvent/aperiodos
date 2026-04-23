from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Any

try:
    import stripe
except ModuleNotFoundError:  # pragma: no cover
    stripe = None


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
    def __init__(self, db_path: str | Path):
        self._db_path = Path(db_path)
        self._init_lock = Lock()
        self._initialized = False

    def _connect(self) -> sqlite3.Connection:
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self._db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def ensure_schema(self) -> None:
        if self._initialized:
            return
        with self._init_lock:
            if self._initialized:
                return
            with self._connect() as connection:
                connection.execute(
                    """
                    CREATE TABLE IF NOT EXISTS sponsors (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        stripe_session_id TEXT NOT NULL UNIQUE,
                        stripe_event_id TEXT,
                        donor_name TEXT NOT NULL,
                        amount_cents INTEGER NOT NULL,
                        currency TEXT NOT NULL,
                        message TEXT,
                        is_public INTEGER NOT NULL DEFAULT 1,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                connection.execute(
                    """
                    CREATE INDEX IF NOT EXISTS idx_sponsors_public_created
                    ON sponsors (is_public, created_at DESC)
                    """
                )
                connection.execute(
                    """
                    CREATE TABLE IF NOT EXISTS stripe_events (
                        event_id TEXT PRIMARY KEY,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                connection.commit()
            self._initialized = True

    def has_processed_event(self, event_id: str) -> bool:
        self.ensure_schema()
        with self._connect() as connection:
            row = connection.execute(
                "SELECT event_id FROM stripe_events WHERE event_id = ? LIMIT 1",
                (event_id,),
            ).fetchone()
            return row is not None

    def mark_event_processed(self, event_id: str) -> None:
        self.ensure_schema()
        now_iso = datetime.now(UTC).replace(microsecond=0).isoformat()
        with self._connect() as connection:
            connection.execute(
                "INSERT OR IGNORE INTO stripe_events (event_id, created_at) VALUES (?, ?)",
                (event_id, now_iso),
            )
            connection.commit()

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
        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT OR IGNORE INTO sponsors (
                    stripe_session_id,
                    stripe_event_id,
                    donor_name,
                    amount_cents,
                    currency,
                    message,
                    is_public,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    stripe_session_id,
                    stripe_event_id,
                    donor_name,
                    amount_cents,
                    currency.lower(),
                    message,
                    1 if is_public else 0,
                    created_at,
                ),
            )
            connection.commit()
            return cursor.rowcount > 0

    def list_public_sponsors(self, limit: int = 100) -> list[dict[str, Any]]:
        self.ensure_schema()
        safe_limit = min(max(int(limit), 1), 500)
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT donor_name, amount_cents, currency, message, created_at
                FROM sponsors
                WHERE is_public = 1
                ORDER BY datetime(created_at) DESC
                LIMIT ?
                """,
                (safe_limit,),
            ).fetchall()

        return [
            {
                "name": row["donor_name"],
                "amount_cents": int(row["amount_cents"]),
                "currency": row["currency"],
                "message": row["message"] or "",
                "created_at": row["created_at"],
            }
            for row in rows
        ]


def build_checkout_urls(base_url: str, *, donate_path: str = "/donate") -> CheckoutUrls:
    normalized = base_url.rstrip("/")
    return CheckoutUrls(
        success_url=f"{normalized}{donate_path}?status=success&session_id={{CHECKOUT_SESSION_ID}}",
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
        raise DonationError("Stripe SDK is not installed. Add `stripe` to requirements.")
    if not stripe_secret_key:
        raise DonationError("Missing Stripe secret key.")

    clean_name = _trimmed_text(donor_name, max_length=120, fallback="Anonymous Sponsor")
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


def parse_stripe_event(
    *,
    payload: bytes,
    signature_header: str,
    stripe_secret_key: str,
    webhook_secret: str,
) -> dict[str, Any]:
    if stripe is None:
        raise DonationError("Stripe SDK is not installed. Add `stripe` to requirements.")
    if not stripe_secret_key:
        raise DonationError("Missing Stripe secret key.")

    stripe.api_key = stripe_secret_key

    if webhook_secret:
        try:
            event = stripe.Webhook.construct_event(payload, signature_header, webhook_secret)
        except Exception as exc:  # noqa: BLE001
            raise DonationError("Invalid Stripe webhook signature.") from exc
        return event

    try:
        decoded = payload.decode("utf-8")
        return json.loads(decoded)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise DonationError("Webhook payload is not valid JSON.") from exc


def record_sponsor_from_event(store: SponsorsStore, event: dict[str, Any]) -> bool:
    event_id = str(event.get("id") or "").strip()
    event_type = str(event.get("type") or "")
    if not event_id or event_type not in {"checkout.session.completed", "checkout.session.async_payment_succeeded"}:
        return False

    if store.has_processed_event(event_id):
        return False

    data = event.get("data") or {}
    session = data.get("object") or {}
    session_id = str(session.get("id") or "").strip()
    if not session_id:
        store.mark_event_processed(event_id)
        return False

    payment_status = str(session.get("payment_status") or "").lower()
    if payment_status and payment_status != "paid":
        store.mark_event_processed(event_id)
        return False

    metadata = session.get("metadata") or {}
    customer_details = session.get("customer_details") or {}
    donor_name = _trimmed_text(
        metadata.get("donor_name") or customer_details.get("name"),
        max_length=120,
        fallback="Anonymous Sponsor",
    )
    donor_message = _trimmed_text(metadata.get("donor_message"), max_length=280)
    is_public = _to_bool(metadata.get("is_public"), default=True)
    amount_cents = int(session.get("amount_total") or 0)
    currency = str(session.get("currency") or "eur").lower()
    if amount_cents <= 0:
        store.mark_event_processed(event_id)
        return False

    created_ts = event.get("created")
    if isinstance(created_ts, (int, float)):
        created_at = datetime.fromtimestamp(created_ts, tz=UTC).replace(microsecond=0).isoformat()
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
    store.mark_event_processed(event_id)
    return True
