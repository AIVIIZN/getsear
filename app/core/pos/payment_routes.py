"""Payment API routes for Sear POS.

Blueprint: payments_bp mounted at /api/v1/payments
Handles card, cash, gift card, bar tab, split, void, refund, tips,
and settlement reporting. All amounts in INTEGER CENTS.
"""

from __future__ import annotations

from datetime import datetime, timezone

import structlog
from flask import Blueprint, g, request

from app.core.pos.payments.flows.bar_tab import BarTabManager
from app.core.pos.payments.flows.cash import CashPaymentManager
from app.core.pos.payments.flows.refunds import RefundManager
from app.core.pos.payments.flows.split_payment import SplitPaymentManager
from app.core.pos.payments.flows.standard import StandardPaymentFlow
from app.core.pos.payments.flows.tips import TipCalculator
from app.core.pos.payments.gift_cards import GiftCardSystem
from app.core.pos.payments.processor import PaymentProcessor
from app.core.pos.payments.valor import TransactionStatus
from app.extensions import supabase_client
from app.shared.audit import log_audit
from app.shared.decorators import require_auth, require_location, require_permission
from app.shared.event_bus import event_bus
from app.shared.responses import api_error, api_success

log = structlog.get_logger(__name__)

payments_bp = Blueprint("payments", __name__, url_prefix="/api/v1/payments")


def _get_processor() -> PaymentProcessor:
    """Lazy-load PaymentProcessor for the current org."""
    return PaymentProcessor(org_id=g.org_id)


# ---------------------------------------------------------------------------
# POST /process — Process payment (card / cash / gift_card / house_account)
# ---------------------------------------------------------------------------


@payments_bp.route("/process", methods=["POST"])
@require_auth
@require_location
def process_payment():
    """Route a payment to the appropriate flow based on payment_method.

    Body:
        order_id (required)
        payment_method: card | cash | gift_card | house_account
        terminal_id: required for card
        amount_cents: for partial/split payments
        tip_cents: tip in cents
        cash_tendered_cents: required for cash
        gift_card_number: required for gift_card
    """
    data = request.get_json(silent=True) or {}

    order_id = data.get("order_id", "").strip()
    if not order_id:
        return api_error("order_id is required", 400)

    payment_method = data.get("payment_method", "").strip().lower()
    if payment_method not in ("card", "cash", "gift_card", "house_account"):
        return api_error(f"Invalid payment_method: {payment_method}", 400)

    tip_cents = data.get("tip_cents", 0)
    if not isinstance(tip_cents, int) or tip_cents < 0:
        return api_error("tip_cents must be a non-negative integer", 400)

    try:
        if payment_method == "card":
            terminal_id = data.get("terminal_id", "").strip()
            if not terminal_id:
                return api_error("terminal_id is required for card payments", 400)

            processor = _get_processor()
            flow = StandardPaymentFlow(processor)
            result = flow.process_card_payment(
                order_id=order_id,
                terminal_id=terminal_id,
                tip_cents=tip_cents,
                capture_immediately=data.get("capture_immediately", True),
                user_id=g.user_id,
                org_id=g.org_id,
            )

        elif payment_method == "cash":
            cash_tendered = data.get("cash_tendered_cents")
            if cash_tendered is None or not isinstance(cash_tendered, int):
                return api_error("cash_tendered_cents is required for cash payments", 400)
            if cash_tendered <= 0:
                return api_error("cash_tendered_cents must be positive", 400)

            flow = CashPaymentManager()
            result = flow.process_cash_payment(
                order_id=order_id,
                amount_tendered_cents=cash_tendered,
                user_id=g.user_id,
                org_id=g.org_id,
            )

        elif payment_method == "gift_card":
            gc_number = data.get("gift_card_number", "").strip()
            if not gc_number:
                return api_error("gift_card_number is required for gift card payments", 400)

            amount_cents = data.get("amount_cents")
            if amount_cents is not None and (not isinstance(amount_cents, int) or amount_cents <= 0):
                return api_error("amount_cents must be a positive integer", 400)

            # Get order to determine amount if not specified
            if amount_cents is None:
                order = _get_order(order_id, g.org_id)
                if not order:
                    return api_error("Order not found", 404)
                amount_cents = order["balance_due_cents"]

            gc_system = GiftCardSystem()
            result = gc_system.redeem(
                card_number=gc_number,
                amount_cents=amount_cents,
                order_id=order_id,
                user_id=g.user_id,
                org_id=g.org_id,
            )

            # If gift card fully or partially covered it, update order balance
            if result.get("success"):
                redeemed = result["redeemed_cents"]
                order = _get_order(order_id, g.org_id)
                if order:
                    new_balance = order["balance_due_cents"] - redeemed
                    _update_order_balance(order_id, g.org_id, new_balance)

                    if new_balance <= 0:
                        _close_order(order_id, g.org_id)

        elif payment_method == "house_account":
            amount_cents = data.get("amount_cents")
            result = _process_house_account(
                order_id=order_id,
                amount_cents=amount_cents,
                user_id=g.user_id,
                org_id=g.org_id,
            )

        else:
            return api_error(f"Unsupported payment method: {payment_method}", 400)

    except ValueError as exc:
        return api_error(str(exc), 400)
    except Exception:
        log.exception("payment.process_failed", order_id=order_id, method=payment_method)
        return api_error("Payment processing failed", 500)

    if not result.get("success"):
        status = 402 if "declined" in result.get("error", "").lower() else 400
        if result.get("needs_manager"):
            status = 403
        return api_error(result.get("error", "Payment failed"), status, errors=[result])

    return api_success(result, status=201)


