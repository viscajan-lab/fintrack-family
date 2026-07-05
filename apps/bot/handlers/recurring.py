"""
Handler: /recurring      — daftar aturan berulang + hapus
Handler: /add_recurring  — buat aturan berulang (hybrid: one-shot + interaktif FSM)
Callback: konfirmasi reminder (rec_yes / rec_no) saat tagihan mode 'reminder' jatuh tempo.
"""
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import Command, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from datetime import date

from services.supabase_service import SupabaseService
from services.nlp_parser import _parse_amount
from services.scheduler import run_rule
from handlers.budget import match_category, format_idr, _category_menu

router = Router()
db = SupabaseService()


def _mode_label(mode: str) -> str:
    return "🤖 Otomatis" if mode == "auto" else "🔔 Ingatkan"


def _fmt_rule(r: dict) -> str:
    status = "" if r.get("active", True) else " _(nonaktif)_"
    return (
        f"*{r['description']}*{status}\n"
        f"{format_idr(r['amount'])} • {r['category_name']}\n"
        f"Tiap tanggal *{r['day_of_month']}* • {_mode_label(r['mode'])}"
    )


@router.message(Command("recurring"))
async def cmd_recurring(message: Message) -> None:
    if not message.from_user:
        return
    member = await db.get_member_by_telegram_id(message.from_user.id)
    if not member:
        await message.answer("❗ Ketik /start dulu ya!")
        return

    rules = await db.list_recurring(member["tenant_id"])
    if not rules:
        await message.answer(
            "📭 Belum ada tagihan/langganan berulang.\n\n"
            "Tambah dengan:\n`/add_recurring Netflix Hiburan 55rb 5`\n"
            "_(nama, kategori, nominal, tanggal)_",
            parse_mode="Markdown",
        )
        return

    lines = ["🔁 *Tagihan & Langganan Berulang*\n"]
    for r in rules:
        lines.append(_fmt_rule(r) + "\n")
    lines.append("_Hapus salah satu lewat tombol di bawah._")

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=f"🗑 {r['description']}", callback_data=f"rec_del:{r['id']}")]
        for r in rules
    ])
    await message.answer("\n".join(lines), parse_mode="Markdown", reply_markup=kb)


@router.callback_query(F.data.startswith("rec_del:"))
async def cb_delete_recurring(cb: CallbackQuery) -> None:
    if not cb.data or not cb.from_user:
        return
    rule_id = cb.data.split(":", 1)[1]
    member  = await db.get_member_by_telegram_id(cb.from_user.id)
    if not member:
        await cb.answer("Sesi habis, /start dulu.", show_alert=True)
        return
    ok = await db.delete_recurring(rule_id, member["tenant_id"])
    await cb.answer("🗑 Dihapus." if ok else "Gagal / sudah terhapus.")
    if ok and isinstance(cb.message, Message):
        await cb.message.edit_reply_markup(reply_markup=None)


# ── Callback konfirmasi reminder (dari scheduler mode 'reminder') ──────────────

@router.callback_query(F.data.startswith("recdue:"))
async def cb_recurring_confirm(cb: CallbackQuery) -> None:
    """User menekan 'Catat sekarang' pada pengingat tagihan → catat transaksi."""
    if not cb.data or not cb.from_user or not isinstance(cb.message, Message):
        return
    rule_id = cb.data.split(":", 1)[1]
    rule    = await db.get_recurring(rule_id)
    if not rule:
        await cb.answer("Aturan sudah tidak ada.", show_alert=True)
        await cb.message.edit_reply_markup(reply_markup=None)
        return
    await run_rule(db, rule, date.today())
    await cb.answer("✅ Dicatat!")
    await cb.message.edit_text(
        f"✅ *Tagihan dicatat*\n\n"
        f"*{rule['description']}*\n"
        f"{format_idr(rule['amount'])} • {rule['category_name']}",
        parse_mode="Markdown",
    )


