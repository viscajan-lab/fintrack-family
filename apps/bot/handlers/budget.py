"""
Handler: /budget — cek sisa budget per kategori bulan ini
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


def progress_bar(used: int, limit: int, width: int = 8) -> str:
    ratio  = min(used / limit, 1.0) if limit > 0 else 0
    filled = round(ratio * width)
    bar    = "█" * filled + "░" * (width - filled)
    pct    = round(ratio * 100)
    icon   = "🔴" if pct >= 90 else "🟡" if pct >= 70 else "🟢"
    return f"{icon} {bar} {pct}%"


@router.message(Command("budget"))
async def cmd_budget(message: Message) -> None:
    tg_id  = message.from_user.id
    member = await db.get_member_by_telegram_id(tg_id)
    if not member:
        await message.answer("❗ Ketik /start dulu ya!")
        return

    today    = date.today()
    budgets  = await db.get_budgets(member["tenant_id"], today.month, today.year)
    expenses = await db.get_expense_by_category(member["tenant_id"], today.month, today.year)

    # Map pengeluaran ke dict
    spent_map = {e["category_name"]: e["total"] for e in expenses}

    if not budgets:
        await message.answer(
            "📋 Belum ada budget yang diset.\n\n"
            "Set budget via web dashboard ya: https://fintrack-family.vercel.app"
        )
        return

    lines = [f"💳 *Budget {today.strftime('%B %Y')}*\n"]
    total_budget = 0
    total_spent  = 0

    for b in budgets:
        cat_name  = b["category_name"]
        limit     = b["amount"]
        spent     = spent_map.get(cat_name, 0)
        remaining = limit - spent
        total_budget += limit
        total_spent  += spent

        lines.append(
            f"*{cat_name}*\n"
            f"{progress_bar(spent, limit)}\n"
            f"Terpakai: {format_idr(spent)} / {format_idr(limit)}\n"
            f"Sisa: *{format_idr(remaining)}*\n"
        )

    lines.append(f"─────────────────")
    lines.append(f"Total budget : {format_idr(total_budget)}")
    lines.append(f"Total terpakai: {format_idr(total_spent)}")
    lines.append(f"Sisa total   : *{format_idr(total_budget - total_spent)}*")

    await message.answer("\n".join(lines), parse_mode="Markdown")
