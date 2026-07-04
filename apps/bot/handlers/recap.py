"""
Handler: /rekap dan /rekap_bulan
"""
from aiogram import Router
from aiogram.types import Message
from aiogram.filters import Command
from datetime import date

from services.supabase_service import SupabaseService

router = Router()
db = SupabaseService()


def format_idr(amount: int) -> str:
    return f"Rp {amount:,.0f}".replace(",", ".")


def bar(ratio: float, width: int = 10) -> str:
    """Mini ASCII progress bar"""
    filled = round(ratio * width)
    return "█" * filled + "░" * (width - filled)


@router.message(Command("rekap"))
async def cmd_rekap_today(message: Message) -> None:
    tg_id  = message.from_user.id
    member = await db.get_member_by_telegram_id(tg_id)
    if not member:
        await message.answer("❗ Ketik /start dulu ya!")
        return

    today = date.today()
    data  = await db.get_summary(member["tenant_id"], today, today)

    income  = data["total_income"]
    expense = data["total_expense"]
    net     = income - expense
    txs     = data["transactions"]

    lines = [f"📊 *Rekap Hari Ini — {today.strftime('%d %b %Y')}*\n"]
    lines.append(f"📥 Pemasukan  : *{format_idr(income)}*")
    lines.append(f"📤 Pengeluaran: *{format_idr(expense)}*")
    lines.append(f"💰 Selisih   : *{format_idr(net)}*\n")

    if txs:
        lines.append("*Transaksi:*")
        for tx in txs[-8:]:   # max 8 entry terakhir
            icon = "📥" if tx["type"] == "income" else "📤"
            lines.append(f"{icon} {tx['description']} — {format_idr(tx['amount'])}")
    else:
        lines.append("_Belum ada transaksi hari ini._")

    await message.answer("\n".join(lines), parse_mode="Markdown")


@router.message(Command("rekap_bulan"))
async def cmd_rekap_month(message: Message) -> None:
    tg_id  = message.from_user.id
    member = await db.get_member_by_telegram_id(tg_id)
    if not member:
        await message.answer("❗ Ketik /start dulu ya!")
        return

    today      = date.today()
    month_start = today.replace(day=1)
    data        = await db.get_summary(member["tenant_id"], month_start, today)
    by_cat      = await db.get_expense_by_category(member["tenant_id"], today.month, today.year)

    income  = data["total_income"]
    expense = data["total_expense"]
    net     = income - expense

    lines = [f"📅 *Rekap {today.strftime('%B %Y')}*\n"]
    lines.append(f"📥 Total Pemasukan  : *{format_idr(income)}*")
    lines.append(f"📤 Total Pengeluaran: *{format_idr(expense)}*")
    lines.append(f"💰 Net Tabungan     : *{format_idr(net)}*\n")

    if by_cat:
        lines.append("*Pengeluaran per Kategori:*")
        max_val = max(c["total"] for c in by_cat) or 1
        for cat in by_cat[:8]:
            ratio = cat["total"] / max_val
            lines.append(
                f"{bar(ratio)} {cat['category_name']} — {format_idr(cat['total'])}"
            )

    await message.answer("\n".join(lines), parse_mode="Markdown")
