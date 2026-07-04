"""
Handler: /rekap, /rekap_bulan, /hapus <id>
"""
from aiogram import Router, F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery
from aiogram.filters import Command, CommandObject

from services.supabase_service import SupabaseService

router = Router()
db = SupabaseService()


def format_idr(amount: int) -> str:
    return f"Rp {amount:,.0f}".replace(",", ".")


def bar(ratio: float, width: int = 10) -> str:
    filled = round(ratio * width)
    return "█" * filled + "░" * (width - filled)


def recap_keyboard(txs: list[dict]) -> InlineKeyboardMarkup:
    """Buat tombol hapus per transaksi (max 5 terakhir agar tidak overflow)."""
    buttons = []
    for tx in txs[-5:]:
        icon  = "📥" if tx["type"] == "income" else "📤"
        label = f"🗑 {icon} {tx['description'][:18]} {format_idr(tx['amount'])}"
        buttons.append([InlineKeyboardButton(text=label, callback_data=f"rekap_del:{tx['id']}")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


@router.message(Command("rekap"))
async def cmd_rekap_today(message: Message) -> None:
    tg_id  = message.from_user.id  # type: ignore[union-attr]
    member = await db.get_member_by_telegram_id(tg_id)
    if not member:
        await message.answer("❗ Ketik /start dulu ya!")
        return

    from datetime import date
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
        for tx in txs[-8:]:
            icon = "📥" if tx["type"] == "income" else "📤"
            short_id = tx["id"][:6]
            lines.append(f"{icon} `[{short_id}]` {tx['description']} — {format_idr(tx['amount'])}")
        lines.append("\n_Tekan tombol di bawah untuk hapus transaksi._")
        await message.answer(
            "\n".join(lines),
            parse_mode="Markdown",
            reply_markup=recap_keyboard(txs),
        )
    else:
        lines.append("_Belum ada transaksi hari ini._")
        await message.answer("\n".join(lines), parse_mode="Markdown")


@router.message(Command("rekap_bulan"))
async def cmd_rekap_month(message: Message) -> None:
    tg_id  = message.from_user.id  # type: ignore[union-attr]
    member = await db.get_member_by_telegram_id(tg_id)
    if not member:
        await message.answer("❗ Ketik /start dulu ya!")
        return

    from datetime import date
    today       = date.today()
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
            lines.append(f"{bar(ratio)} {cat['category_name']} — {format_idr(cat['total'])}")

    await message.answer("\n".join(lines), parse_mode="Markdown")


@router.message(Command("hapus"))
async def cmd_hapus(message: Message, command: CommandObject) -> None:
    tg_id  = message.from_user.id  # type: ignore[union-attr]
    member = await db.get_member_by_telegram_id(tg_id)
    if not member:
        await message.answer("❗ Ketik /start dulu ya!")
        return

    tx_id = (command.args or "").strip()
    if not tx_id:
        await message.answer(
            "❓ Format: `/hapus <id_transaksi>`\n\n"
            "ID transaksi bisa dilihat di `/rekap` (6 karakter dalam kurung siku).",
            parse_mode="Markdown"
        )
        return

    # Support short ID (6 char prefix) — cari full ID dulu
    txs = (await db.get_summary(
        member["tenant_id"],
        __import__("datetime").date(2000, 1, 1),
        __import__("datetime").date(2099, 12, 31),
    ))["transactions"]

    matched = [t for t in txs if t["id"].startswith(tx_id)]
    if not matched:
        await message.answer(f"❌ Transaksi dengan ID `{tx_id}` tidak ditemukan.", parse_mode="Markdown")
        return
    if len(matched) > 1:
        await message.answer(f"⚠️ ID ambigu, ada {len(matched)} transaksi cocok. Gunakan ID lebih panjang.", parse_mode="Markdown")
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


# ── Callback: hapus dari tombol di rekap ──────────────────────────────────────
@router.callback_query(F.data.startswith("rekap_del:"))
async def cb_rekap_delete(callback: CallbackQuery) -> None:
    tx_id  = callback.data.split(":", 1)[1]  # type: ignore[union-attr]
    member = await db.get_member_by_telegram_id(callback.from_user.id)
    if not member:
        await callback.answer("❌ Akses ditolak.", show_alert=True)
        return

    deleted = await db.delete_transaction(tx_id, member["tenant_id"])
    if deleted:
        await callback.answer("✅ Transaksi dihapus!", show_alert=False)
        # Edit keyboard — hapus tombol yang sudah ditekan
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
