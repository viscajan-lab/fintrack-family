"""
Handler: input transaksi natural language
Contoh: "Makan siang 35000", "Bensin 50rb", "Gaji Juli 8.5jt"
"""
from aiogram import Router, F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery
from aiogram.filters import Command, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from services.nlp_parser import parse_transaction, parse_receipt_image
from services.supabase_service import SupabaseService

router = Router()
db = SupabaseService()


class TransactionStates(StatesGroup):
    confirming = State()
    editing    = State()


def format_idr(amount: int) -> str:
    return f"Rp {amount:,.0f}".replace(",", ".")


def build_budget_warning(status: dict, just_added: int) -> str | None:
    """
    Bangun pesan peringatan budget berdasarkan status kategori.

    `status` = hasil db.get_budget_status_for_category (sudah termasuk transaksi baru
               kalau view realtime; kalau tidak, kita amankan dgn just_added di caller).
    `just_added` = nominal pengeluaran yang baru saja dicatat (untuk konteks pesan).

    Return None kalau masih < 70% (aman, tak perlu ganggu).
    Ambang: 🟡 70% · 🔴 90% · 🚨 >100%.
    """
    limit     = status["limit"]
    spent     = status["spent"]
    remaining = status["remaining"]
    ratio     = status["ratio"]
    cat       = status["category_name"]
    pct       = round(ratio * 100)

    if ratio > 1.0:
        over = spent - limit
        return (
            f"🚨 *BUDGET JEBOL!*\n\n"
            f"Kategori *{cat}* sudah lewat budget bulan ini.\n"
            f"Terpakai: *{format_idr(spent)}* / {format_idr(limit)}\n"
            f"Kelebihan: *{format_idr(over)}* ({pct}%)\n\n"
            f"_Mungkin perlu rem pengeluaran di kategori ini ya._"
        )
    if ratio >= 0.90:
        return (
            f"🔴 *Budget Hampir Habis!*\n\n"
            f"Kategori *{cat}* sudah *{pct}%* terpakai.\n"
            f"Terpakai: {format_idr(spent)} / {format_idr(limit)}\n"
            f"Sisa: *{format_idr(remaining)}* aja nih.\n\n"
            f"_Hati-hati, tinggal dikit lagi._"
        )
    if ratio >= 0.70:
        return (
            f"🟡 *Perhatian Budget*\n\n"
            f"Kategori *{cat}* sudah *{pct}%* terpakai.\n"
            f"Terpakai: {format_idr(spent)} / {format_idr(limit)}\n"
            f"Sisa: *{format_idr(remaining)}*."
        )
    return None


def confirm_keyboard(tx_id: str, tx_type: str = "expense", member_name: str | None = None) -> InlineKeyboardMarkup:
    # Tombol toggle: tunjukkan arah GANTI, bukan tipe saat ini (biar jelas 1-tap mau ke apa).
    toggle = "🔄 Jadikan Pemasukan 📥" if tx_type == "expense" else "🔄 Jadikan Pengeluaran 📤"
    member_btn = f"👤 Untuk: {member_name}" if member_name else "👤 Pilih Anggota"
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=toggle, callback_data=f"tx_type:{tx_id}")],
        [InlineKeyboardButton(text=member_btn, callback_data=f"tx_member:{tx_id}")],
        [
            InlineKeyboardButton(text="✅ Simpan",  callback_data=f"tx_save:{tx_id}"),
            InlineKeyboardButton(text="✏️ Edit",    callback_data=f"tx_edit:{tx_id}"),
            InlineKeyboardButton(text="❌ Batal",   callback_data=f"tx_cancel:{tx_id}"),
        ],
    ])


def delete_keyboard(tx_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🗑 Hapus Transaksi", callback_data=f"tx_delete:{tx_id}"),
    ]])


def confirm_text(result: dict) -> str:
    """Bangun teks konfirmasi transaksi (dipakai handler teks & nota)."""
    icon = "📥" if result["type"] == "income" else "📤"
    member_line = ""
    if result.get("member_name"):
        member_line = f"Untuk      : {result['member_name']}\n"
    return (
        f"{icon} *Konfirmasi Transaksi*\n\n"
        f"Jenis      : {'Pemasukan' if result['type'] == 'income' else 'Pengeluaran'}\n"
        f"Nominal    : *{format_idr(result['amount'])}*\n"
        f"Keterangan : {result['description']}\n"
        f"Kategori   : {result['category_name']}\n"
        f"{member_line}\n"
        f"Simpan transaksi ini?"
    )


