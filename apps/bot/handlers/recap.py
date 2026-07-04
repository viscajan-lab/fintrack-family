"""
Handler: /rekap [kemarin|DD-MM|YYYY-MM-DD], /rekap_bulan, /hapus <id>
Role guard: hanya admin yang bisa hapus.
"""
from __future__ import annotations

from datetime import date, timedelta
from aiogram import Router, F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery
from aiogram.filters import Command, CommandObject

from services.supabase_service import SupabaseService

router = Router()
db = SupabaseService()


# ── helpers ───────────────────────────────────────────────────────────────────

def format_idr(amount: int) -> str:
    return f"Rp {amount:,.0f}".replace(",", ".")


def bar(ratio: float, width: int = 10) -> str:
    filled = round(ratio * width)
    return "█" * filled + "░" * (width - filled)


def _parse_date_arg(arg: str | None) -> date:
    """
    Konversi argumen teks ke date:
      - None / kosong  → hari ini
      - "kemarin"      → kemarin
      - "DD-MM"        → bulan ini, hari DD
      - "YYYY-MM-DD"   → literal
    """
    today = date.today()
    if not arg:
        return today
    arg = arg.strip().lower()
    if arg == "kemarin":
        return today - timedelta(days=1)
    # coba YYYY-MM-DD
    try:
        return date.fromisoformat(arg)
    except ValueError:
        pass
    # coba DD-MM
    parts = arg.replace("/", "-").split("-")
    if len(parts) == 2:
        try:
            d, m = int(parts[0]), int(parts[1])
            return date(today.year, m, d)
        except ValueError:
            pass
    return today


def _is_admin(member: dict) -> bool:
    return member.get("role") == "admin"


def recap_keyboard(txs: list[dict], is_admin: bool) -> InlineKeyboardMarkup | None:
    """Tombol hapus per transaksi — hanya muncul kalau admin."""
    if not is_admin:
        return None
    buttons = []
    for tx in txs[-5:]:
        icon  = "📥" if tx["type"] == "income" else "📤"
        label = f"🗑 {icon} {tx['description'][:18]} {format_idr(tx['amount'])}"
        buttons.append([InlineKeyboardButton(text=label, callback_data=f"rekap_del:{tx['id']}")])
    return InlineKeyboardMarkup(inline_keyboard=buttons) if buttons else None


# ── /rekap [kemarin|DD-MM|YYYY-MM-DD] ────────────────────────────────────────

@router.message(Command("rekap"))
async def cmd_rekap(message: Message, command: CommandObject) -> None:
    tg_id  = message.from_user.id   # type: ignore[union-attr]
    member = await db.get_member_by_telegram_id(tg_id)
    if not member:
        await message.answer("❗ Ketik /start dulu ya!")
        return

    target = _parse_date_arg(command.args)
    data   = await db.get_summary(member["tenant_id"], target, target)

    income  = data["total_income"]
    expense = data["total_expense"]
    net     = income - expense
    txs     = data["transactions"]

    # label tanggal
    today = date.today()
    if target == today:
        label = f"Hari Ini — {target.strftime('%d %b %Y')}"
    elif target == today - timedelta(days=1):
        label = f"Kemarin — {target.strftime('%d %b %Y')}"
    else:
        label = target.strftime("%d %b %Y")

    lines = [f"📊 *Rekap {label}*\n"]
    lines.append(f"📥 Pemasukan  : *{format_idr(income)}*")
    lines.append(f"📤 Pengeluaran: *{format_idr(expense)}*")
    lines.append(f"💰 Selisih   : *{format_idr(net)}*\n")

    kb = None
    if txs:
        lines.append("*Transaksi:*")
        for tx in txs[-8:]:
            icon     = "📥" if tx["type"] == "income" else "📤"
            short_id = tx["id"][:6]
            lines.append(f"{icon} `[{short_id}]` {tx['description']} — {format_idr(tx['amount'])}")

        if _is_admin(member):
            lines.append("\n_Tekan tombol di bawah untuk hapus transaksi._")
            kb = recap_keyboard(txs, is_admin=True)
        else:
            lines.append("\n_Hanya admin yang bisa menghapus transaksi._")
    else:
        lines.append(f"_Belum ada transaksi pada {label}._")

    await message.answer("\n".join(lines), parse_mode="Markdown", reply_markup=kb)


# ── /rekap_bulan ──────────────────────────────────────────────────────────────