# ---------------------------------------------------------------------------
# POST /capture — Capture a pre-authorized payment
# ---------------------------------------------------------------------------


@payments_bp.route("/capture", methods=["POST"])
@require_auth
def capture_payment():
    """Capture a previously authorized payment (bar tab close, deferred capture).

    Body: payment_id, tip_cents (optional)
    """
    data = request.get_json(silent=True) or {}
    payment_id = data.get("payment_id", "").strip()
    if not payment_id:
        return api_error("payment_id is required", 400)

    tip_cents = data.get("tip_cents", 0)
    if not isinstance(tip_cents, int) or tip_cents < 0:
        return api_error("tip_cents must be a non-negative integer", 400)

    payment = _get_payment(payment_id, g.org_id)
    if not payment:
        return api_error("Payment not found", 404)

    if payment["status"] != TransactionStatus.AUTHORIZED.value:
        return api_error(f"Cannot capture payment in status: {payment['status']}", 400)

    processor_txn_id = payment.get("processor_transaction_id")
    if not processor_txn_id:
        return api_error("No processor transaction to capture", 400)

    try:
        processor = _get_processor()

        # If this is a bar tab, use BarTabManager for proper flow
        if payment.get("is_bar_tab"):
            order_id = payment["order_id"]
            tab_mgr = BarTabManager(processor)
            result = tab_mgr.close_tab(
                order_id=order_id,
                tip_cents=tip_cents,
                user_id=g.user_id,
                org_id=g.org_id,
            )
        else:
            # Direct capture
            order = _get_order(payment["order_id"], g.org_id)
            capture_amount = order["total_cents"] if order else payment["amount_cents"]

            capture_result = processor.capture(
                transaction_id=processor_txn_id,
                amount_cents=capture_amount,
                tip_cents=tip_cents,
            )

            if not capture_result.success:
                return api_error(
                    f"Capture failed: {capture_result.error_message}",
                    400,
                )

            now_iso = datetime.now(timezone.utc).isoformat()
            total_cents = capture_amount + tip_cents

            supabase_client.table("payments").update({
                "status": TransactionStatus.CAPTURED.value,
                "amount_cents": capture_amount,
                "tip_cents": tip_cents,
                "total_cents": total_cents,
                "captured_at": now_iso,
                "updated_at": now_iso,
            }).eq("id", payment_id).eq("org_id", g.org_id).execute()

            # Update order balance
            if order:
                new_balance = order["balance_due_cents"] - capture_amount
                _update_order_balance(payment["order_id"], g.org_id, new_balance)
                if new_balance <= 0:
                    _close_order(payment["order_id"], g.org_id)

            event_bus.emit("payment.processed", {
                "payment_id": payment_id,
                "order_id": payment["order_id"],
                "org_id": g.org_id,
                "method": "card",
                "amount_cents": total_cents,
                "tip_cents": tip_cents,
                "status": "captured",
            })

            result = {
                "success": True,
                "payment_id": payment_id,
                "captured_amount_cents": capture_amount,
                "tip_cents": tip_cents,
                "total_cents": total_cents,
            }

    except Exception:
        log.exception("payment.capture_failed", payment_id=payment_id)
        return api_error("Capture failed", 500)

    if not result.get("success"):
        return api_error(result.get("error", "Capture failed"), 400, errors=[result])

    return api_success(result)


