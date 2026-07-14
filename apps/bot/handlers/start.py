"""
Handler: /start — registrasi user & setup tenant (workspace keluarga)
"""
from aiogram import Router
from aiogram.types import Message
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
/tabungan — Target tabungan & progres
/nabung — Setor ke target tabungan
/target\\_baru — Buat target tabungan baru
/anggota — Kelola anggota keluarga
/insight — Analitik bulan ini vs bulan lalu
/tren — Tren tahunan (12 bulan)
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

    # ── Undangan tertarget: /start inv_<token> (sekali-pakai + expiry + role) ──
    if payload.startswith("inv_"):
        token = payload[4:]
        existing = await db.get_member_by_telegram_id(tg_id)
        if existing:
            await message.answer(
                "ℹ️ Kamu sudah terdaftar di sebuah workspace keluarga.",
                parse_mode="Markdown"
            )
            return
        invite = await db.get_invite_by_token(token)
        if not invite:
            await message.answer("❌ Undangan tidak valid atau sudah dipakai.")
            return
        # Cek kedaluwarsa (expires_at disimpan ISO UTC)
        from datetime import datetime, timezone
        try:
            exp = datetime.fromisoformat(invite["expires_at"].replace("Z", "+00:00"))
            if exp < datetime.now(timezone.utc):
                await message.answer("❌ Undangan sudah kedaluwarsa. Minta admin buat undangan baru ya.")
                return
        except (ValueError, KeyError, AttributeError):
            await message.answer("❌ Undangan tidak valid.")
            return
        tenant = await db.get_tenant(invite["tenant_id"])
        if not tenant:
            await message.answer("❌ Workspace tujuan undangan tidak ditemukan.")
            return
        role = "admin" if invite.get("role") == "admin" else "member"
        await db.create_member(
            tenant_id=invite["tenant_id"],
            telegram_id=tg_id,
            display_name=name,
            role=role,
        )
        await db.mark_invite_used(invite["id"], tg_id)
        role_label = "admin" if role == "admin" else "anggota"
        await message.answer(
            f"✅ Berhasil bergabung ke workspace *{tenant['name']}* sebagai *{role_label}*!\n\n"
            f"Sekarang kamu bisa mulai catat transaksi.\n"
            f"Ketik /help untuk panduan.",
            parse_mode="Markdown"
        )
        return

    if payload.startswith("join"):
        raw = payload[4:]
        # Format BARU: hex 32 char murni (kebal Markdown) → rekonstruksi UUID.
        # Format LAMA (link legacy): "_<uuid dgn '-' diganti '_'>".
        if raw.startswith("_"):
            tenant_id = raw[1:].replace("_", "-")
        else:
            h = raw.replace("_", "").replace("-", "")
            if len(h) == 32:
                tenant_id = f"{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"
            else:
                tenant_id = raw.replace("_", "-")

        existing = await db.get_member_by_telegram_id(tg_id)
        if existing:
            await message.answer(
                "ℹ️ Kamu sudah terdaftar di workspace keluarga ini.",
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
            f"✅ Berhasil bergabung ke workspace *{tenant['name']}*!\n\n"
            f"Sekarang kamu bisa mulai catat transaksi.\n"
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
