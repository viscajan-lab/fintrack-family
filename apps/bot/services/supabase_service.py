"""
Supabase Service — semua operasi database dari bot
Menggunakan supabase-py sync client (create_client), wrapped asyncio.to_thread
agar kompatibel dengan semua versi supabase-py >= 1.x
"""
import logging
import asyncio
from os import getenv
from datetime import date
from typing import Optional

from supabase import create_client, Client

log = logging.getLogger(__name__)

_client: Optional[Client] = None


def _get_client() -> Client:
    global _client
    if _client is None:
        url = getenv("SUPABASE_URL")
        key = getenv("SUPABASE_SERVICE_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL / SUPABASE_SERVICE_KEY tidak ditemukan di env")
        _client = create_client(url, key)
    return _client


class SupabaseService:

    # ── Tenants ──────────────────────────────────────────────────────────────

    async def create_tenant(self, name: str) -> dict:
        sb   = _get_client()
        slug = name.lower().replace(" ", "-")
        res  = await asyncio.to_thread(
            lambda: sb.table("tenants").insert({"name": name, "slug": slug}).execute()
        )
        return res.data[0]

    async def get_tenant(self, tenant_id: str) -> Optional[dict]:
        sb  = _get_client()
        res = await asyncio.to_thread(
            lambda: sb.table("tenants").select("*").eq("id", tenant_id).maybe_single().execute()
        )
        return res.data

    async def get_tenant_by_slug(self, slug: str) -> Optional[dict]:
        sb  = _get_client()
        res = await asyncio.to_thread(
            lambda: sb.table("tenants").select("*").eq("slug", slug).maybe_single().execute()
        )
        return res.data

    # ── Members ───────────────────────────────────────────────────────────────

    async def get_member_by_telegram_id(self, telegram_id: int) -> Optional[dict]:
        sb  = _get_client()
        try:
            res = await asyncio.to_thread(
                lambda: sb.table("tenant_members")
                .select("*")
                .eq("telegram_id", telegram_id)
                .maybe_single()
                .execute()
            )
            return res.data if res else None
        except Exception:
            return None

    async def create_member(
        self,
        tenant_id: str,
        telegram_id: int,
        display_name: str,
        role: str = "member",
        user_id: Optional[str] = None,
    ) -> dict:
        sb      = _get_client()
        payload = {
            "tenant_id":    tenant_id,
            "telegram_id":  telegram_id,
            "display_name": display_name,
            "role":         role,
        }
        if user_id:
            payload["user_id"] = user_id
        res = await asyncio.to_thread(
            lambda: sb.table("tenant_members").insert(payload).execute()
        )
        return res.data[0]

    async def get_tenant_members(self, tenant_id: str) -> list[dict]:
        sb  = _get_client()
        res = await asyncio.to_thread(
            lambda: sb.table("tenant_members")
            .select("*")
            .eq("tenant_id", tenant_id)
            .execute()
        )
        return res.data or []

    # ── Transactions ──────────────────────────────────────────────────────────

    async def create_transaction(self, data: dict) -> dict:
        sb      = _get_client()
        # Remove None values — recorded_by may be None for bot-created transactions
        payload = {k: v for k, v in data.items() if v is not None}
        res     = await asyncio.to_thread(
            lambda: sb.table("transactions").insert(payload).execute()
        )
        return res.data[0]

    async def get_summary(
        self,
        tenant_id: str,
        date_from: date,
        date_to: date,
    ) -> dict:
        sb  = _get_client()
        res = await asyncio.to_thread(
            lambda: sb.table("transactions")
            .select("*")
            .eq("tenant_id", tenant_id)
            .gte("transaction_date", str(date_from))
            .lte("transaction_date", str(date_to))
            .order("created_at", desc=True)
            .execute()
        )
        txs     = res.data or []
        income  = sum(t["amount"] for t in txs if t["type"] == "income")
        expense = sum(t["amount"] for t in txs if t["type"] == "expense")
        return {
            "total_income":  income,
            "total_expense": expense,
            "transactions":  txs,
        }

    # ── Budgets ───────────────────────────────────────────────────────────────

    async def get_budgets(self, tenant_id: str, month: int, year: int) -> list[dict]:
        sb  = _get_client()
        res = await asyncio.to_thread(
            lambda: sb.table("budgets")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("month", month)
            .eq("year", year)
            .order("category_name")
            .execute()
        )
        return res.data or []

    async def get_expense_by_category(
        self,
        tenant_id: str,
        month: int,
        year: int,
    ) -> list[dict]:
        sb  = _get_client()
        res = await asyncio.to_thread(
            lambda: sb.table("v_expense_by_category")
            .select("category_name, total, count")
            .eq("tenant_id", tenant_id)
            .eq("month", f"{year}-{month:02d}-01")
            .order("total", desc=True)
            .execute()
        )
        return res.data or []