# ---------------------------------------------------------------------------
# POST /void — Void a payment
# ---------------------------------------------------------------------------


@payments_bp.route("/void", methods=["POST"])
@require_auth
@require_permission("payments.void")
def void_payment():
    """Void a payment before batch settlement.

    Body: payment_id, reason
    Manager approval (X-Manager-PIN header) required for amounts > $50.
    """
    data = request.get_json(silent=True) or {}
    payment_id = data.get("payment_id", "").strip()
    reason = data.get("reason", "").strip()

    if not payment_id:
        return api_error("payment_id is required", 400)
    if not reason:
        return api_error("reason is required", 400)

    approved_by = _check_manager_pin()

    try:
        processor = _get_processor()
        refund_mgr = RefundManager(processor)
        result = refund_mgr.void_transaction(
            payment_id=payment_id,
            reason=reason,
            approved_by=approved_by,
            user_id=g.user_id,
            org_id=g.org_id,
        )
    except Exception:
        log.exception("payment.void_failed", payment_id=payment_id)
        return api_error("Void failed", 500)

    if not result.get("success"):
        status = 403 if result.get("needs_manager") else 400
        return api_error(result.get("error", "Void failed"), status, errors=[result])

    return api_success(result)


# ---------------------------------------------------------------------------
# POST /refund — Refund a payment
# ---------------------------------------------------------------------------


@payments_bp.route("/refund", methods=["POST"])
@require_auth
@require_permission("payments.refund")
def refund_payment():
    """Refund a captured/settled payment. Full or partial.

    Body: payment_id, amount_cents (optional for partial), reason
    Manager approval for amounts > $50 or unlinked refunds.
    """
    data = request.get_json(silent=True) or {}
    payment_id = data.get("payment_id", "").strip()
    reason = data.get("reason", "").strip()
    amount_cents = data.get("amount_cents")
    is_unlinked = data.get("unlinked", False)
    card_token = data.get("card_token", "").strip()

    if not payment_id and not is_unlinked:
        return api_error("payment_id is required", 400)

    if amount_cents is not None:
        if not isinstance(amount_cents, int) or amount_cents <= 0:
            return api_error("amount_cents must be a positive integer", 400)

    approved_by = _check_manager_pin()

    try:
        processor = _get_processor()
        refund_mgr = RefundManager(processor)

        if is_unlinked:
            order_id = data.get("order_id", "").strip()
            if not order_id:
                return api_error("order_id required for unlinked refunds", 400)
            if not amount_cents:
                return api_error("amount_cents required for unlinked refunds", 400)
            if not card_token:
                return api_error("card_token required for unlinked refunds", 400)
            if not approved_by:
                return api_error("Manager approval required for unlinked refunds", 403)

            result = refund_mgr.unlinked_refund(
                order_id=order_id,
                amount_cents=amount_cents,
                card_token=card_token,
                reason=reason or "unlinked refund",
                approved_by=approved_by,
                user_id=g.user_id,
                org_id=g.org_id,
            )
        else:
            result = refund_mgr.refund_transaction(
                payment_id=payment_id,
                amount_cents=amount_cents,
                reason=reason,
                approved_by=approved_by,
                user_id=g.user_id,
                org_id=g.org_id,
            )
    except Exception:
        log.exception("payment.refund_failed", payment_id=payment_id)
        return api_error("Refund failed", 500)

    if not result.get("success"):
        status = 403 if result.get("needs_manager") else 400
        return api_error(result.get("error", "Refund failed"), status, errors=[result])

    return api_success(result)


# ---------------------------------------------------------------------------
# POST /adjust-tip — Adjust tip on a captured payment
# ---------------------------------------------------------------------------


