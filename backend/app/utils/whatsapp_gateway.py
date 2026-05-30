"""WhatsApp message gateway — mock implementation.

Provides a unified async interface for dispatching WhatsApp messages.
Currently simulates an API call (e.g. Twilio / Gallabox / Gupshup)
using asyncio.sleep and standard logging.

Replace the mock with a real HTTP client when the provider is onboarded.
"""

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("bizpilot.whatsapp")


@dataclass
class WhatsAppResult:
    """Outcome of a dispatched WhatsApp message."""
    success: bool
    message_id: str
    phone_number: str
    timestamp: datetime
    provider: str = "mock"
    error: Optional[str] = None


async def dispatch_whatsapp_message(
    phone_number: str,
    message: str,
    *,
    simulate_failure: bool = False,
    latency_seconds: float = 0.5,
) -> WhatsAppResult:
    """Send a WhatsApp message via the configured provider (currently mocked).

    Parameters
    ----------
    phone_number : str
        Recipient phone number in E.164 format (e.g. +919876543210).
    message : str
        The full message body to deliver.
    simulate_failure : bool
        If True, simulate a provider API failure (useful for testing retry logic).
    latency_seconds : float
        Simulated network round-trip latency.

    Returns
    -------
    WhatsAppResult
        Structured outcome including a generated message_id and status.
    """
    message_id = f"wamid.{uuid.uuid4().hex[:24]}"
    timestamp = datetime.now(timezone.utc)

    logger.info(
        "WhatsApp DISPATCH [%s] → %s | length=%d chars",
        message_id,
        phone_number,
        len(message),
    )

    # Simulate network latency
    await asyncio.sleep(latency_seconds)

    if simulate_failure:
        error_msg = "Simulated provider API failure (HTTP 503)"
        logger.error(
            "WhatsApp FAILED  [%s] → %s | error=%s",
            message_id,
            phone_number,
            error_msg,
        )
        return WhatsAppResult(
            success=False,
            message_id=message_id,
            phone_number=phone_number,
            timestamp=timestamp,
            error=error_msg,
        )

    # --- Mock success ---
    logger.info(
        "WhatsApp SENT    [%s] → %s | provider=mock | status=delivered",
        message_id,
        phone_number,
    )

    # Log a preview of the message (truncated for readability)
    preview = message[:120].replace("\n", " ")
    if len(message) > 120:
        preview += "…"
    logger.debug("  Message preview: %s", preview)

    return WhatsAppResult(
        success=True,
        message_id=message_id,
        phone_number=phone_number,
        timestamp=timestamp,
    )
