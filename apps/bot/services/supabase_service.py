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

    # ── Reminder harian (preferensi jam, disimpan WIB) ────────────────────────

    async def set_reminder(self, telegram_id: int, hour: int, minute: int) -> None:
        """Set jam reminder harian user (WIB). Reset penanda anti-dobel."""
        sb = _get_client()
        await asyncio.to_thread(
            lambda: sb.table("tenant_members")
            .update({
                "reminder_hour":      hour,
                "reminder_minute":    minute,
                "reminder_last_sent": None,
            })
            .eq("telegram_id", telegram_id)
            .execute()
        )

    async def clear_reminder(self, telegram_id: int) -> None:
        """Matikan reminder harian user (set jam ke NULL)."""
        sb = _get_client()
        await asyncio.to_thread(
            lambda: sb.table("tenant_members")
            .update({"reminder_hour": None, "reminder_last_sent": None})
            .eq("telegram_id", telegram_id)
            .execute()
        )

    async def get_members_reminder_at(self, hour: int, minute: int) -> list[dict]:
        """Member yang jam remindernya == hour:minute (WIB). Dipakai scheduler."""
        sb  = _get_client()
        res = await asyncio.to_thread(
            lambda: sb.table("tenant_members")
            .select("telegram_id, reminder_last_sent")
            .eq("reminder_hour", hour)
            .eq("reminder_minute", minute)
            .execute()
        )
        return res.data or []

    async def mark_reminder_sent(self, telegram_id: int, today: date) -> None:
        """Tandai reminder harian sudah dikirim hari ini (anti-dobel)."""
        sb = _get_client()
        await asyncio.to_thread(
            lambda: sb.table("tenant_members")
            .update({"reminder_last_sent": str(today)})
            .eq("telegram_id", telegram_id)
            .execute()
        )

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

    async def delete_transaction(self, tx_id: str, tenant_id: str) -> bool:
        """Hapus transaksi — hanya milik tenant ybs."""
        sb = _get_client()
        try:
            res = await asyncio.to_thread(
                lambda: sb.table("transactions")
                .delete()
                .eq("id", tx_id)
                .eq("tenant_id", tenant_id)
                .execute()
            )
            return bool(res.data)
        except Exception:
            return False

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

    async def upsert_budget(
        self,
        tenant_id: str,
        category_name: str,
        amount: int,
        month: int,
        year: int,
    ) -> dict:
        """
        Set / perbarui budget satu kategori pada bulan tertentu.

        Memanfaatkan UNIQUE (tenant_id, category_name, month, year):
        kalau budget kategori itu sudah ada di bulan ybs -> di-UPDATE,
        kalau belum ada -> di-INSERT. Idempoten, tidak bikin duplikat.

        Return baris budget hasil upsert.
        """
        sb  = _get_client()
        row = {
            "tenant_id":     tenant_id,
            "category_name": category_name,
            "amount":        int(amount),
            "month":         month,
            "year":          year,
        }
        res = await asyncio.to_thread(
            lambda: sb.table("budgets")
            .upsert(row, on_conflict="tenant_id,category_name,month,year")
            .execute()
        )
        return (res.data or [row])[0]

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

    async def get_budget_status_for_category(
        self,
        tenant_id: str,
        category_name: str,
        month: int,
        year: int,
    ) -> Optional[dict]:
        """
        Ambil status budget untuk SATU kategori pada bulan berjalan.

        Return None jika kategori tsb tidak punya budget bulan ini
        (artinya: tidak perlu warning apa pun).

        Jika ada budget, kembalikan:
          {
            "category_name": str,
            "limit":     int,   # nominal budget
            "spent":     int,   # total pengeluaran kategori bulan ini
            "remaining": int,   # limit - spent (bisa negatif kalau jebol)
            "ratio":     float, # spent / limit
          }
        """
        sb = _get_client()

        # 1. Ambil budget kategori ini (kalau ada)
        budget_res = await asyncio.to_thread(
            lambda: sb.table("budgets")
            .select("amount, category_name")
            .eq("tenant_id", tenant_id)
            .eq("category_name", category_name)
            .eq("month", month)
            .eq("year", year)
            .maybe_single()
            .execute()
        )
        budget = budget_res.data if budget_res else None
        if not budget:
            return None

        limit = int(budget["amount"])
        if limit <= 0:
            return None

        # 2. Ambil total pengeluaran kategori ini bulan ini dari view
        exp_res = await asyncio.to_thread(
            lambda: sb.table("v_expense_by_category")
            .select("total")
            .eq("tenant_id", tenant_id)
            .eq("category_name", category_name)
            .eq("month", f"{year}-{month:02d}-01")
            .maybe_single()
            .execute()
        )
        spent = int(exp_res.data["total"]) if (exp_res and exp_res.data) else 0

        return {
            "category_name": category_name,
            "limit":     limit,
            "spent":     spent,
            "remaining": limit - spent,
            "ratio":     spent / limit,
        }

    # ── Recurring rules (tagihan/langganan berulang) ──────────────────────────

    async def create_recurring(self, data: dict) -> dict:
        """Buat aturan berulang. data: tenant_id, created_by, type, amount,
        category_name, description, day_of_month, mode."""
        sb      = _get_client()
        payload = {k: v for k, v in data.items() if v is not None}
        res     = await asyncio.to_thread(
            lambda: sb.table("recurring_rules").insert(payload).execute()
        )
        return res.data[0]

    async def list_recurring(self, tenant_id: str) -> list[dict]:
        """Semua aturan berulang tenant (aktif & non-aktif), urut tanggal."""
        sb  = _get_client()
        res = await asyncio.to_thread(
            lambda: sb.table("recurring_rules")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("day_of_month")
            .execute()
        )
        return res.data or []

    async def delete_recurring(self, rule_id: str, tenant_id: str) -> bool:
        """Hapus aturan — hanya milik tenant ybs."""
        sb = _get_client()
        try:
            res = await asyncio.to_thread(
                lambda: sb.table("recurring_rules")
                .delete()
                .eq("id", rule_id)
                .eq("tenant_id", tenant_id)
                .execute()
            )
            return bool(res.data)
        except Exception:
            return False

    async def get_due_recurring(self, day: int, today: date) -> list[dict]:
        """Aturan aktif yang jatuh tempo pada `day` dan belum jalan hari ini.
        Dipakai scheduler harian. `today` untuk filter anti-dobel (last_run_date)."""
        sb  = _get_client()
        res = await asyncio.to_thread(
            lambda: sb.table("recurring_rules")
            .select("*")
            .eq("active", True)
            .eq("day_of_month", day)
            .execute()
        )
        rules = res.data or []
        # Anti-dobel: skip yang last_run_date == hari ini
        return [r for r in rules if r.get("last_run_date") != str(today)]

    async def mark_recurring_run(self, rule_id: str, today: date) -> None:
        """Tandai aturan sudah dieksekusi hari ini (set last_run_date)."""
        sb = _get_client()
        await asyncio.to_thread(
            lambda: sb.table("recurring_rules")
            .update({"last_run_date": str(today)})
            .eq("id", rule_id)
            .execute()
        )

    async def get_recurring(self, rule_id: str) -> Optional[dict]:
        """Ambil satu aturan berulang by id (dipakai callback reminder)."""
        sb  = _get_client()
        res = await asyncio.to_thread(
            lambda: sb.table("recurring_rules")
            .select("*")
            .eq("id", rule_id)
            .maybe_single()
            .execute()
        )
        return res.data if res else None

    # ── Insight / Analytics (read-only, tanpa migrasi DB) ─────────────────────

    async def get_month_totals(self, tenant_id: str, month: int, year: int) -> dict:
        """
        Total pemasukan & pengeluaran untuk SATU bulan kalender penuh.
        Read-only, memakai tabel transactions langsung (tanpa view baru).

        Return: {"income": int, "expense": int, "count": int}
        """
        from calendar import monthrange
        last_day    = monthrange(year, month)[1]
        month_start = date(year, month, 1)
        month_end   = date(year, month, last_day)

        sb  = _get_client()
        res = await asyncio.to_thread(
            lambda: sb.table("transactions")
            .select("amount, type")
            .eq("tenant_id", tenant_id)
            .gte("transaction_date", str(month_start))
            .lte("transaction_date", str(month_end))
            .execute()
        )
        txs     = res.data or []
        income  = sum(int(t["amount"]) for t in txs if t["type"] == "income")
        expense = sum(int(t["amount"]) for t in txs if t["type"] == "expense")
        return {"income": income, "expense": expense, "count": len(txs)}

    async def get_expense_by_category_range(
        self, tenant_id: str, month: int, year: int,
    ) -> dict[str, int]:
        """
        Pengeluaran per kategori untuk satu bulan, sebagai dict {kategori: total}.
        Membungkus view v_expense_by_category yang sudah ada, di-map ke dict
        supaya gampang dibandingkan antar bulan di layer insight.
        """
        rows = await self.get_expense_by_category(tenant_id, month, year)
        return {r["category_name"]: int(r["total"]) for r in rows}

    # ── Account linking (web ⇄ bot) ───────────────────────────────────────────

    async def update_member_user_id(self, member_id: str, user_id: str) -> None:
        """Isi user_id (auth.users) ke satu baris tenant_members by id."""
        sb = _get_client()
        await asyncio.to_thread(
            lambda: sb.table("tenant_members")
            .update({"user_id": user_id})
            .eq("id", member_id)
            .execute()
        )

    async def create_link_code(
        self,
        code: str,
        direction: str,
        expires_at: str,
        user_id: Optional[str] = None,
        telegram_id: Optional[int] = None,
        tenant_id: Optional[str] = None,
    ) -> dict:
        """Buat baris account_link_codes. direction: 'web_to_bot'|'bot_to_web'."""
        sb      = _get_client()
        payload: dict = {"code": code, "direction": direction, "expires_at": expires_at}
        if user_id:     payload["user_id"]     = user_id
        if telegram_id: payload["telegram_id"] = telegram_id
        if tenant_id:   payload["tenant_id"]   = tenant_id
        res = await asyncio.to_thread(
            lambda: sb.table("account_link_codes").insert(payload).execute()
        )
        return res.data[0]

    async def get_active_link_code(self, code: str, direction: str) -> Optional[dict]:
        """Ambil kode aktif (belum diklaim) sesuai arah. Cek expiry di caller."""
        sb = _get_client()
        try:
            res = await asyncio.to_thread(
                lambda: sb.table("account_link_codes")
                .select("*")
                .eq("code", code)
                .eq("direction", direction)
                .is_("claimed_at", "null")
                .maybe_single()
                .execute()
            )
            return res.data if res else None
        except Exception:
            return None

    async def claim_link_code(self, link_id: str) -> None:
        """Tandai kode terpakai (set claimed_at = now)."""
        from datetime import datetime, timezone
        sb  = _get_client()
        now = datetime.now(timezone.utc).isoformat()
        await asyncio.to_thread(
            lambda: sb.table("account_link_codes")
            .update({"claimed_at": now})
            .eq("id", link_id)
            .execute()
        )

    async def delete_unclaimed_codes(self, direction: str, telegram_id: int) -> None:
        """Hapus kode lama (arah tsb) yang belum diklaim untuk telegram ini."""
        sb = _get_client()
        await asyncio.to_thread(
            lambda: sb.table("account_link_codes")
            .delete()
            .eq("direction", direction)
            .eq("telegram_id", telegram_id)
            .is_("claimed_at", "null")
            .execute()
        )
