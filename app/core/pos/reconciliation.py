"""Daily reconciliation engine for Sear POS.

Generates end-of-day financial reconciliation from payment transactions,
orders, tips, and cash drawer counts. All monetary values in integer cents.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any

import structlog

from app.extensions import supabase_client
from app.shared.audit import log_audit

log = structlog.get_logger(__name__)


@dataclass
class DailyReconciliation:
    """Comprehensive daily financial reconciliation snapshot. All amounts in cents."""

    business_date: date
    org_id: str
    location_id: str

    # Revenue
    gross_sales_cents: int = 0
    discount_cents: int = 0
    comp_cents: int = 0
    net_sales_cents: int = 0
    tax_collected_cents: int = 0

    # Payment breakdown
    credit_card_cents: int = 0
    cash_cents: int = 0
    gift_card_cents: int = 0
    house_account_cents: int = 0

    # Card brand breakdown
    visa_cents: int = 0
    mastercard_cents: int = 0
    amex_cents: int = 0
    discover_cents: int = 0

    # Tips
    cc_tips_cents: int = 0
    cash_tips_reported_cents: int = 0
    auto_gratuity_cents: int = 0

    # Adjustments
    void_cents: int = 0
    refund_cents: int = 0
    surcharge_cents: int = 0

    # Cash drawer
    cash_expected_cents: int = 0
    cash_counted_cents: int | None = None
    cash_variance_cents: int | None = None

    # Batch
    batch_id: str = ""
    batch_transaction_count: int = 0

    # Processing fees (estimated)
    estimated_fee_cents: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "business_date": self.business_date.isoformat(),
            "org_id": self.org_id,
            "location_id": self.location_id,
            "gross_sales_cents": self.gross_sales_cents,
            "discount_cents": self.discount_cents,
            "comp_cents": self.comp_cents,
            "net_sales_cents": self.net_sales_cents,
            "tax_collected_cents": self.tax_collected_cents,
            "credit_card_cents": self.credit_card_cents,
            "cash_cents": self.cash_cents,
            "gift_card_cents": self.gift_card_cents,
            "house_account_cents": self.house_account_cents,
            "visa_cents": self.visa_cents,
            "mastercard_cents": self.mastercard_cents,
            "amex_cents": self.amex_cents,
            "discover_cents": self.discover_cents,
            "cc_tips_cents": self.cc_tips_cents,
            "cash_tips_reported_cents": self.cash_tips_reported_cents,
            "auto_gratuity_cents": self.auto_gratuity_cents,
            "void_cents": self.void_cents,
            "refund_cents": self.refund_cents,
            "surcharge_cents": self.surcharge_cents,
            "cash_expected_cents": self.cash_expected_cents,
            "cash_counted_cents": self.cash_counted_cents,
            "cash_variance_cents": self.cash_variance_cents,
            "batch_id": self.batch_id,
            "batch_transaction_count": self.batch_transaction_count,
            "estimated_fee_cents": self.estimated_fee_cents,
        }


class ReconciliationEngine:
    """Builds daily reconciliation from POS transaction and order data."""

    def generate_daily_reconciliation(
        self,
        org_id: str,
        location_id: str,
        business_date: date,
    ) -> DailyReconciliation:
        """Build complete daily reconciliation from POS data for a single location."""
        recon = DailyReconciliation(
            business_date=business_date,
            org_id=org_id,
            location_id=location_id,
        )

        # Date range for this business day (midnight to midnight UTC, or
        # ideally the org's configured day boundary)
        day_start = f"{business_date.isoformat()}T00:00:00+00:00"
        day_end = f"{(business_date + timedelta(days=1)).isoformat()}T00:00:00+00:00"

        # --- Payment transactions for this date/location ---
        txn_resp = (
            supabase_client.table("payment_transactions")
            .select("*")
            .eq("org_id", org_id)
            .gte("created_at", day_start)
            .lt("created_at", day_end)
            .execute()
        )
        txns = txn_resp.data or []

        # Filter to this location via order lookup
        # (payment_transactions links to orders which have location_id)
        order_ids = list({t["order_id"] for t in txns if t.get("order_id")})
        location_order_ids: set[str] = set()
        if order_ids:
            # Batch check which orders belong to this location
            for i in range(0, len(order_ids), 100):
                batch = order_ids[i:i + 100]
                order_check = (
                    supabase_client.table("orders")
                    .select("id")
                    .eq("location_id", location_id)
                    .in_("id", batch)
                    .execute()
                )
                for o in (order_check.data or []):
                    location_order_ids.add(o["id"])

        batch_ids: set[str] = set()
        txn_count = 0

        for txn in txns:
            if txn.get("order_id") and txn["order_id"] not in location_order_ids:
                continue

            status = txn.get("status", "")
            captured_cents = txn.get("captured_amount_cents") or txn.get("authorized_amount_cents") or 0
            tip_cents = txn.get("tip_amount_cents") or 0
            surcharge_cents = txn.get("surcharge_amount_cents") or 0
            refunded_cents = txn.get("refunded_amount_cents") or 0

            if status == "voided":
                recon.void_cents += captured_cents
                continue

            if status in ("refunded", "partially_refunded"):
                recon.refund_cents += refunded_cents

            payment_method = txn.get("payment_method", "")

            if payment_method in ("card_emv", "card_nfc", "card_swipe", "card_manual"):
                recon.credit_card_cents += captured_cents
                recon.cc_tips_cents += tip_cents
                txn_count += 1

                brand = (txn.get("card_brand") or "").lower()
                if brand == "visa":
                    recon.visa_cents += captured_cents
                elif brand == "mastercard":
                    recon.mastercard_cents += captured_cents
                elif "amex" in brand or "american" in brand:
                    recon.amex_cents += captured_cents
                elif brand == "discover":
                    recon.discover_cents += captured_cents

            elif payment_method == "cash":
                recon.cash_cents += captured_cents

            elif payment_method == "gift_card":
                recon.gift_card_cents += captured_cents

            elif payment_method == "house_account":
                recon.house_account_cents += captured_cents

            recon.surcharge_cents += surcharge_cents

            if txn.get("processor_batch_id"):
                batch_ids.add(txn["processor_batch_id"])

        recon.batch_transaction_count = txn_count
        recon.batch_id = ",".join(sorted(batch_ids)) if batch_ids else ""

        # --- Order-level aggregates (for gross sales, discounts, comps, tax) ---
        orders_resp = (
            supabase_client.table("orders")
            .select("id, subtotal, discount_total, tax_total, tip_total, total, status")
            .eq("org_id", org_id)
            .eq("location_id", location_id)
            .gte("created_at", day_start)
            .lt("created_at", day_end)
            .execute()
        )
        orders = orders_resp.data or []

        for order in orders:
            status = order.get("status", "")
            if status == "voided":
                continue

            subtotal_cents = int(round(float(order.get("subtotal", 0)) * 100))
            discount_cents = int(round(float(order.get("discount_total", 0)) * 100))
            tax_cents = int(round(float(order.get("tax_total", 0)) * 100))

            recon.gross_sales_cents += subtotal_cents
            recon.discount_cents += discount_cents
            recon.tax_collected_cents += tax_cents

        # Comps: query order_discounts where discount_type = comp
        comp_resp = (
            supabase_client.table("order_discounts")
            .select("applied_amount, order_id")
            .eq("org_id", org_id)
            .eq("discount_type", "comp")
            .execute()
        )
        comp_order_ids = set()
        for disc in (comp_resp.data or []):
            if disc.get("order_id") in {o["id"] for o in orders if o.get("status") != "voided"}:
                recon.comp_cents += int(round(float(disc.get("applied_amount", 0)) * 100))

        recon.net_sales_cents = recon.gross_sales_cents - recon.discount_cents - recon.comp_cents

        # --- Cash tips reported (from time_entries for this date/location) ---
        time_resp = (
            supabase_client.table("time_entries")
            .select("cash_tips")
            .eq("org_id", org_id)
            .eq("location_id", location_id)
            .gte("clock_in", day_start)
            .lt("clock_in", day_end)
            .execute()
        )
        for entry in (time_resp.data or []):
            cash_tips = entry.get("cash_tips") or 0
            recon.cash_tips_reported_cents += int(round(float(cash_tips) * 100))

        # --- Auto-gratuity from tip_distributions (time_entries has no auto_gratuity column) ---
        try:
            tip_dist_resp = (
                supabase_client.table("tip_distributions")
                .select("auto_gratuity_amount")
                .eq("org_id", org_id)
                .eq("location_id", location_id)
                .gte("created_at", day_start)
                .lt("created_at", day_end)
                .execute()
            )
            for td in (tip_dist_resp.data or []):
                auto_grat = td.get("auto_gratuity_amount") or 0
                recon.auto_gratuity_cents += int(round(float(auto_grat) * 100))
        except Exception:
            log.exception("reconciliation.tip_dist_query_failed")

        # --- Cash drawer expected ---
        # Cash expected = cash payments received - cash back given (change)
        # We already have recon.cash_cents from payment_transactions
        recon.cash_expected_cents = recon.cash_cents

        # --- Estimated processing fees ---
        recon.estimated_fee_cents = self._estimate_processing_fees({
            "visa": recon.visa_cents,
            "mastercard": recon.mastercard_cents,
            "amex": recon.amex_cents,
            "discover": recon.discover_cents,
        })

        return recon

    def _estimate_processing_fees(self, card_brand_totals: dict[str, int]) -> int:
        """
        Estimate processing fees in cents.
        Visa/MC/Discover: ~2.2% average effective rate (card-present restaurant).
        Amex: ~2.8% average.
        """
        visa_mc_disc = (
            card_brand_totals.get("visa", 0)
            + card_brand_totals.get("mastercard", 0)
            + card_brand_totals.get("discover", 0)
        )
        amex = card_brand_totals.get("amex", 0)

        estimated = int(round(visa_mc_disc * 0.022 + amex * 0.028))
        return estimated

    def reconcile_processor_deposit(
        self,
        org_id: str,
        batch_id: str,
        deposit_amount_cents: int,
    ) -> dict[str, Any]:
        """
        Match a processor bank deposit against a batch.
        Accounts for T+1/T+2/T+3 timing, fees, and chargebacks.
        """
        # Look up the batch by processor_batch_id
        batch_resp = (
            supabase_client.table("settlement_batches")
            .select("*")
            .eq("org_id", org_id)
            .eq("processor_batch_id", batch_id)
            .execute()
        )
        batches = batch_resp.data or []

        if not batches:
            return {
                "matched": False,
                "error": "No matching batch found",
                "deposit_amount_cents": deposit_amount_cents,
                "expected_cents": 0,
                "variance_cents": 0,
            }

        batch = batches[0]
        expected_cents = batch.get("net_amount_cents") or 0
        gross_cents = batch.get("gross_amount_cents") or 0
        refund_cents = batch.get("refund_amount_cents") or 0

        # Check for chargebacks against transactions in this batch
        chargeback_resp = (
            supabase_client.table("chargebacks")
            .select("amount_cents, reason_code, status")
            .eq("org_id", org_id)
            .execute()
        )
        chargeback_total_cents = 0
        chargebacks_detail = []
        for cb in (chargeback_resp.data or []):
            if cb.get("status") in ("open", "evidence_submitted", "lost"):
                chargeback_total_cents += cb.get("amount_cents", 0)
                chargebacks_detail.append(cb)

        # Estimate fees from gross
        fee_estimate_cents = int(round(gross_cents * 0.025))

        # Calculate what we expect the deposit to be
        expected_deposit = gross_cents - refund_cents - fee_estimate_cents - chargeback_total_cents
        variance = deposit_amount_cents - expected_deposit

        result = {
            "matched": abs(variance) < 100,  # Within $1.00 tolerance
            "deposit_amount_cents": deposit_amount_cents,
            "batch_gross_cents": gross_cents,
            "batch_refund_cents": refund_cents,
            "estimated_fees_cents": fee_estimate_cents,
            "chargeback_cents": chargeback_total_cents,
            "expected_deposit_cents": expected_deposit,
            "variance_cents": variance,
            "batch": batch,
            "chargebacks": chargebacks_detail,
        }

        # If matched, update the batch record
        if result["matched"]:
            supabase_client.table("settlement_batches").update({
                "actual_deposit_amount_cents": deposit_amount_cents,
                "reconciled": True,
                "reconciled_at": datetime.now(timezone.utc).isoformat(),
                "variance_cents": variance,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", batch["id"]).execute()

        return result

    def close_business_day(
        self,
        org_id: str,
        location_id: str,
        business_date: date,
        manager_id: str,
        manager_name: str = "",
        manager_role: str = "",
        cash_drawer_counted_cents: int | None = None,
        notes: str | None = None,
    ) -> dict[str, Any]:
        """
        Close the business day: generate reconciliation, save to DB,
        and trigger async tasks (daily aggregation, tip distribution, email summary).
        """
        # Generate the reconciliation
        recon = self.generate_daily_reconciliation(org_id, location_id, business_date)

        # Apply cash drawer count
        if cash_drawer_counted_cents is not None:
            recon.cash_counted_cents = cash_drawer_counted_cents
            recon.cash_variance_cents = cash_drawer_counted_cents - recon.cash_expected_cents

        now = datetime.now(timezone.utc).isoformat()

        # Build the DB row
        row: dict[str, Any] = {
            "org_id": org_id,
            "location_id": location_id,
            "business_date": business_date.isoformat(),
            "gross_sales_cents": recon.gross_sales_cents,
            "discount_cents": recon.discount_cents,
            "comp_cents": recon.comp_cents,
            "net_sales_cents": recon.net_sales_cents,
            "tax_collected_cents": recon.tax_collected_cents,
            "credit_card_cents": recon.credit_card_cents,
            "cash_cents": recon.cash_cents,
            "gift_card_cents": recon.gift_card_cents,
            "house_account_cents": recon.house_account_cents,
            "visa_cents": recon.visa_cents,
            "mastercard_cents": recon.mastercard_cents,
            "amex_cents": recon.amex_cents,
            "discover_cents": recon.discover_cents,
            "cc_tips_cents": recon.cc_tips_cents,
            "cash_tips_reported_cents": recon.cash_tips_reported_cents,
            "auto_gratuity_cents": recon.auto_gratuity_cents,
            "void_cents": recon.void_cents,
            "refund_cents": recon.refund_cents,
            "surcharge_cents": recon.surcharge_cents,
            "cash_expected_cents": recon.cash_expected_cents,
            "cash_counted_cents": recon.cash_counted_cents,
            "cash_variance_cents": recon.cash_variance_cents,
            "estimated_fee_cents": recon.estimated_fee_cents,
            "closed_by": manager_id,
            "closed_at": now,
            "notes": notes,
        }

        # Upsert (in case day was already partially closed)
        existing_resp = (
            supabase_client.table("daily_reconciliations")
            .select("id")
            .eq("org_id", org_id)
            .eq("location_id", location_id)
            .eq("business_date", business_date.isoformat())
            .limit(1)
            .execute()
        )

        if existing_resp.data:
            # Update existing record
            row["updated_at"] = now
            save_resp = (
                supabase_client.table("daily_reconciliations")
                .update(row)
                .eq("id", existing_resp.data[0]["id"])
                .execute()
            )
            saved = save_resp.data[0] if save_resp.data else row
        else:
            save_resp = (
                supabase_client.table("daily_reconciliations")
                .insert(row)
                .execute()
            )
            saved = save_resp.data[0] if save_resp.data else row

        # Audit trail
        log_audit(
            org_id=org_id,
            user_id=manager_id,
            user_name=manager_name,
            user_role=manager_role,
            action="reconciliation.day_closed",
            entity_type="daily_reconciliation",
            entity_id=saved.get("id", ""),
            description=(
                f"Closed business day {business_date.isoformat()} for location {location_id}. "
                f"Gross: ${recon.gross_sales_cents / 100:.2f}, "
                f"Net: ${recon.net_sales_cents / 100:.2f}"
            ),
            new_state=recon.to_dict(),
        )

        # Trigger async Celery tasks
        try:
            from app.extensions import celery_app

            celery_app.send_task(
                "tasks.reconciliation.daily_aggregation",
                kwargs={
                    "org_id": org_id,
                    "location_id": location_id,
                    "business_date": business_date.isoformat(),
                },
            )
            celery_app.send_task(
                "tasks.reconciliation.tip_distribution_calc",
                kwargs={
                    "org_id": org_id,
                    "location_id": location_id,
                    "business_date": business_date.isoformat(),
                },
            )
            celery_app.send_task(
                "tasks.reconciliation.email_daily_summary",
                kwargs={
                    "org_id": org_id,
                    "location_id": location_id,
                    "business_date": business_date.isoformat(),
                },
            )
            log.info(
                "reconciliation.tasks_dispatched",
                org_id=org_id,
                location_id=location_id,
                business_date=business_date.isoformat(),
            )
        except Exception:
            log.exception("reconciliation.task_dispatch_failed")
            # Don't fail the close if task dispatch fails

        log.info(
            "reconciliation.day_closed",
            org_id=org_id,
            location_id=location_id,
            business_date=business_date.isoformat(),
            gross_cents=recon.gross_sales_cents,
            net_cents=recon.net_sales_cents,
            cash_variance_cents=recon.cash_variance_cents,
        )

        return saved