async def _stage_draft(result: dict, member: dict, message: Message, state: FSMContext) -> None:
    """Simpan draft ke FSM + kirim kartu konfirmasi. Dipakai teks & nota."""
    # Default anggota = si pencatat sendiri (tenant_members.id + display_name).
    draft = {
        **result,
        "tenant_id":   member["tenant_id"],
        "recorded_by": member.get("user_id"),
        "member_id":   member.get("id"),
        "member_name": member.get("display_name"),
    }
    await state.update_data(draft=draft)
    await state.set_state(TransactionStates.confirming)
    await message.answer(
        confirm_text(draft),
        parse_mode="Markdown",
        reply_markup=confirm_keyboard("draft", draft["type"], draft.get("member_name")),
    )


# ── Tangkap pesan teks yang bukan command ─────────────────────────────────────
@router.message(F.text & ~F.text.startswith("/"))
async def handle_text_input(message: Message, state: FSMContext) -> None:
    tg_id = message.from_user.id
    text  = message.text.strip()  # type: ignore[union-attr]

    # Jangan proses kalau ada FSM state aktif (misal: lagi setup keluarga)
    if await state.get_state() is not None:
        return

    member = await db.get_member_by_telegram_id(tg_id)
    if not member:
        await message.answer("❗ Kamu belum terdaftar. Ketik /start untuk setup dulu ya!")
        return

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

    await _stage_draft(result, member, message, state)


# ── Tangkap foto nota/struk → OCR vision ──────────────────────────────────────
@router.message(F.photo)
async def handle_receipt_photo(message: Message, state: FSMContext) -> None:
    tg_id = message.from_user.id  # type: ignore[union-attr]

    # Jangan ganggu kalau ada FSM state aktif (setup keluarga, dll)
    if await state.get_state() is not None:
        return

    member = await db.get_member_by_telegram_id(tg_id)
    if not member:
        await message.answer("❗ Kamu belum terdaftar. Ketik /start untuk setup dulu ya!")
        return

    thinking = await message.answer("🧾 Lagi baca notanya, tunggu sebentar ya...")

    # Ambil foto resolusi tertinggi (photo[-1]) → download ke memory
    from io import BytesIO
    photo = message.photo[-1]  # type: ignore[index]
    buf = BytesIO()
    await message.bot.download(photo, destination=buf)  # type: ignore[union-attr]

    result = await parse_receipt_image(buf.getvalue())
    if not result:
        await thinking.edit_text(
            "🤔 Aku tidak bisa membaca nota ini.\n\n"
            "Pastikan fotonya jelas & seluruh struk terlihat, atau catat manual:\n"
            "• `Belanja 150rb`",
            parse_mode="Markdown",
        )
        return

    await thinking.delete()
    await _stage_draft(result, member, message, state)


# ── Callback: Simpan ──────────────────────────────────────────────────────────
@router.callback_query(F.data.startswith("tx_save:"))
async def cb_save(callback: CallbackQuery, state: FSMContext) -> None:
    data  = await state.get_data()
    draft = data.get("draft")
    if not draft:
        await callback.answer("Session expired, coba input lagi.")
        await state.clear()
        return

    # `member_name` cuma buat tampilan kartu — BUKAN kolom di tabel transactions.
    # Wajib dibuang sebelum insert biar Supabase gak nolak (unknown column).
    insert_payload = {k: v for k, v in draft.items() if k != "member_name"}
    tx = await db.create_transaction(insert_payload)
    await state.clear()

    icon = "📥" if draft["type"] == "income" else "📤"
    if callback.message:
        member_line = f"\nUntuk: {draft['member_name']}" if draft.get("member_name") else ""
        await callback.message.edit_text(  # type: ignore[union-attr]
            f"{icon} *Tersimpan!*\n\n"
            f"*{format_idr(draft['amount'])}* — {draft['description']}\n"
            f"Kategori: {draft['category_name']}{member_line}",
            parse_mode="Markdown",
            reply_markup=delete_keyboard(tx["id"]),
        )
    await callback.answer("✅ Transaksi disimpan!")

    # ── Auto-warning budget (hanya untuk pengeluaran) ────────────────────────
    # Best-effort: kalau gagal, transaksi tetap tersimpan (tidak boleh bikin crash).
    if draft["type"] == "expense":
        try:
            from datetime import date as _date
            today = _date.today()
            status = await db.get_budget_status_for_category(
                tenant_id=draft["tenant_id"],
                category_name=draft["category_name"],
                month=today.month,
                year=today.year,
            )
            if status:
                # Amankan bila view telat refresh: pastikan transaksi baru ikut terhitung.
                # Kalau `spent` ternyata belum memasukkan nominal ini, tambahkan manual.
                just_added = int(draft["amount"])
                if status["spent"] < just_added:
                    status["spent"]     += just_added
                    status["remaining"]  = status["limit"] - status["spent"]
                    status["ratio"]      = status["spent"] / status["limit"]

                warning = build_budget_warning(status, just_added)
                if warning and callback.message:
                    await callback.message.answer(warning, parse_mode="Markdown")  # type: ignore[union-attr]
        except Exception as e:  # noqa: BLE001
            import logging
            logging.getLogger(__name__).warning("Budget check gagal (diabaikan): %s", e)


