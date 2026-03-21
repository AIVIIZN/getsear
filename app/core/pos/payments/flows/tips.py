"""Tip calculation, distribution, and IRS reporting for Sear POS.

Handles suggested tip calculation (pre/post-tax), auto-gratuity for
large parties, direct/pool tip distribution, and IRS Form 8027 data.
All amounts in INTEGER CENTS.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import uuid4

import structlog

from app.extensions import supabase_client
from app.shared.audit import log_audit

log = structlog.get_logger(__name__)


# ── Data Structures ──────────────────────────────────────────────────────


@dataclass
class TipShare:
    staff_id: str
    staff_name: str
    role: str
    amount_cents: int
    source: str  # "direct", "pool", "tipout"


# ── Tip Calculator ───────────────────────────────────────────────────────


class TipCalculator:
    """Configurable tip suggestions and auto-gratuity calculation."""

    def calculate_suggested_tips(
        self,
        subtotal_cents: int,
        percentages: list[int] | None = None,
        pre_tax: bool = True,
        tax_cents: int = 0,
    ) -> list[dict]:
        """Generate tip suggestions for customer-facing display.

        Args:
            subtotal_cents: Pre-tax subtotal in cents.
            percentages: List of tip percentages (default [18, 20, 22]).
            pre_tax: If True, calculate on subtotal. If False, include tax.
            tax_cents: Tax amount in cents (used when pre_tax=False).

        Returns:
            List of dicts with percentage, amount_cents, total_cents.
        """
        if percentages is None:
            percentages = [18, 20, 22]

        base_cents = subtotal_cents if pre_tax else subtotal_cents + tax_cents
        total_before_tip = subtotal_cents + tax_cents

        suggestions = []
        for pct in percentages:
            tip_cents = _round_cents(base_cents * pct, 100)
            suggestions.append({
                "percentage": pct,
                "amount_cents": tip_cents,
                "total_cents": total_before_tip + tip_cents,
                "label": f"{pct}%",
            })

        return suggestions

    def calculate_auto_gratuity(
        self,
        subtotal_cents: int,
        party_size: int,
        threshold: int = 6,
        percentage: int = 20,
    ) -> dict:
        """Auto-gratuity for large parties.

        IRS treats auto-gratuity as a SERVICE CHARGE (not a tip):
        - Subject to payroll tax
        - Restaurant must pay it out
        - Reported as wages, not tips on W-2
        """
        if party_size < threshold:
            return {"applies": False, "gratuity_cents": 0}

        gratuity_cents = _round_cents(subtotal_cents * percentage, 100)

        return {
            "applies": True,
            "party_size": party_size,
            "percentage": percentage,
            "gratuity_cents": gratuity_cents,
            "is_service_charge": True,
            "receipt_label": f"Gratuity ({percentage}%) - Party of {party_size}",
            "additional_tip_allowed": True,
        }


# ── Tip Distributor ──────────────────────────────────────────────────────


class TipDistributor:
    """Distribute tips across staff using direct or pool models."""

    def distribute_direct(
        self,
        tips: list[dict],
        tipout_rules: list[dict] | None = None,
    ) -> list[TipShare]:
        """Direct tipping: server keeps tips minus tipouts.

        tips: [{"server_id": "abc", "tip_cents": 1500, "sales_cents": 10000}, ...]
        tipout_rules: [{"role": "busser", "staff_id": "x", "staff_name": "Y",
                        "type": "pct_of_sales", "value": 3}, ...]

        Tipouts are usually calculated on SALES, not tips. A server selling
        $1000 with $200 in tips tips out 3% of $1000 = $30 to the busser.
        """
        shares: list[TipShare] = []

        for tip_entry in tips:
            server_id = tip_entry["server_id"]
            tip_cents = tip_entry["tip_cents"]
            sales_cents = tip_entry.get("sales_cents", 0)
            total_tipout_cents = 0

            if tipout_rules:
                for rule in tipout_rules:
                    if rule.get("type") == "pct_of_sales":
                        tipout_cents = _round_cents(sales_cents * rule["value"], 100)
                    elif rule.get("type") == "pct_of_tips":
                        tipout_cents = _round_cents(tip_cents * rule["value"], 100)
                    elif rule.get("type") == "flat":
                        tipout_cents = rule["value"]
                    else:
                        tipout_cents = rule.get("calculated_amount_cents", 0)

                    total_tipout_cents += tipout_cents
                    shares.append(TipShare(
                        staff_id=rule["staff_id"],
                        staff_name=rule.get("staff_name", ""),
                        role=rule["role"],
                        amount_cents=tipout_cents,
                        source="tipout",
                    ))

            server_keeps = tip_cents - total_tipout_cents
            shares.insert(0, TipShare(
                staff_id=server_id,
                staff_name=tip_entry.get("server_name", ""),
                role="server",
                amount_cents=max(server_keeps, 0),
                source="direct",
            ))

        return shares

    def distribute_pool(
        self,
        tips: list[dict],
        staff_hours: list[dict],
        method: str = "hours_worked",
    ) -> list[TipShare]:
        """Tip pool: all tips go into pool, distributed by hours/equal/points.

        tips: [{"tip_cents": 1500}, ...] -- all tips for the pool period
        staff_hours: [{"staff_id": "a", "name": "Alice", "role": "server",
                       "hours": 8.0, "points_per_hour": 2.0}, ...]
        method: "hours_worked" | "equal" | "points"
        """
        total_pool_cents = sum(t["tip_cents"] for t in tips)

        if total_pool_cents <= 0:
            return []

        shares: list[TipShare] = []

        if method == "hours_worked":
            total_hours = sum(s["hours"] for s in staff_hours)
            if total_hours <= 0:
                return []

            running_total = 0
            for i, staff in enumerate(staff_hours):
                if i == len(staff_hours) - 1:
                    amount = total_pool_cents - running_total
                else:
                    proportion = staff["hours"] / total_hours
                    amount = round(total_pool_cents * proportion)
                    running_total += amount

                shares.append(TipShare(
                    staff_id=staff["staff_id"],
                    staff_name=staff["name"],
                    role=staff["role"],
                    amount_cents=amount,
                    source="pool",
                ))

        elif method == "equal":
            n = len(staff_hours)
            if n == 0:
                return []

            per_person = total_pool_cents // n
            running_total = 0

            for i, staff in enumerate(staff_hours):
                amount = per_person if i < n - 1 else total_pool_cents - running_total
                running_total += amount
                shares.append(TipShare(
                    staff_id=staff["staff_id"],
                    staff_name=staff["name"],
                    role=staff["role"],
                    amount_cents=amount,
                    source="pool",
                ))

        elif method == "points":
            points_per_role = {
                "server": 2.0,
                "bartender": 2.0,
                "busser": 1.0,
                "food_runner": 1.0,
                "host": 0.5,
            }

            total_points = sum(
                staff.get("points_per_hour", points_per_role.get(staff["role"], 1.0)) * staff["hours"]
                for staff in staff_hours
            )

            if total_points <= 0:
                return []

            running_total = 0
            for i, staff in enumerate(staff_hours):
                staff_points = staff.get("points_per_hour", points_per_role.get(staff["role"], 1.0)) * staff["hours"]
                if i == len(staff_hours) - 1:
                    amount = total_pool_cents - running_total
                else:
                    proportion = staff_points / total_points
                    amount = round(total_pool_cents * proportion)
                    running_total += amount

                shares.append(TipShare(
                    staff_id=staff["staff_id"],
                    staff_name=staff["name"],
                    role=staff["role"],
                    amount_cents=amount,
                    source="pool",
                ))

        return shares

    def save_distributions(
        self,
        shares: list[TipShare],
        org_id: str,
        location_id: str,
        shift_date: str,
        distribution_method: str,
    ) -> None:
        """Persist tip distributions to DB for payroll and IRS reporting."""
        now_iso = datetime.now(timezone.utc).isoformat()

        records = [
            {
                "id": str(uuid4()),
                "org_id": org_id,
                "location_id": location_id,
                "shift_date": shift_date,
                "staff_id": share.staff_id,
                "distribution_method": distribution_method,
                "amount_cents": share.amount_cents,
                "tip_type": "credit_card" if share.source in ("direct", "pool") else share.source,
                "source": share.source,
                "created_at": now_iso,
            }
            for share in shares
            if share.amount_cents > 0
        ]

        if records:
            try:
                supabase_client.table("tip_distributions").insert(records).execute()
            except Exception:
                log.exception("tips.save_distributions_failed", org_id=org_id)

    def generate_8027_data(
        self,
        org_id: str,
        location_id: str,
        year: int,
    ) -> dict:
        """Generate data needed for IRS Form 8027.

        IRS requires restaurants with 10+ employees to file Form 8027
        (Employer's Annual Information Return of Tip Income and Allocated Tips).
        """
        MINIMUM_TIP_RATE = 8  # 8% IRS threshold

        start_date = f"{year}-01-01"
        end_date = f"{year}-12-31"

        gross_receipts_cents = self._get_gross_receipts(org_id, location_id, start_date, end_date)
        cc_tips_cents = self._get_cc_tips(org_id, location_id, start_date, end_date)
        reported_cash_tips_cents = self._get_reported_cash_tips(org_id, location_id, start_date, end_date)
        service_charges_cents = self._get_service_charges(org_id, location_id, start_date, end_date)

        total_reported_tips_cents = cc_tips_cents + reported_cash_tips_cents

        # Tippable receipts exclude service charges, takeout (non-tipped), etc.
        tippable_receipts_cents = gross_receipts_cents - service_charges_cents
        minimum_tips_cents = _round_cents(tippable_receipts_cents * MINIMUM_TIP_RATE, 100)

        needs_allocation = total_reported_tips_cents < minimum_tips_cents
        allocation_cents = minimum_tips_cents - total_reported_tips_cents if needs_allocation else 0

        employee_detail = self._get_employee_tip_detail(org_id, location_id, start_date, end_date)

        # If allocation needed, distribute proportionally by hours worked
        if needs_allocation and allocation_cents > 0 and employee_detail:
            total_hours = sum(e.get("hours_worked", 0) for e in employee_detail)
            if total_hours > 0:
                running_alloc = 0
                for i, emp in enumerate(employee_detail):
                    if i == len(employee_detail) - 1:
                        emp["allocated_tips_cents"] = allocation_cents - running_alloc
                    else:
                        proportion = emp.get("hours_worked", 0) / total_hours
                        emp["allocated_tips_cents"] = round(allocation_cents * proportion)
                        running_alloc += emp["allocated_tips_cents"]

        return {
            "form": "8027",
            "year": year,
            "org_id": org_id,
            "location_id": location_id,
            "line_1_total_charged_tips_cents": cc_tips_cents,
            "line_2_total_charge_receipts_cents": gross_receipts_cents,
            "line_3_total_gross_receipts_cents": gross_receipts_cents,
            "line_4_cash_tips_reported_cents": reported_cash_tips_cents,
            "line_5_total_tips_reported_cents": total_reported_tips_cents,
            "line_6_gross_receipts_for_calc_cents": tippable_receipts_cents,
            "line_7_eight_percent_cents": minimum_tips_cents,
            "line_8_allocation_required": needs_allocation,
            "line_9_allocation_amount_cents": allocation_cents,
            "employee_tip_detail": employee_detail,
        }

    # ------------------------------------------------------------------
    # DB queries for 8027
    # ------------------------------------------------------------------

    def _get_gross_receipts(self, org_id: str, location_id: str, start: str, end: str) -> int:
        try:
            resp = (
                supabase_client.table("orders")
                .select("total_cents")
                .eq("org_id", org_id)
                .eq("location_id", location_id)
                .eq("status", "closed")
                .gte("closed_at", start)
                .lte("closed_at", end)
                .execute()
            )
            return sum(row["total_cents"] for row in (resp.data or []))
        except Exception:
            log.exception("tips.get_gross_receipts_failed")
            return 0

    def _get_cc_tips(self, org_id: str, location_id: str, start: str, end: str) -> int:
        try:
            resp = (
                supabase_client.table("payments")
                .select("tip_cents")
                .eq("org_id", org_id)
                .in_("payment_method", ["card"])
                .in_("status", ["captured", "settled"])
                .gte("created_at", start)
                .lte("created_at", end)
                .execute()
            )
            return sum(row["tip_cents"] for row in (resp.data or []) if row.get("tip_cents"))
        except Exception:
            log.exception("tips.get_cc_tips_failed")
            return 0

    def _get_reported_cash_tips(self, org_id: str, location_id: str, start: str, end: str) -> int:
        try:
            resp = (
                supabase_client.table("tip_distributions")
                .select("amount_cents")
                .eq("org_id", org_id)
                .eq("location_id", location_id)
                .eq("tip_type", "cash_reported")
                .gte("shift_date", start)
                .lte("shift_date", end)
                .execute()
            )
            return sum(row["amount_cents"] for row in (resp.data or []))
        except Exception:
            log.exception("tips.get_cash_tips_failed")
            return 0

    def _get_service_charges(self, org_id: str, location_id: str, start: str, end: str) -> int:
        try:
            resp = (
                supabase_client.table("payments")
                .select("auto_gratuity_cents")
                .eq("org_id", org_id)
                .eq("auto_gratuity_is_service_charge", True)
                .gte("created_at", start)
                .lte("created_at", end)
                .execute()
            )
            return sum(row["auto_gratuity_cents"] for row in (resp.data or []) if row.get("auto_gratuity_cents"))
        except Exception:
            log.exception("tips.get_service_charges_failed")
            return 0

    def _get_employee_tip_detail(self, org_id: str, location_id: str, start: str, end: str) -> list[dict]:
        try:
            resp = (
                supabase_client.table("tip_distributions")
                .select("staff_id, amount_cents, tip_type, source")
                .eq("org_id", org_id)
                .eq("location_id", location_id)
                .gte("shift_date", start)
                .lte("shift_date", end)
                .execute()
            )

            staff_map: dict[str, dict] = {}
            for row in (resp.data or []):
                sid = row["staff_id"]
                if sid not in staff_map:
                    staff_map[sid] = {
                        "staff_id": sid,
                        "cc_tips_cents": 0,
                        "cash_tips_reported_cents": 0,
                        "total_tips_cents": 0,
                        "allocated_tips_cents": 0,
                        "hours_worked": 0,
                    }

                cents = row["amount_cents"]
                if row["tip_type"] == "credit_card":
                    staff_map[sid]["cc_tips_cents"] += cents
                elif row["tip_type"] == "cash_reported":
                    staff_map[sid]["cash_tips_reported_cents"] += cents
                staff_map[sid]["total_tips_cents"] += cents

            # Enrich with hours worked from time clock
            for sid, data in staff_map.items():
                data["hours_worked"] = self._get_staff_hours(sid, org_id, location_id, start, end)

            return list(staff_map.values())

        except Exception:
            log.exception("tips.get_employee_detail_failed")
            return []

    def _get_staff_hours(self, staff_id: str, org_id: str, location_id: str, start: str, end: str) -> float:
        try:
            resp = (
                supabase_client.table("time_entries")
                .select("hours_worked")
                .eq("staff_id", staff_id)
                .eq("org_id", org_id)
                .eq("location_id", location_id)
                .gte("clock_in", start)
                .lte("clock_in", end)
                .execute()
            )
            return sum(row.get("hours_worked", 0) for row in (resp.data or []))
        except Exception:
            log.exception("tips.get_staff_hours_failed", staff_id=staff_id)
            return 0.0


# ── Utility ──────────────────────────────────────────────────────────────


def _round_cents(numerator: int, denominator: int) -> int:
    """Integer rounding: (numerator + denominator//2) // denominator.

    Used for percentage calculations on cent amounts to get proper
    banker's rounding without floating point.
    """
    return (numerator + denominator // 2) // denominator
