"""
Handler: /start — registrasi user & setup tenant (workspace keluarga)
"""
from aiogram import Router, F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import CommandStart, Command, CommandObject
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from services.supabase_service import SupabaseService

router = Router()
db = SupabaseService()


class SetupStates(StatesGroup):
    waiting_family_name = State()


WELCOME_NEW = """👋 Halo, {name}! Selamat datang di *FinTrack Family* 💰

Bot ini akan membantu kamu mencatat keuangan keluarga dengan mudah.
Cukup kirim pesan seperti:

📤 `Makan siang 35000`
📤 `Bensin 50rb`
📥 `Gaji Juli 8.5jt`

Dan bot akan mencatatnya otomatis! 🎉

Untuk mulai, aku perlu tahu nama keluargamu.
*Ketik nama keluarga kamu:* (contoh: Keluarga Budi)"""

WELCOME_BACK = """👋 Halo lagi, *{name}*! 

Kamu sudah terdaftar di workspace *{family}* ✅

Langsung catat transaksi ya — atau ketik /help untuk daftar perintah."""

HELP_TEXT = """📖 *Daftar Perintah FinTrack*

*Catat Transaksi:*
Cukup kirim pesan natural, contoh:
• `Makan siang 35000`
• `Bensin 50rb`
• `Belanja bulanan 500.000`
• `Gaji Juli 8jt`
• `Transfer dari Budi 200rb`

*Perintah:*
/rekap — Rekap hari ini
/rekap\\_bulan — Rekap bulan ini
/budget — Cek sisa budget
/anggota — Kelola anggota keluarga
/help — Bantuan ini

*Tips:*
• Nominal bisa: `35000`, `35rb`, `35k`, `3.5jt`
• Bot otomatis deteksi kategori & jenis transaksi"""


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext, command: CommandObject) -> None:
    tg_id = message.from_user.id
    name  = message.from_user.first_name

    # ── Deep-link invite: /start join_<tenant_id_with_underscores> ──
    payload = command.args or ""
    if payload.startswith("join_"):
        tenant_id = payload[5:].replace("_", "-")
        existing  = await db.get_member_by_telegram_id(tg_id)
        if existing:
            await message.answer(
                f"ℹ️ Kamu sudah terdaftar di workspace keluarga ini.",
                parse_mode="Markdown"
            )
            return
        tenant = await db.get_tenant(tenant_id)
        if not tenant:
            await message.answer("❌ Link undangan tidak valid atau sudah kadaluarsa.")
            return
        await db.create_member(
            tenant_id=tenant_id,
            telegram_id=tg_id,
            display_name=name,
            role="member",
        )
        await message.answer(
            f"✅ Berhasil bergabung ke workspace *{tenant['name']}*!\\n\\n"
            f"Sekarang kamu bisa mulai catat transaksi.\\n"
            f"Ketik /help untuk panduan.",
            parse_mode="Markdown"
        )
        return

    member = await db.get_member_by_telegram_id(tg_id)

    if member:
        tenant = await db.get_tenant(member["tenant_id"]) or {}
        await message.answer(
            WELCOME_BACK.format(name=name, family=tenant.get("name", "keluargamu")),
            parse_mode="Markdown"
        )
    else:
        await state.set_state(SetupStates.waiting_family_name)
        await message.answer(
            WELCOME_NEW.format(name=name),
            parse_mode="Markdown"
        )


@router.message(SetupStates.waiting_family_name)
async def handle_family_name(message: Message, state: FSMContext) -> None:
    family_name = message.text.strip()
    tg_id = message.from_user.id
    name  = message.from_user.first_name

    if len(family_name) < 3:
        await message.answer("❌ Nama keluarga minimal 3 karakter ya, coba lagi:")
        return

    # Buat tenant + member baru
    tenant = await db.create_tenant(family_name)
    await db.create_member(
        tenant_id=tenant["id"],
        telegram_id=tg_id,
        display_name=name,
        role="admin"
    )

    await state.clear()
    await message.answer(
        f"✅ Workspace *{family_name}* berhasil dibuat!\n\n"
        f"Sekarang kamu bisa mulai catat transaksi.\n"
        f"Contoh: `Makan siang 35000`\n\n"
        f"Ketik /help untuk daftar perintah lengkap.",
        parse_mode="Markdown"
    )


@router.message(Command("help"))
async def cmd_help(message: Message) -> None:
    await message.answer(HELP_TEXT, parse_mode="Markdown")
