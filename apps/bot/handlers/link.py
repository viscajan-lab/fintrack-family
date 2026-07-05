"""
Handler: /hubungkan — sambungkan akun bot Telegram ⇄ web (dua arah)

Dua mode, cerminan dari server actions web (dashboard/link/actions.ts):

  1. /hubungkan <kode>   → BOT KLAIM kode 'web_to_bot'.
       Web sudah bikin kode berisi user_id (auth.users web). Bot ambil kode itu,
       lalu ISI user_id tsb ke baris tenant_members milik telegram user ini.
       Efeknya: akun web ikut ke tenant/keluarga si user bot.

  2. /hubungkan          → BOT GENERATE kode 'bot_to_web'.
       Bot bikin kode berisi telegram_id + tenant_id user ini. User lalu input
       kode itu di web (menu Hubungkan) → akun web gabung ke keluarga ini.
"""
import random
from datetime import datetime, timedelta, timezone

from aiogram import Router
from aiogram.types import Message
from aiogram.filters import Command, CommandObject

from services.supabase_service import SupabaseService

router = Router()
db = SupabaseService()

CODE_TTL_MINUTES = 15


def _gen_code() -> str:
    """6 digit, 100000–999999 (tanpa masalah leading-zero)."""
    return str(random.randint(100000, 999999))


def _is_expired(expires_at: str) -> bool:
    """expires_at ISO string dari DB → cek lewat waktu atau belum (UTC)."""
    try:
        exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return exp < datetime.now(timezone.utc)
    except Exception:
        return True


@router.message(Command("hubungkan"))
async def cmd_hubungkan(message: Message, command: CommandObject) -> None:
    if not message.from_user:
        return
    tg_id = message.from_user.id
    arg   = (command.args or "").strip()

    # User bot HARUS sudah punya workspace (tenant) dulu
    member = await db.get_member_by_telegram_id(tg_id)
    if not member:
        await message.answer(
            "❌ Kamu belum punya workspace keluarga.\n"
            "Ketik /start dulu untuk buat / gabung workspace, baru bisa hubungkan akun web.",
        )
        return

    # ── Mode 1: /hubungkan <kode> → klaim kode dari WEB (web_to_bot) ──────────
    if arg:
        if not (arg.isdigit() and len(arg) == 6):
            await message.answer("❌ Format kode salah. Kode terdiri dari 6 digit angka.\nContoh: `/hubungkan 123456`", parse_mode="Markdown")
            return

        link = await db.get_active_link_code(arg, direction="web_to_bot")
        if not link:
            await message.answer("❌ Kode tidak ditemukan atau sudah dipakai. Coba buat kode baru di web.")
            return
        if _is_expired(link["expires_at"]):
            await message.answer("⏰ Kode sudah kadaluarsa. Buat kode baru di web ya.")
            return

        web_user_id = link.get("user_id")
        if not web_user_id:
            await message.answer("❌ Kode tidak valid (user web kosong).")
            return

        # Baris member telegram ini sudah dipakai user web lain?
        if member.get("user_id") and member["user_id"] != web_user_id:
            await message.answer("⚠️ Akun Telegram ini sudah tersambung ke akun web lain.")
            return

        # ISI user_id web ke baris tenant_members milik telegram ini
        await db.update_member_user_id(member["id"], web_user_id)
        await db.claim_link_code(link["id"])

        tenant = await db.get_tenant(member["tenant_id"]) or {}
        await message.answer(
            f"✅ Berhasil! Akun web kamu sekarang tersambung ke workspace "
            f"*{tenant.get('name', 'keluargamu')}*. 🎉\n\n"
            f"Data transaksi bot & web sekarang satu keluarga.",
            parse_mode="Markdown",
        )
        return

    # ── Mode 2: /hubungkan (tanpa arg) → generate kode untuk WEB (bot_to_web) ─
    # Bersihkan kode lama yang belum diklaim biar cuma 1 kode aktif
    await db.delete_unclaimed_codes(direction="bot_to_web", telegram_id=tg_id)

    code = None
    for _ in range(5):
        candidate  = _gen_code()
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=CODE_TTL_MINUTES)).isoformat()
        try:
            await db.create_link_code(
                code=candidate,
                direction="bot_to_web",
                expires_at=expires_at,
                telegram_id=tg_id,
                tenant_id=member["tenant_id"],
            )
            code = candidate
            break
        except Exception as e:
            # tabrakan UNIQUE code → coba lagi; error lain → stop
            if "duplicate" in str(e).lower() or "23505" in str(e):
                continue
            await message.answer(f"❌ Gagal membuat kode: {e}")
            return

    if not code:
        await message.answer("❌ Gagal membuat kode unik, coba lagi sebentar.")
        return

    await message.answer(
        f"🔗 *Kode hubungkan akun web:*\n\n"
        f"`{code}`\n\n"
        f"Buka web FinTrack → menu *Hubungkan* → tempel kode ini di kolom *Bot → Web*.\n"
        f"Kode berlaku {CODE_TTL_MINUTES} menit.",
        parse_mode="Markdown",
    )