@router.callback_query(F.data.startswith("recskip:"))
async def cb_recurring_skip(cb: CallbackQuery) -> None:
    """User menekan 'Nanti' → tidak dicatat, tutup tombol."""
    if not isinstance(cb.message, Message):
        await cb.answer()
        return
    await cb.answer("Oke, dilewati.")
    await cb.message.edit_text(
        (cb.message.text or "Pengingat") + "\n\n_⏭ Dilewati._",
        parse_mode="Markdown",
    )


# ══════════════════════════════════════════════════════════════════════════════
#  /add_recurring — hybrid: one-shot kalau argumen lengkap, FSM kalau tidak
#  Format one-shot: /add_recurring <nama> <kategori> <nominal> <tanggal> [mode]
# ══════════════════════════════════════════════════════════════════════════════

class AddRecurring(StatesGroup):
    waiting_desc     = State()
    waiting_category = State()
    waiting_amount   = State()
    waiting_day      = State()
    waiting_mode     = State()


def _parse_day(raw: str) -> int | None:
    raw = raw.strip()
    if raw.isdigit():
        d = int(raw)
        if 1 <= d <= 31:
            return d
    return None


async def _save_recurring(
    message: Message, member: dict, created_by: int,
    desc: str, category: str, amount: int, day: int, mode: str,
) -> None:
    await db.create_recurring({
        "tenant_id":     member["tenant_id"],
        "created_by":    created_by,
        "type":          "expense",
        "amount":        amount,
        "category_name": category,
        "description":   desc,
        "day_of_month":  day,
        "mode":          mode,
    })
    await message.answer(
        f"✅ *Aturan berulang tersimpan!*\n\n"
        f"Nama     : *{desc}*\n"
        f"Kategori : *{category}*\n"
        f"Nominal  : *{format_idr(amount)}*\n"
        f"Tanggal  : tiap tgl *{day}*\n"
        f"Mode     : {_mode_label(mode)}\n\n"
        f"Lihat semua: /recurring",
        parse_mode="Markdown",
    )


def _mode_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🤖 Otomatis", callback_data="recmode:auto"),
        InlineKeyboardButton(text="🔔 Ingatkan", callback_data="recmode:reminder"),
    ]])


@router.message(Command("add_recurring"))
async def cmd_add_recurring(message: Message, state: FSMContext) -> None:
    await state.clear()
    if not message.from_user:
        return
    member = await db.get_member_by_telegram_id(message.from_user.id)
    if not member:
        await message.answer("❗ Ketik /start dulu ya!")
        return

    parts = (message.text or "").split(maxsplit=1)
    args  = parts[1].strip() if len(parts) > 1 else ""

    # ── ONE-SHOT: <nama> <kategori> <nominal> <tanggal> [mode] ──────────────────
    # Nama & kategori bisa multi-kata → parse dari KANAN: mode?(opsional) day amount, sisa = nama+kategori.
    if args:
        toks = args.split()
        mode = "auto"
        if toks and toks[-1].lower() in ("auto", "reminder", "otomatis", "ingatkan"):
            last = toks.pop().lower()
            mode = "reminder" if last in ("reminder", "ingatkan") else "auto"
        # butuh minimal: nama, kategori, nominal, tanggal (>=4 token)
        if len(toks) >= 4:
            day    = _parse_day(toks[-1])
            amount = _parse_amount(toks[-2])
            # sisa = nama + kategori; coba pisahkan kategori dari kanan (greedy 1-3 kata)
            head = toks[:-2]
            category, desc = None, None
            for take in (3, 2, 1):
                if len(head) > take:
                    cand = match_category(" ".join(head[-take:]))
                    if cand:
                        category = cand
                        desc = " ".join(head[:-take])
                        break
            if category and desc and amount and amount > 0 and day:
                await _save_recurring(message, member, message.from_user.id,
                                      desc, category, amount, day, mode)
                return
        await message.answer(
            "⚠️ Format one-shot kurang pas. Contoh:\n"
            "`/add_recurring Netflix Hiburan 55rb 5`\n"
            "`/add_recurring Listrik PLN Rumah & Tagihan 350rb 20 reminder`\n\n"
            "Aku pandu langkah demi langkah ya 👇",
            parse_mode="Markdown",
        )

    await state.set_state(AddRecurring.waiting_desc)
    await message.answer(
        "🔁 *Tambah Tagihan Berulang*\n\n"
        "Nama tagihan/langganannya apa? (mis. `Netflix`, `Listrik PLN`)\n\n"
        "_Ketik /batal untuk membatalkan._",
        parse_mode="Markdown",
    )