@payments_bp.route("/adjust-tip", methods=["POST"])
@require_auth
def adjust_tip():
    """Adjust tip on a captured payment within the adjustment window (24-48 hrs).

    Body: payment_id, tip_cents
    """
    data = request.get_json(silent=True) or {}
    payment_id = data.get("payment_id", "").strip()
    tip_cents = data.get("tip_cents")

    if not payment_id:
        return api_error("payment_id is required", 400)
    if tip_cents is None or not isinstance(tip_cents, int) or tip_cents < 0:
        return api_error("tip_cents must be a non-negative integer", 400)

    payment = _get_payment(payment_id, g.org_id)
    if not payment:
        return api_error("Payment not found", 404)

    if payment["status"] not in ("captured", "authorized"):
        return api_error(f"Cannot adjust tip on payment in status: {payment['status']}", 400)

    # Check adjustment window: captured_at or created_at must be within 48 hours
    ref_time_str = payment.get("captured_at") or payment.get("created_at")
    if ref_time_str:
        try:
            if isinstance(ref_time_str, str):
                ref_time = datetime.fromisoformat(ref_time_str.replace("Z", "+00:00"))
            else:
                ref_time = ref_time_str
            hours_since = (datetime.now(timezone.utc) - ref_time).total_seconds() / 3600
            if hours_since > 48:
                return api_error("Tip adjustment window has closed (48 hours max)", 400)
        except (ValueError, TypeError) as exc:
            log.warning("payment.tip_adjust_date_parse_failed", payment_id=payment_id, ref_time=ref_time_str, error=str(exc))
            return api_error("Unable to determine tip adjustment window: invalid payment timestamp", 400)

    old_tip_cents = payment.get("tip_cents", 0)
    old_total = payment.get("total_cents", payment.get("amount_cents", 0))
    base_amount = old_total - old_tip_cents
    new_total = base_amount + tip_cents

    try:
        processor = _get_processor()

        # Adjust tip at processor level
        adjust_result = processor.adjust_tip(
            transaction_id=payment["processor_transaction_id"],
            tip_cents=tip_cents,
        )

        if not adjust_result.success:
            return api_error(
                f"Tip adjustment failed: {adjust_result.error_message}",
                400,
            )

        now_iso = datetime.now(timezone.utc).isoformat()

        supabase_client.table("payments").update({
            "tip_cents": tip_cents,
            "total_cents": new_total,
            "tip_adjusted_at": now_iso,
            "updated_at": now_iso,
        }).eq("id", payment_id).eq("org_id", g.org_id).execute()

        # Log the adjustment
        from uuid import uuid4
        supabase_client.table("payment_transactions").insert({
            "id": str(uuid4()),
            "payment_id": payment_id,
            "org_id": g.org_id,
            "order_id": payment.get("order_id", ""),
            "action": "tip_adjusted",
            "amount_cents": tip_cents,
            "performed_by": g.user_id,
            "reason": f"Tip adjusted from {old_tip_cents} to {tip_cents}",
            "created_at": now_iso,
        }).execute()

    except Exception:
        log.exception("payment.adjust_tip_failed", payment_id=payment_id)
        return api_error("Tip adjustment failed", 500)

    log_audit(
        org_id=g.org_id,
        user_id=g.user_id,
        action="payment.tip_adjusted",
        entity_type="payment",
        entity_id=payment_id,
        description=f"Tip adjusted from ${old_tip_cents / 100:.2f} to ${tip_cents / 100:.2f}",
        previous_state={"tip_cents": old_tip_cents, "total_cents": old_total},
        new_state={"tip_cents": tip_cents, "total_cents": new_total},
    )

    event_bus.emit("payment.tip_adjusted", {
        "payment_id": payment_id,
        "order_id": payment.get("order_id", ""),
        "org_id": g.org_id,
        "old_tip_cents": old_tip_cents,
        "new_tip_cents": tip_cents,
        "new_total_cents": new_total,
    })

    return api_success({
        "success": True,
        "payment_id": payment_id,
        "old_tip_cents": old_tip_cents,
        "new_tip_cents": tip_cents,
        "new_total_cents": new_total,
    })


# ---------------------------------------------------------------------------
# POST /preauth — Pre-authorize card (bar tabs)
# ---------------------------------------------------------------------------


