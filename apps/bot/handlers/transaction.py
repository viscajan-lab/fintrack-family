"""
Handler: input transaksi natural language
Contoh: "Makan siang 35000", "Bensin 50rb", "Gaji Juli 8.5jt"
"""
from aiogram import Router, F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from services.nlp_parser import parse_transaction
from services.supabase_service import SupabaseService

router = Router()
db = SupabaseService()


class TransactionStates(StatesGroup):
    confirming = State()


def format_idr(amount: int) -> str:
    """Format integer ke Rp 1.250.000"""
    return f"Rp {amount:,.0f}".replace(",", ".")


def confirm_keyboard(tx_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="✅ Simpan",  callback_data=f"tx_save:{tx_id}"),
        InlineKeyboardButton(text="✏️ Edit",    callback_data=f"tx_edit:{tx_id}"),
        InlineKeyboardButton(text="❌ Batal",   callback_data=f"tx_cancel:{tx_id}"),
    ]])


# ── Tangkap pesan teks yang bukan command ─────────────────────────────────────
@router.message(F.text & ~F.text.startswith("/"))
async def handle_text_input(message: Message, state: FSMContext) -> None:
    tg_id = message.from_user.id
    text  = message.text.strip()

    # Jangan proses kalau ada FSM state aktif (misal: lagi setup keluarga)
    current_state = await state.get_state()
    if current_state is not None:
        return

    # Pastikan user sudah terdaftar
    member = await db.get_member_by_telegram_id(tg_id)
    if not member:
        await message.answer(
            "❗ Kamu belum terdaftar. Ketik /start untuk setup dulu ya!"
        )
        return

    # Parse input
    result = await parse_transaction(text)
    if not result:
        await message.answer(
            "🤔 Aku tidak bisa memahami inputmu.\n\n"
            "Coba format seperti ini:\n"
            "• `Makan siang 35000`\n"
            "• `Bensin 50rb`\n"
            "• `Gaji 8jt`",
            parse_mode="Markdown"
        )
        return

    # Simpan draft ke FSM state untuk konfirmasi
    await state.update_data(
        draft={
            **result,
            "tenant_id":   member["tenant_id"],
            "recorded_by": member["user_id"],
        }
    )
    await state.set_state(TransactionStates.confirming)

    icon = "📥" if result["type"] == "income" else "📤"
    await message.answer(
        f"{icon} *Konfirmasi Transaksi*\n\n"
        f"Jenis      : {'Pemasukan' if result['type'] == 'income' else 'Pengeluaran'}\n"
        f"Nominal    : *{format_idr(result['amount'])}*\n"
        f"Keterangan : {result['description']}\n"
        f"Kategori   : {result['category_name']}\n\n"
        f"Simpan transaksi ini?",
        parse_mode="Markdown",
        reply_markup=confirm_keyboard("draft")
    )


# ── Callback: tombol Simpan ───────────────────────────────────────────────────
@router.callback_query(F.data.startswith("tx_save:"))
async def cb_save(callback: CallbackQuery, state: FSMContext) -> None:
    data  = await state.get_data()
    draft = data.get("draft")

    if not draft:
        await callback.answer("Session expired, coba input lagi.")
        await state.clear()
        return

    tx = await db.create_transaction(draft)
    await state.clear()

    icon = "📥" if draft["type"] == "income" else "📤"
    await callback.message.edit_text(
        f"{icon} *Tersimpan!*\n\n"
        f"*{format_idr(draft['amount'])}* — {draft['description']}\n"
        f"Kategori: {draft['category_name']}",
        parse_mode="Markdown"
    )
    await callback.answer("✅ Transaksi disimpan!")


# ── Callback: tombol Batal ────────────────────────────────────────────────────
@router.callback_query(F.data.startswith("tx_cancel:"))
async def cb_cancel(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await callback.message.edit_text("❌ Transaksi dibatalkan.")
    await callback.answer()
