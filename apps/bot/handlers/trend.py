"""
Handler: /tren — analitik tren tahunan (12 bulan penuh).

Padanan halaman web `dashboard/trends` (getYearlyTrend + getAvailableYears).
Semua read-only, memakai method di SupabaseService:
  - get_available_years()  → daftar tahun yang punya transaksi
  - get_yearly_trend()     → ringkasan arus kas 1 tahun (12 bulan)

Yang dihasilkan:
  1. Total pemasukan / pengeluaran / tabungan setahun + savings rate
  2. Rata-rata pengeluaran per bulan (bulan aktif)
  3. Bulan terbaik (tabungan tertinggi) & paling boros (tabungan terendah)
  4. Mini bar chart 12 bulan (tabungan bersih per bulan, teks)
  5. Pemilih tahun via inline keyboard (kalau ada >1 tahun berdata)
"""
from __future__ import annotations

from datetime import date

from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import Command

from services.supabase_service import SupabaseService

router = Router()
db = SupabaseService()


def format_idr(amount: int) -> str:
    return f"Rp {amount:,.0f}".replace(",", ".")


def _year_keyboard(years: list[int], current: int) -> InlineKeyboardMarkup | None:
    """Inline keyboard pemilih tahun. None kalau cuma 1 tahun."""
    if len(years) <= 1:
        return None
    buttons = []
    row = []
    for y in years:
        label = f"• {y} •" if y == current else str(y)
        row.append(InlineKeyboardButton(text=label, callback_data=f"tren:{y}"))
        if len(row) == 3:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def _mini_bars(months: list[dict]) -> str:
    """
    Mini bar chart teks: tabungan bersih (income - expense) per bulan.
    Skala relatif terhadap |nilai| terbesar. 8 blok maksimum.
    """
    nets = [m["income"] - m["expense"] for m in months]
    peak = max((abs(n) for n in nets), default=0)
    if peak == 0:
        return ""
    lines = []
    for m, net in zip(months, nets):
        # Lewati bulan tanpa transaksi (biar chart ringkas)
        if m["income"] == 0 and m["expense"] == 0:
            continue
        blocks = round(abs(net) / peak * 8)
        if net > 0:
            bar = "🟩" * max(1, blocks)
        elif net < 0:
            bar = "🟥" * max(1, blocks)
        else:
            bar = "▪️"
        lines.append(f"<code>{m['name']}</code> {bar}")
    return "\n".join(lines)


def _build_trend_message(trend: dict) -> str:
    """Susun pesan HTML ringkasan tren tahunan."""
    year          = trend["year"]
    total_income  = trend["total_income"]
    total_expense = trend["total_expense"]
    total_savings = trend["total_savings"]
    avg_expense   = trend["avg_monthly_expense"]
    best          = trend["best_month"]
    worst         = trend["worst_month"]

    savings_rate = round(total_savings / total_income * 100) if total_income > 0 else 0

    # Belum ada data
    if total_income == 0 and total_expense == 0:
        return (
            f"📈 <b>Tren Tahunan {year}</b>\n\n"
            "Belum ada transaksi di tahun ini.\n"
            "Yuk mulai catat — ketik aja mis. <code>Makan siang 35rb</code>!"
        )

    savings_emoji = "🟢" if total_savings >= 0 else "🔴"

    lines = [
        f"📈 <b>Tren Tahunan {year}</b>",
        f"<i>Pola arus kas keluarga sepanjang {year}</i>\n",
        f"📥 Pemasukan:  <b>{format_idr(total_income)}</b>",
        f"📤 Pengeluaran: <b>{format_idr(total_expense)}</b>",
        f"💰 Tabungan:   <b>{format_idr(total_savings)}</b> {savings_emoji} "
        f"({savings_rate}% dari pemasukan)",
        "",
        f"📊 Rata-rata pengeluaran/bulan: <b>{format_idr(avg_expense)}</b>",
    ]

    if best:
        lines.append(f"🏆 Bulan terbaik: <b>{best}</b> <i>(tabungan tertinggi)</i>")
    if worst:
        lines.append(f"⚠️ Paling boros: <b>{worst}</b> <i>(tabungan terendah)</i>")

    bars = _mini_bars(trend["months"])
    if bars:
        lines.append("\n<b>Tabungan bersih per bulan:</b>")
        lines.append(bars)

    lines.append("\n<i>🟩 surplus · 🟥 defisit · Lihat bulan ini: /insight</i>")
    return "\n".join(lines)


async def _render(tenant_id: str, year: int) -> tuple[str, InlineKeyboardMarkup | None]:
    """Ambil data + susun pesan & keyboard untuk satu tahun."""
    years = await db.get_available_years(tenant_id)
    if year not in years:
        year = years[0]
    trend = await db.get_yearly_trend(tenant_id, year)
    text  = _build_trend_message(trend)
    kb    = _year_keyboard(years, year)
    return text, kb


@router.message(Command("tren"))
async def cmd_tren(message: Message) -> None:
    if not message.from_user:
        return
    member = await db.get_member_by_telegram_id(message.from_user.id)
    if not member:
        await message.answer("❗ Ketik /start dulu ya!")
        return

    tenant_id = member["tenant_id"]
    year      = date.today().year
    text, kb  = await _render(tenant_id, year)
    await message.answer(text, parse_mode="HTML", reply_markup=kb)


@router.callback_query(F.data.startswith("tren:"))
async def cb_tren_year(callback: CallbackQuery) -> None:
    if not callback.from_user or not callback.data:
        return
    member = await db.get_member_by_telegram_id(callback.from_user.id)
    if not member:
        await callback.answer("Ketik /start dulu ya!", show_alert=True)
        return

    try:
        year = int(callback.data.split(":", 1)[1])
    except (ValueError, IndexError):
        await callback.answer()
        return

    tenant_id = member["tenant_id"]
    text, kb  = await _render(tenant_id, year)

    # Edit pesan yang sama (hindari spam chat)
    from aiogram.types import Message as TgMessage
    if isinstance(callback.message, TgMessage):
        try:
            await callback.message.edit_text(text, parse_mode="HTML", reply_markup=kb)
        except Exception:
            # Kalau konten identik / gagal edit, cukup jawab callback
            pass
    await callback.answer(f"Tahun {year}")