# ── Callback: Toggle Pemasukan ⇄ Pengeluaran ─────────────────────────────────
@router.callback_query(F.data.startswith("tx_type:"))
async def cb_toggle_type(callback: CallbackQuery, state: FSMContext) -> None:
    data  = await state.get_data()
    draft = data.get("draft")
    if not draft:
        await callback.answer("Session expired, coba input lagi.")
        await state.clear()
        return

    draft["type"] = "income" if draft["type"] == "expense" else "expense"
    await state.update_data(draft=draft)

    if callback.message:
        await callback.message.edit_text(  # type: ignore[union-attr]
            confirm_text(draft),
            parse_mode="Markdown",
            reply_markup=confirm_keyboard("draft", draft["type"], draft.get("member_name")),
        )
    await callback.answer(
        "📥 Diubah jadi Pemasukan" if draft["type"] == "income" else "📤 Diubah jadi Pengeluaran"
    )


# ── Callback: Buka pemilih anggota ───────────────────────────────────────────
def member_picker_keyboard(members: list[dict], current_id: str | None) -> InlineKeyboardMarkup:
    """Daftar anggota tenant sebagai tombol. Anggota terpilih ditandai ✅."""
    rows = []
    for m in members:
        mark = "✅ " if m["id"] == current_id else ""
        icon = "👑" if m.get("role") == "admin" else "👤"
        rows.append([InlineKeyboardButton(
            text=f"{mark}{icon} {m['display_name']}",
            callback_data=f"tx_setmember:{m['id']}",
        )])
    rows.append([InlineKeyboardButton(text="⬅️ Kembali", callback_data="tx_backcard:draft")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


@router.callback_query(F.data.startswith("tx_member:"))
async def cb_member_picker(callback: CallbackQuery, state: FSMContext) -> None:
    data  = await state.get_data()
    draft = data.get("draft")
    if not draft:
        await callback.answer("Sesi habis, coba input lagi.")
        await state.clear()
        return

    members = await db.get_tenant_members(draft["tenant_id"])
    if not members:
        await callback.answer("Belum ada anggota lain.", show_alert=True)
        return

    if callback.message:
        await callback.message.edit_text(  # type: ignore[union-attr]
            "👥 *Transaksi ini untuk siapa?*\n\n"
            "Pilih anggota yang jatah/kantongnya dipakai:",
            parse_mode="Markdown",
            reply_markup=member_picker_keyboard(members, draft.get("member_id")),
        )
    await callback.answer()


# ── Callback: Set anggota terpilih → balik ke kartu konfirmasi ───────────────
@router.callback_query(F.data.startswith("tx_setmember:"))
async def cb_set_member(callback: CallbackQuery, state: FSMContext) -> None:
    data  = await state.get_data()
    draft = data.get("draft")
    if not draft:
        await callback.answer("Sesi habis, coba input lagi.")
        await state.clear()
        return

    member_id = callback.data.split(":", 1)[1]  # type: ignore[union-attr]
    members   = await db.get_tenant_members(draft["tenant_id"])
    chosen    = next((m for m in members if m["id"] == member_id), None)
    if not chosen:
        await callback.answer("Anggota tidak ditemukan.", show_alert=True)
        return

    draft["member_id"]   = chosen["id"]
    draft["member_name"] = chosen["display_name"]
    await state.update_data(draft=draft)

    if callback.message:
        await callback.message.edit_text(  # type: ignore[union-attr]
            confirm_text(draft),
            parse_mode="Markdown",
            reply_markup=confirm_keyboard("draft", draft["type"], draft.get("member_name")),
        )
    await callback.answer(f"👤 Untuk {chosen['display_name']}")


# ── Callback: Kembali ke kartu konfirmasi dari pemilih anggota ───────────────
@router.callback_query(F.data.startswith("tx_backcard:"))
async def cb_back_card(callback: CallbackQuery, state: FSMContext) -> None:
    data  = await state.get_data()
    draft = data.get("draft")
    if not draft:
        await callback.answer("Sesi habis, coba input lagi.")
        await state.clear()
        return

    if callback.message:
        await callback.message.edit_text(  # type: ignore[union-attr]
            confirm_text(draft),
            parse_mode="Markdown",
            reply_markup=confirm_keyboard("draft", draft["type"], draft.get("member_name")),
        )
    await callback.answer()


# ── Callback: Edit draft (ketik ulang) ───────────────────────────────────────
@router.callback_query(F.data.startswith("tx_edit:"))
async def cb_edit(callback: CallbackQuery, state: FSMContext) -> None:
    """
    User menekan ✏️ Edit di kartu konfirmasi DRAFT (sebelum disimpan).
    Bot minta user ketik ulang transaksinya → di-parse ulang → draft di-refresh
    → kartu konfirmasi tampil lagi. Reuse parse_transaction + _stage_draft.
    """
    data  = await state.get_data()
    draft = data.get("draft")
    if not draft:
        await callback.answer("Sesi habis, coba input lagi.")
        await state.clear()
        return

    await state.set_state(TransactionStates.editing)
    if callback.message:
        await callback.message.edit_text(  # type: ignore[union-attr]
            "✏️ *Edit Transaksi*\n\n"
            "Ketik ulang transaksinya ya, contoh:\n"
            "• `Makan siang 40rb`\n"
            "• `Bensin 60rb`\n\n"
            "_Ketik /batal untuk membatalkan edit._",
            parse_mode="Markdown",
        )
    await callback.answer("Ketik ulang transaksinya 👇")


@router.message(Command("batal"), StateFilter(TransactionStates.editing))
async def cancel_edit(message: Message, state: FSMContext) -> None:
    """Batalkan edit → kembalikan kartu konfirmasi dari draft yang tersimpan."""
    data  = await state.get_data()
    draft = data.get("draft")
    if not draft:
        await state.clear()
        await message.answer("❌ Edit dibatalkan.")
        return
    await state.set_state(TransactionStates.confirming)
    await message.answer(
        confirm_text(draft),
        parse_mode="Markdown",
        reply_markup=confirm_keyboard("draft", draft["type"], draft.get("member_name")),
    )


@router.message(StateFilter(TransactionStates.editing), F.text)
async def edit_got_text(message: Message, state: FSMContext) -> None:
    """Terima input baru saat mode edit → parse ulang → refresh draft + kartu."""
    text   = (message.text or "").strip()
    data   = await state.get_data()
    draft  = data.get("draft")
    if not draft:
        await state.clear()
        await message.answer("Sesi habis, coba input lagi ya.")
        return

    result = await parse_transaction(text)
    if not result:
        await message.answer(
            "🤔 Aku belum paham input barunya.\n\n"
            "Coba format seperti:\n"
            "• `Makan siang 35000`\n"
            "• `Bensin 50rb`\n\n"
            "_Atau /batal untuk kembali ke draft sebelumnya._",
            parse_mode="Markdown",
        )
        return

    # Refresh draft: pakai hasil parse baru + pertahankan tenant/recorded_by + anggota terpilih.
    new_draft = {
        **result,
        "tenant_id":   draft["tenant_id"],
        "recorded_by": draft.get("recorded_by"),
        "member_id":   draft.get("member_id"),
        "member_name": draft.get("member_name"),
    }
    await state.update_data(draft=new_draft)
    await state.set_state(TransactionStates.confirming)
    await message.answer(
        confirm_text(new_draft),
        parse_mode="Markdown",
        reply_markup=confirm_keyboard("draft", new_draft["type"], new_draft.get("member_name")),
    )


# ── Callback: Batal ───────────────────────────────────────────────────────────
@router.callback_query(F.data.startswith("tx_cancel:"))
async def cb_cancel(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    if callback.message:
        await callback.message.edit_text("❌ Transaksi dibatalkan.")  # type: ignore[union-attr]
    await callback.answer()


# ── Callback: Hapus transaksi yang sudah tersimpan (admin only) ───────────────
@router.callback_query(F.data.startswith("tx_delete:"))
async def cb_delete(callback: CallbackQuery) -> None:
    member = await db.get_member_by_telegram_id(callback.from_user.id)
    if not member:
        await callback.answer("❌ Akses ditolak.", show_alert=True)
        return

    # 🔒 role guard
    if member.get("role") != "admin":
        await callback.answer("❌ Hanya admin yang bisa menghapus transaksi.", show_alert=True)
        return

    tx_id   = callback.data.split(":", 1)[1]  # type: ignore[union-attr]
    deleted = await db.delete_transaction(tx_id, member["tenant_id"])
    if callback.message:
        if deleted:
            await callback.message.edit_text("🗑 *Transaksi dihapus.*", parse_mode="Markdown")  # type: ignore[union-attr]
            await callback.answer("✅ Dihapus!")
        else:
            await callback.answer("❌ Gagal menghapus transaksi.", show_alert=True)