@payments_bp.route("/preauth", methods=["POST"])
@require_auth
@require_location
def preauth_payment():
    """Pre-authorize a card for bar tab.

    Body: order_id, terminal_id, amount_cents (optional hold amount)
    """
    data = request.get_json(silent=True) or {}
    order_id = data.get("order_id", "").strip()
    terminal_id = data.get("terminal_id", "").strip()
    amount_cents = data.get("amount_cents")

    if not order_id:
        return api_error("order_id is required", 400)
    if not terminal_id:
        return api_error("terminal_id is required", 400)

    if amount_cents is not None:
        if not isinstance(amount_cents, int) or amount_cents <= 0:
            return api_error("amount_cents must be a positive integer", 400)

    try:
        processor = _get_processor()
        tab_mgr = BarTabManager(processor)
        result = tab_mgr.open_tab(
            order_id=order_id,
            terminal_id=terminal_id,
            hold_cents=amount_cents,
            user_id=g.user_id,
            org_id=g.org_id,
        )
    except Exception:
        log.exception("payment.preauth_failed", order_id=order_id)
        return api_error("Pre-authorization failed", 500)

    if not result.get("success"):
        status = 402 if "declined" in result.get("error", "").lower() else 400
        return api_error(result.get("error", "Pre-auth failed"), status, errors=[result])

    return api_success(result, status=201)


# ---------------------------------------------------------------------------
# GET /settlement-report — End-of-day settlement/batch report
# ---------------------------------------------------------------------------


@payments_bp.route("/settlement-report", methods=["GET"])
@require_auth
@require_location
@require_permission("reports.settlement")
def settlement_report():
    """Get settlement/batch report for a date and location.

    Query: date (YYYY-MM-DD), location_id (from header or param)
    Returns: transaction summary, card brand breakdown, tips, net amounts.
    """
    date_str = request.args.get("date", "").strip()
    if not date_str:
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return api_error("date must be YYYY-MM-DD format", 400)

    start = f"{date_str}T00:00:00+00:00"
    end = f"{date_str}T23:59:59+00:00"

    try:
        # Get all payments for the date/location
        resp = (
            supabase_client.table("payments")
            .select("*")
            .eq("org_id", g.org_id)
            .gte("created_at", start)
            .lte("created_at", end)
            .in_("status", ["captured", "settled", "refunded", "partially_refunded", "voided"])
            .execute()
        )
        payments = resp.data or []

        # Summarize
        total_sales_cents = 0
        total_tips_cents = 0
        total_refunds_cents = 0
        total_voids_cents = 0
        transaction_count = 0
        card_brand_breakdown: dict[str, dict] = {}
        method_breakdown: dict[str, dict] = {}

        for p in payments:
            method = p.get("payment_method", "unknown")
            status = p.get("status", "")
            amount = p.get("amount_cents", 0)
            tips = p.get("tip_cents", 0)
            total = p.get("total_cents", 0)

            if status == "voided":
                total_voids_cents += amount
                continue

            if status in ("refunded", "partially_refunded"):
                total_refunds_cents += p.get("refunded_amount_cents", 0)

            if status in ("captured", "settled", "partially_refunded"):
                total_sales_cents += amount
                total_tips_cents += tips
                transaction_count += 1

            # Method breakdown
            if method not in method_breakdown:
                method_breakdown[method] = {"count": 0, "amount_cents": 0, "tip_cents": 0}
            method_breakdown[method]["count"] += 1
            method_breakdown[method]["amount_cents"] += amount
            method_breakdown[method]["tip_cents"] += tips

            # Card brand breakdown
            brand = p.get("card_brand")
            if brand:
                if brand not in card_brand_breakdown:
                    card_brand_breakdown[brand] = {"count": 0, "amount_cents": 0, "tip_cents": 0}
                card_brand_breakdown[brand]["count"] += 1
                card_brand_breakdown[brand]["amount_cents"] += amount
                card_brand_breakdown[brand]["tip_cents"] += tips

        net_amount_cents = total_sales_cents + total_tips_cents - total_refunds_cents

        report = {
            "date": date_str,
            "location_id": g.location_id,
            "org_id": g.org_id,
            "summary": {
                "transaction_count": transaction_count,
                "total_sales_cents": total_sales_cents,
                "total_tips_cents": total_tips_cents,
                "total_refunds_cents": total_refunds_cents,
                "total_voids_cents": total_voids_cents,
                "net_amount_cents": net_amount_cents,
            },
            "card_brand_breakdown": card_brand_breakdown,
            "method_breakdown": method_breakdown,
        }

    except Exception:
        log.exception("payment.settlement_report_failed")
        return api_error("Failed to generate settlement report", 500)

    return api_success(report)


