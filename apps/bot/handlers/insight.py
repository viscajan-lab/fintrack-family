"""
Handler: /insight  — analitik & perbandingan bulan ini vs bulan lalu.

Semua read-only, memanfaatkan method di SupabaseService (tanpa migrasi DB):
  - get_month_totals()              → total income/expense per bulan
  - get_expense_by_category_range() → pengeluaran per kategori per bulan

Yang dihasilkan:
  1. Ringkasan bulan ini + Δ% vs bulan lalu (income, expense, tabungan)
  2. Kategori naik/turun paling tajam (auto "boros di mana")
  3. Rata-rata harian + proyeksi akhir bulan (linear, sederhana)
  4. Insight kalimat manusia berdasarkan angka
"""
from __future__ import annotations

from calendar import monthrange
from datetime import date

from aiogram import Router
from aiogram.types import Message
from aiogram.filters import Command

from services.supabase_service import SupabaseService

router = Router()
db = SupabaseService()

_BULAN_ID = [
    "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]


def format_idr(amount: int) -> str:
    return f"Rp {amount:,.0f}".replace(",", ".")


def _prev_month(month: int, year: int) -> tuple[int, int]:
    """Bulan sebelumnya (tangani pergantian tahun)."""
    if month == 1:
        return 12, year - 1
    return month - 1, year


def _delta_line(label: str, now: int, prev: int, *, good_when_up: bool) -> str:
    """
    Satu baris perbandingan dengan panah & persentase.
    good_when_up: True untuk income/tabungan (naik=bagus), False untuk expense.
    """
    diff = now - prev
    if prev == 0:
        pct_txt = "(baru bulan ini)" if now > 0 else ""
    else:
        pct = round(abs(diff) / prev * 100)
        arrow = "🔺" if diff > 0 else ("🔻" if diff < 0 else "▪️")
        pct_txt = f"{arrow} {pct}%"

    # Warna emosi: naik-bagus/turun-jelek → hijau; sebaliknya → merah
    if diff == 0:
        mood = ""
    else:
        up_is_good = (diff > 0) == good_when_up
        mood = " 🟢" if up_is_good else " 🔴"

    return f"{label}: *{format_idr(now)}*  {pct_txt}{mood}"


def _top_movers(now_cat: dict[str, int], prev_cat: dict[str, int], limit: int = 3):
    """
    Kategori dengan perubahan absolut terbesar (naik & turun).
    Return list of (kategori, now, prev, diff) urut |diff| desc.
    """
    keys = set(now_cat) | set(prev_cat)
    movers = []
    for k in keys:
        n = now_cat.get(k, 0)
        p = prev_cat.get(k, 0)
        if n == p:
            continue
        movers.append((k, n, p, n - p))
    movers.sort(key=lambda x: abs(x[3]), reverse=True)
    return movers[:limit]


def _build_insights(
    now_t: dict, prev_t: dict,
    now_cat: dict[str, int], prev_cat: dict[str, int],
    day_now: int, days_in_month: int,
) -> list[str]:
    """Kalimat insight bahasa manusia berdasarkan angka. Maks ~3 poin paling relevan."""
    tips: list[str] = []

    now_exp, prev_exp = now_t["expense"], prev_t["expense"]
    now_inc           = now_t["income"]
    now_net           = now_inc - now_exp

    # 1. Pengeluaran melonjak?
    if prev_exp > 0 and now_exp > prev_exp * 1.15:
        pct = round((now_exp - prev_exp) / prev_exp * 100)
        tips.append(f"⚠️ Pengeluaran naik *{pct}%* dari bulan lalu — coba cek kategori yang melonjak di bawah.")
    elif prev_exp > 0 and now_exp < prev_exp * 0.85:
        pct = round((prev_exp - now_exp) / prev_exp * 100)
        tips.append(f"👏 Pengeluaran turun *{pct}%* dari bulan lalu. Hemat, mantap!")

    # 2. Kategori paling boros bulan ini
    if now_cat:
        top_cat = max(now_cat, key=lambda k: now_cat[k])
        prev_v  = prev_cat.get(top_cat, 0)
        v       = now_cat[top_cat]
        if prev_v > 0 and v > prev_v * 1.3:
            pct = round((v - prev_v) / prev_v * 100)
            tips.append(f"🔍 *{top_cat}* jadi pos terbesar & naik *{pct}%* — pantau ekstra ya.")
        else:
            tips.append(f"🔍 Pos terbesar bulan ini: *{top_cat}* ({format_idr(v)}).")

    # 3. Proyeksi & tabungan
    if day_now > 0 and now_exp > 0:
        daily_avg = now_exp / day_now
        projected = round(daily_avg * days_in_month)
        if projected > now_exp:
            tips.append(
                f"📈 Rata-rata *{format_idr(round(daily_avg))}*/hari → "
                f"proyeksi akhir bulan ~*{format_idr(projected)}*."
            )

    if now_net > 0:
        tips.append(f"💰 Sejauh ini kamu nabung *{format_idr(now_net)}* bulan ini. Pertahankan!")
    elif now_net < 0:
        tips.append(f"🚨 Pengeluaran > pemasukan sebesar *{format_idr(-now_net)}* bulan ini. Rem dikit yuk.")

    return tips[:4]


@router.message(Command("insight"))
async def cmd_insight(message: Message) -> None:
    if not message.from_user:
        return
    member = await db.get_member_by_telegram_id(message.from_user.id)
    if not member:
        await message.answer("❗ Ketik /start dulu ya!")
        return

    tenant_id = member["tenant_id"]
    today     = date.today()
    m, y      = today.month, today.year
    pm, py    = _prev_month(m, y)

    # Ambil data 2 bulan (read-only)
    now_t   = await db.get_month_totals(tenant_id, m, y)
    prev_t  = await db.get_month_totals(tenant_id, pm, py)
    now_cat = await db.get_expense_by_category_range(tenant_id, m, y)
    prev_cat = await db.get_expense_by_category_range(tenant_id, pm, py)

    # Belum ada data sama sekali
    if now_t["count"] == 0 and prev_t["count"] == 0:
        await message.answer(
            "📊 *Insight Keuangan*\n\n"
            "Belum ada transaksi untuk dianalisis.\n"
            "Yuk mulai catat — ketik aja mis. `Makan siang 35rb`, "
            "nanti insight-nya muncul di sini!",
            parse_mode="Markdown",
        )
        return

    now_net  = now_t["income"] - now_t["expense"]
    prev_net = prev_t["income"] - prev_t["expense"]

    days_in_month = monthrange(y, m)[1]
    day_now       = today.day

    # ── Susun pesan ──────────────────────────────────────────────────────────
    lines = [
        f"📊 *Insight — {_BULAN_ID[m]} {y}*",
        f"_dibanding {_BULAN_ID[pm]} {py}_\n",
        _delta_line("📥 Pemasukan", now_t["income"], prev_t["income"], good_when_up=True),
        _delta_line("📤 Pengeluaran", now_t["expense"], prev_t["expense"], good_when_up=False),
        _delta_line("💰 Tabungan", now_net, prev_net, good_when_up=True),
    ]

    # Top movers kategori
    movers = _top_movers(now_cat, prev_cat)
    if movers:
        lines.append("\n*Perubahan Kategori Terbesar:*")
        for cat, n, p, diff in movers:
            arrow = "🔺" if diff > 0 else "🔻"
            if p == 0:
                detail = f"(baru: {format_idr(n)})"
            elif n == 0:
                detail = f"(berhenti, dulu {format_idr(p)})"
            else:
                pct = round(abs(diff) / p * 100)
                detail = f"{format_idr(p)} → {format_idr(n)} ({pct}%)"
            lines.append(f"{arrow} *{cat}* {detail}")

    # Insight kalimat
    tips = _build_insights(now_t, prev_t, now_cat, prev_cat, day_now, days_in_month)
    if tips:
        lines.append("\n*💡 Catatan:*")
        lines.extend(tips)

    lines.append("\n_Lihat rincian: /rekap_bulan · /budget_")

    await message.answer("\n".join(lines), parse_mode="Markdown")