@router.message(Command("batal"), StateFilter(AddRecurring))
async def cancel_add_recurring(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("❌ Dibatalkan. Tidak ada aturan yang dibuat.")


@router.message(StateFilter(AddRecurring.waiting_desc), F.text)
async def ar_got_desc(message: Message, state: FSMContext) -> None:
    desc = (message.text or "").strip()
    if len(desc) < 2:
        await message.answer("⚠️ Nama terlalu pendek. Ketik nama tagihannya:")
        return
    await state.update_data(desc=desc)
    await state.set_state(AddRecurring.waiting_category)
    await message.answer(
        f"Oke, *{desc}*.\n\nMasuk kategori apa? Ketik namanya:\n\n{_category_menu()}",
        parse_mode="Markdown",
    )


@router.message(StateFilter(AddRecurring.waiting_category), F.text)
async def ar_got_category(message: Message, state: FSMContext) -> None:
    category = match_category(message.text or "")
    if not category:
        await message.answer(
            f"⚠️ Kategori tidak dikenali. Pilih salah satu:\n\n{_category_menu()}",
            parse_mode="Markdown",
        )
        return
    await state.update_data(category=category)
    await state.set_state(AddRecurring.waiting_amount)
    await message.answer(
        f"Kategori *{category}*. Sekarang nominalnya (mis. `55rb`, `1jt`):",
        parse_mode="Markdown",
    )


@router.message(StateFilter(AddRecurring.waiting_amount), F.text)
async def ar_got_amount(message: Message, state: FSMContext) -> None:
    amount = _parse_amount(message.text or "")
    if not amount or amount <= 0:
        await message.answer("⚠️ Nominal tidak valid. Ketik angka > 0, mis. `55rb`, `1jt`:")
        return
    await state.update_data(amount=amount)
    await state.set_state(AddRecurring.waiting_day)
    await message.answer("Tiap tanggal berapa ditagih? (1–31):")


@router.message(StateFilter(AddRecurring.waiting_day), F.text)
async def ar_got_day(message: Message, state: FSMContext) -> None:
    day = _parse_day(message.text or "")
    if not day:
        await message.answer("⚠️ Tanggal harus angka 1–31. Coba lagi:")
        return
    await state.update_data(day=day)
    await state.set_state(AddRecurring.waiting_mode)
    await message.answer(
        "Terakhir, pilih mode:\n\n"
        "🤖 *Otomatis* — langsung dicatat tiap jatuh tempo\n"
        "🔔 *Ingatkan* — bot tanya dulu, kamu konfirmasi",
        parse_mode="Markdown",
        reply_markup=_mode_kb(),
    )


@router.callback_query(F.data.startswith("recmode:"), StateFilter(AddRecurring.waiting_mode))
async def ar_got_mode(cb: CallbackQuery, state: FSMContext) -> None:
    if not cb.data or not cb.from_user or not isinstance(cb.message, Message):
        return
    mode   = cb.data.split(":", 1)[1]
    data   = await state.get_data()
    member = await db.get_member_by_telegram_id(cb.from_user.id)
    await state.clear()
    await cb.answer()
    if not member:
        await cb.message.answer("❗ Ketik /start dulu ya!")
        return
    await _save_recurring(cb.message, member, cb.from_user.id,
                          data["desc"], data["category"], data["amount"], data["day"], mode)
