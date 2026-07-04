"""
Supabase Service — semua operasi database dari bot
"""
import logging
from os import getenv
from datetime import date
from typing import Optional

from supabase import AsyncClient, acreate_client

log = logging.getLogger(__name__)

_client: Optional[AsyncClient] = None


async def _get_client() -> AsyncClient:
    global _client
    if _client is None:
        url = getenv("SUPABASE_URL")
        key = getenv("SUPABASE_SERVICE_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL / SUPABASE_SERVICE_KEY tidak ditemukan di .env")
        _client = await acreate_client(url, key)
    return _client


class SupabaseService:

    # ── Tenants ──────────────────────────────────────────────────────────────

    async def create_tenant(self, name: str) -> dict:
        sb   = await _get_client()
        slug = name.lower().replace(" ", "-")
        res  = await sb.table("tenants").insert({"name": name, "slug": slug}).execute()
        return res.data[0]

    async def get_tenant(self, tenant_id: str) -> Optional[dict]:
        sb  = await _get_client()
        res = await sb.table("tenants").select("*").eq("id", tenant_id).single().execute()
        return res.data

    # ── Members ───────────────────────────────────────────────────────────────

    async def get_member_by_telegram_id(self, telegram_id: int) -> Optional[dict]:
        sb  = await _get_client()
        res = (
            await sb.table("tenant_members")
            .select("*")
            .eq("telegram_id", telegram_id)
            .maybe_single()
            .execute()
        )
        return res.data

    async def create_member(
        self,
        tenant_id: str,
        telegram_id: int,
        display_name: str,
        role: str = "member",
    ) -> dict:
        sb  = await _get_client()
        res = await sb.table("tenant_members").insert({
            "tenant_id":    tenant_id,
            "telegram_id":  telegram_id,
            "display_name": display_name,
            "role":         role,
        }).execute()
        return res.data[0]

    # ── Transactions ──────────────────────────────────────────────────────────

    async def create_transaction(self, data: dict) -> dict:
        sb  = await _get_client()
        res = await sb.table("transactions").insert(data).execute()
        return res.data[0]

    async def get_summary(
        self,
        tenant_id: str,
        date_from: date,
        date_to: date,
    ) -> dict:
        sb  = await _get_client()
        res = (
            await sb.table("transactions")
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

    async def get_expense_by_category(
        self,
        tenant_id: str,
        month: int,
        year: int,
    ) -> list[dict]:
        """Aggregasi pengeluaran per kategori bulan ini — via view Supabase"""
        sb  = await _get_client()
        res = (
            await sb.table("v_expense_by_category")
            .select("category_name, total, count")
            .eq("tenant_id", tenant_id)
            .eq("month", f"{year}-{month:02d}-01")  # DATE_TRUNC hasilnya tgl 1
            .order("total", desc=True)
            .execute()
        )
        return res.data or []

    # ── Budgets ───────────────────────────────────────────────────────────────

    async def get_budgets(self, tenant_id: str, month: int, year: int) -> list[dict]:
        sb  = await _get_client()
        res = (
            await sb.table("budgets")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("month", month)
            .eq("year", year)
            .order("category_name")
            .execute()
        )
        return res.data or []