# ---------------------------------------------------------------------------
# Gift Card endpoints
# ---------------------------------------------------------------------------


@payments_bp.route("/gift-cards/activate", methods=["POST"])
@require_auth
@require_location
def activate_gift_card():
    """Activate a new gift card.

    Body: initial_balance_cents, card_type (physical/digital),
          purchaser_info, recipient_info
    """
    data = request.get_json(silent=True) or {}

    balance = data.get("initial_balance_cents")
    if balance is None or not isinstance(balance, int) or balance <= 0:
        return api_error("initial_balance_cents must be a positive integer", 400)

    card_type = data.get("card_type", "physical")
    if card_type not in ("physical", "digital"):
        return api_error("card_type must be 'physical' or 'digital'", 400)

    try:
        gc = GiftCardSystem()
        result = gc.activate(
            org_id=g.org_id,
            initial_balance_cents=balance,
            purchaser_info=data.get("purchaser_info"),
            recipient_info=data.get("recipient_info"),
            card_type=card_type,
            user_id=g.user_id,
        )
    except Exception:
        log.exception("gift_card.activate_failed")
        return api_error("Gift card activation failed", 500)

    if not result.get("success"):
        return api_error(result.get("error", "Activation failed"), 400)

    return api_success(result, status=201)


@payments_bp.route("/gift-cards/check-balance", methods=["POST"])
@require_auth
def check_gift_card_balance():
    """Check gift card balance.

    Body: card_number
    """
    data = request.get_json(silent=True) or {}
    card_number = data.get("card_number", "").strip()

    if not card_number:
        return api_error("card_number is required", 400)

    try:
        gc = GiftCardSystem()
        result = gc.check_balance(card_number)
    except Exception:
        log.exception("gift_card.check_balance_failed")
        return api_error("Balance check failed", 500)

    if not result.get("success"):
        return api_error(result.get("error", "Card not found"), 404)

    return api_success(result)


@payments_bp.route("/gift-cards/reload", methods=["POST"])
@require_auth
def reload_gift_card():
    """Reload an existing gift card.

    Body: card_number, amount_cents
    """
    data = request.get_json(silent=True) or {}
    card_number = data.get("card_number", "").strip()
    amount_cents = data.get("amount_cents")

    if not card_number:
        return api_error("card_number is required", 400)
    if amount_cents is None or not isinstance(amount_cents, int) or amount_cents <= 0:
        return api_error("amount_cents must be a positive integer", 400)

    try:
        gc = GiftCardSystem()
        result = gc.reload(
            card_number=card_number,
            amount_cents=amount_cents,
            user_id=g.user_id,
            org_id=g.org_id,
        )
    except Exception:
        log.exception("gift_card.reload_failed")
        return api_error("Gift card reload failed", 500)

    if not result.get("success"):
        return api_error(result.get("error", "Reload failed"), 400)

    return api_success(result)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _get_order(order_id: str, org_id: str) -> dict | None:
    """Fetch order and convert dollar amounts to integer cents at the boundary."""
    try:
        resp = (
            supabase_client.table("orders")
            .select("id, org_id, status, subtotal, tax_total, total, balance_due")
            .eq("id", order_id)
            .eq("org_id", org_id)
            .single()
            .execute()
        )
        row = resp.data
        if row:
            row["subtotal_cents"] = int(round(float(row.get("subtotal") or 0) * 100))
            row["tax_cents"] = int(round(float(row.get("tax_total") or 0) * 100))
            row["total_cents"] = int(round(float(row.get("total") or 0) * 100))
            row["balance_due_cents"] = int(round(float(row.get("balance_due") or 0) * 100))
        return row
    except Exception:
        return None


def _get_payment(payment_id: str, org_id: str) -> dict | None:
    try:
        resp = (
            supabase_client.table("payments")
            .select("*")
            .eq("id", payment_id)
            .eq("org_id", org_id)
            .single()
            .execute()
        )
        return resp.data
    except Exception:
        return None