@router.message(Command("rekap_bulan"))
async def cmd_rekap_month(message: Message) -> None:
    tg_id  = message.from_user.id   # type: ignore[union-attr]
    member = await db.get_member_by_telegram_id(tg_id)
    if not member:
        await message.answer("❗ Ketik /start dulu ya!")
        return

    today       = date.today()
    month_start = today.replace(day=1)
    data        = await db.get_summary(member["tenant_id"], month_start, today)
    by_cat      = await db.get_expense_by_category(member["tenant_id"], today.month, today.year)

    income  = data["total_income"]
    expense = data["total_expense"]
    net     = income - expense
    txs     = data["transactions"]

    lines = [f"📅 *Rekap {today.strftime('%B %Y')}*\n"]
    lines.append(f"📥 Total Pemasukan  : *{format_idr(income)}*")
    lines.append(f"📤 Total Pengeluaran: *{format_idr(expense)}*")
    lines.append(f"💰 Net Tabungan     : *{format_idr(net)}*\n")

    if by_cat:
        lines.append("*Pengeluaran per Kategori:*")
        max_val = max(c["total"] for c in by_cat) or 1
        for cat in by_cat[:8]:
            ratio = cat["total"] / max_val
            lines.append(f"{bar(ratio)} {cat['category_name']} — {format_idr(cat['total'])}")

    kb = None
    if txs and _is_admin(member):
        lines.append("\n*8 Transaksi Terakhir:*")
        for tx in txs[-8:]:
            icon     = "📥" if tx["type"] == "income" else "📤"
            short_id = tx["id"][:6]
            lines.append(f"{icon} `[{short_id}]` {tx['description']} — {format_idr(tx['amount'])}")
        lines.append("_Tekan tombol di bawah untuk hapus._")
        kb = recap_keyboard(txs, is_admin=True)

    await message.answer("\n".join(lines), parse_mode="Markdown", reply_markup=kb)


# ── /hapus <id> ───────────────────────────────────────────────────────────────

@router.message(Command("hapus"))
async def cmd_hapus(message: Message, command: CommandObject) -> None:
    tg_id  = message.from_user.id   # type: ignore[union-attr]
    member = await db.get_member_by_telegram_id(tg_id)
    if not member:
        await message.answer("❗ Ketik /start dulu ya!")
        return

    # 🔒 role guard
    if not _is_admin(member):
        await message.answer("❌ Hanya admin yang bisa menghapus transaksi.")
        return

    tx_id = (command.args or "").strip()
    if not tx_id:
        await message.answer(
            "❓ Format: `/hapus <id_transaksi>`\n\n"
            "ID transaksi bisa dilihat di `/rekap` (6 karakter dalam kurung siku).",
            parse_mode="Markdown"
        )
        return

    # Cari di 90 hari terakhir saja — efisien
    since = date.today() - timedelta(days=90)
    txs   = (await db.get_summary(member["tenant_id"], since, date.today()))["transactions"]

    matched = [t for t in txs if t["id"].startswith(tx_id)]
    if not matched:
        await message.answer(
            f"❌ Transaksi `{tx_id}` tidak ditemukan dalam 90 hari terakhir.",
            parse_mode="Markdown"
        )
        return
    if len(matched) > 1:
        await message.answer(
            f"⚠️ ID ambigu ({len(matched)} cocok). Gunakan ID lebih panjang.",
            parse_mode="Markdown"
        )
        return

    deleted = await db.delete_transaction(matched[0]["id"], member["tenant_id"])
    if deleted:
        tx = matched[0]
        await message.answer(
            f"🗑 *Dihapus:* {tx['description']} — {format_idr(tx['amount'])}",
            parse_mode="Markdown"
        )
    else:
        await message.answer("❌ Gagal menghapus. Coba lagi.")


# ── Callback: hapus dari tombol di rekap (admin only) ─────────────────────────

@router.callback_query(F.data.startswith("rekap_del:"))
async def cb_rekap_delete(callback: CallbackQuery) -> None:
    member = await db.get_member_by_telegram_id(callback.from_user.id)
    if not member:
        await callback.answer("❌ Akses ditolak.", show_alert=True)
        return

    # 🔒 role guard
    if not _is_admin(member):
        await callback.answer("❌ Hanya admin yang bisa menghapus transaksi.", show_alert=True)
        return

    tx_id   = callback.data.split(":", 1)[1]   # type: ignore[union-attr]
    deleted = await db.delete_transaction(tx_id, member["tenant_id"])
    if deleted:
        await callback.answer("✅ Transaksi dihapus!", show_alert=False)
        if callback.message and hasattr(callback.message, "reply_markup"):
            old_kb = callback.message.reply_markup
            if old_kb:
                new_rows = [
                    row for row in old_kb.inline_keyboard
                    if not any(btn.callback_data == callback.data for btn in row)
                ]
                new_kb = InlineKeyboardMarkup(inline_keyboard=new_rows) if new_rows else None
                await callback.message.edit_reply_markup(reply_markup=new_kb)  # type: ignore[union-attr]
    else:
        await callback.answer("❌ Gagal menghapus.", show_alert=True)
