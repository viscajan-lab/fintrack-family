"""
Handler: /budget      — cek sisa budget per kategori bulan ini
Handler: /set_budget  — set / ubah budget kategori (hybrid: one-shot + interaktif)
"""
from aiogram import Router, F
from aiogram.types import Message
from aiogram.filters import Command, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from datetime import date

from services.supabase_service import SupabaseService
from services.nlp_parser import _parse_amount

router = Router()
db = SupabaseService()

# Kategori kanonik — HARUS sama dengan yang dipakai nlp_parser saat catat transaksi,
# supaya budget & pengeluaran nyocok saat dihitung.
VALID_CATEGORIES = [
    "Makanan & Minuman", "Transportasi", "Rumah & Tagihan", "Belanja",
    "Kesehatan", "Pendidikan", "Hiburan", "Gaji",
    "Usaha / Freelance", "Transfer Masuk", "Lainnya",
]


def match_category(raw: str) -> str | None:
    """
    Cocokkan input user ke kategori kanonik.
    - Case-insensitive
    - Cocok penuh ATAU prefix unik (mis. 'makan' -> 'Makanan & Minuman',
      'trans' ambigu -> None supaya user memperjelas).
    """
    raw = raw.strip().lower()
    if not raw:
        return None
    # 1. Cocok persis
    for c in VALID_CATEGORIES:
        if c.lower() == raw:
            return c
    # 2. Cocok prefix — harus unik
    hits = [c for c in VALID_CATEGORIES if c.lower().startswith(raw)]
    if len(hits) == 1:
        return hits[0]
    # 3. Cocok substring — harus unik (mis. 'minuman')
    hits = [c for c in VALID_CATEGORIES if raw in c.lower()]
    if len(hits) == 1:
        return hits[0]
    return None



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


# ══════════════════════════════════════════════════════════════════════════════
#  /set_budget — hybrid: one-shot kalau argumen lengkap, FSM kalau tidak
# ══════════════════════════════════════════════════════════════════════════════

class SetBudget(StatesGroup):
    waiting_category = State()
    waiting_amount   = State()


def _category_menu() -> str:
    return "\n".join(f"• {c}" for c in VALID_CATEGORIES)


async def _save_budget(message: Message, member: dict, category: str, amount: int) -> None:
    """Simpan budget + balas konfirmasi. Dipakai baik jalur one-shot maupun FSM."""
    today = date.today()
    await db.upsert_budget(
        tenant_id=member["tenant_id"],
        category_name=category,
        amount=amount,
        month=today.month,
        year=today.year,
    )
    await message.answer(
        f"✅ *Budget tersimpan!*\n\n"
        f"Kategori : *{category}*\n"
        f"Nominal  : *{format_idr(amount)}*\n"
        f"Periode  : {today.strftime('%B %Y')}\n\n"
        f"Cek semua budget: /budget",
        parse_mode="Markdown",
    )


@router.message(Command("set_budget"))
async def cmd_set_budget(message: Message, state: FSMContext) -> None:
    await state.clear()
    if not message.from_user:
        return
    member = await db.get_member_by_telegram_id(message.from_user.id)
    if not member:
        await message.answer("❗ Ketik /start dulu ya!")
        return

    # Argumen setelah command: "/set_budget Makan 1jt" -> ["Makan", "1jt"]
    parts = (message.text or "").split(maxsplit=1)
    args  = parts[1].strip() if len(parts) > 1 else ""

    # ── Jalur ONE-SHOT: ada argumen ──────────────────────────────────────────
    if args:
        # Pisah dari KANAN: token terakhir = nominal, sisanya = kategori
        # (kategori bisa multi-kata: "Rumah & Tagihan 2jt")
        tokens = args.rsplit(maxsplit=1)
        if len(tokens) == 2:
            cat_raw, amount_raw = tokens[0], tokens[1]
            category = match_category(cat_raw)
            amount   = _parse_amount(amount_raw)
            if category and amount and amount > 0:
                await _save_budget(message, member, category, amount)
                return
            # Argumen ada tapi tidak valid -> kasih tahu, lalu jatuh ke interaktif
            if not category:
                await message.answer(
                    f"⚠️ Kategori *{cat_raw}* tidak dikenali. Pilih dari daftar di bawah.",
                    parse_mode="Markdown",
                )
            elif not amount or amount <= 0:
                await message.answer(
                    f"⚠️ Nominal *{amount_raw}* tidak valid (harus angka > 0, mis. `1jt`, `500rb`).",
                    parse_mode="Markdown",
                )

    # ── Jalur INTERAKTIF: mulai FSM, tanya kategori ─────────────────────────
    await state.set_state(SetBudget.waiting_category)
    await message.answer(
        "💳 *Set Budget*\n\n"
        "Mau set budget untuk kategori apa? Ketik namanya:\n\n"
        f"{_category_menu()}\n\n"
        "_Ketik /batal untuk membatalkan._",
        parse_mode="Markdown",
    )


@router.message(Command("batal"), StateFilter(SetBudget))
async def cancel_set_budget(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("❌ Dibatalkan. Tidak ada budget yang diubah.")


@router.message(StateFilter(SetBudget.waiting_category), F.text)
async def sb_got_category(message: Message, state: FSMContext) -> None:
    category = match_category(message.text or "")
    if not category:
        await message.answer(
            "⚠️ Kategori tidak dikenali. Ketik salah satu (boleh disingkat, mis. `makan`):\n\n"
            f"{_category_menu()}",
            parse_mode="Markdown",
        )
        return
    await state.update_data(category=category)
    await state.set_state(SetBudget.waiting_amount)
    await message.answer(
        f"Oke, kategori *{category}*.\n\n"
        f"Sekarang ketik nominal budget-nya (mis. `1jt`, `500rb`, `1000000`):",
        parse_mode="Markdown",
    )


@router.message(StateFilter(SetBudget.waiting_amount), F.text)
async def sb_got_amount(message: Message, state: FSMContext) -> None:
    amount = _parse_amount(message.text or "")
    if not amount or amount <= 0:
        await message.answer(
            "⚠️ Nominal tidak valid. Ketik angka > 0, mis. `1jt`, `500rb`, `1000000`:",
            parse_mode="Markdown",
        )
        return
    data   = await state.get_data()
    member = await db.get_member_by_telegram_id(message.from_user.id) if message.from_user else None
    await state.clear()
    if not member:
        await message.answer("❗ Ketik /start dulu ya!")
        return
    await _save_budget(message, member, data["category"], amount)