def _update_order_balance(order_id: str, org_id: str, new_balance_cents: int) -> None:
    """Update order balance_due. Converts cents back to dollars for DB storage."""
    try:
        balance_dollars = max(new_balance_cents, 0) / 100.0
        supabase_client.table("orders").update({
            "balance_due": balance_dollars,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", order_id).eq("org_id", org_id).execute()
    except Exception:
        log.exception("payment_route.update_balance_failed", order_id=order_id)


def _close_order(order_id: str, org_id: str) -> None:
    try:
        now = datetime.now(timezone.utc).isoformat()
        supabase_client.table("orders").update({
            "status": "closed",
            "closed_at": now,
            "updated_at": now,
        }).eq("id", order_id).eq("org_id", org_id).execute()

        event_bus.emit("order.closed", {
            "order_id": order_id,
            "org_id": org_id,
            "reason": "fully_paid",
        })

        # Update table status if order has a table
        _update_table_on_close(order_id, org_id)
    except Exception:
        log.exception("payment_route.close_order_failed", order_id=order_id)


def _update_table_on_close(order_id: str, org_id: str) -> None:
    """Set the table to dirty when its order is fully paid."""
    try:
        table_resp = (
            supabase_client.table("tables")
            .select("id, name, location_id")
            .eq("current_order_id", order_id)
            .eq("org_id", org_id)
            .execute()
        )
        for table in table_resp.data or []:
            supabase_client.table("tables").update({
                "status": "dirty",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", table["id"]).eq("org_id", org_id).execute()

            event_bus.emit("table.cleared", {
                "org_id": org_id,
                "location_id": table.get("location_id"),
                "table_id": table["id"],
                "table_name": table.get("name"),
                "reason": "order_paid",
            })
    except Exception:
        log.exception("payment_route.table_update_on_close_failed", order_id=order_id)


def _check_manager_pin() -> str | None:
    """Check for X-Manager-PIN header and verify. Returns manager user_id or None."""
    import bcrypt

    pin = request.headers.get("X-Manager-PIN", "").strip()
    if not pin:
        return None

    org_id = g.org_id

    try:
        resp = (
            supabase_client.table("users")
            .select("id, display_name, role, pin_hash")
            .eq("org_id", org_id)
            .in_("role", ["manager", "admin", "owner"])
            .eq("is_active", True)
            .not_.is_("pin_hash", "null")
            .execute()
        )
        for candidate in (resp.data or []):
            try:
                if bcrypt.checkpw(pin.encode(), candidate["pin_hash"].encode()):
                    g.approving_manager = {
                        "user_id": candidate["id"],
                        "display_name": candidate["display_name"],
                        "role": candidate["role"],
                    }
                    return candidate["id"]
            except Exception:
                continue
    except Exception:
        log.exception("payment_route.manager_pin_verification_failed")

    return None


def _process_house_account(
    order_id: str,
    amount_cents: int | None,
    user_id: str,
    org_id: str,
) -> dict:
    """Charge to house account. Records payment without processor interaction."""
    order = _get_order(order_id, org_id)
    if not order:
        return {"success": False, "error": "Order not found"}

    charge_cents = amount_cents if amount_cents else order["balance_due_cents"]

    if charge_cents <= 0:
        return {"success": False, "error": "Nothing to charge"}

    from uuid import uuid4
    payment_id = str(uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        supabase_client.table("payments").insert({
            "id": payment_id,
            "org_id": org_id,
            "order_id": order_id,
            "payment_method": "house_account",
            "status": "captured",
            "amount_cents": charge_cents,
            "tip_cents": 0,
            "total_cents": charge_cents,
            "created_by": user_id,
            "created_at": now_iso,
        }).execute()
    except Exception:
        log.exception("house_account.insert_failed", order_id=order_id)
        return {"success": False, "error": "Failed to record house account charge"}

    new_balance = order["balance_due_cents"] - charge_cents
    _update_order_balance(order_id, org_id, new_balance)

    if new_balance <= 0:
        _close_order(order_id, org_id)

    log_audit(
        org_id=org_id,
        user_id=user_id,
        action="payment.processed",
        entity_type="payment",
        entity_id=payment_id,
        description=f"House account charge ${charge_cents / 100:.2f} on order {order_id}",
        new_state={"amount_cents": charge_cents, "method": "house_account"},
    )

    event_bus.emit("payment.processed", {
        "payment_id": payment_id,
        "order_id": order_id,
        "org_id": org_id,
        "method": "house_account",
        "amount_cents": charge_cents,
        "tip_cents": 0,
        "status": "captured",
    })

    return {
        "success": True,
        "payment_id": payment_id,
        "amount_cents": charge_cents,
        "method": "house_account",
    }
