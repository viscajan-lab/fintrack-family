"""
Handler: /reminder [HH:MM]  — set jam pengingat harian catat pengeluaran (WIB)
Handler: /reminder_off      — matikan pengingat harian

Jam disimpan dalam WIB (Asia/Jakarta). Scheduler (services/scheduler.py) yang
mengirim notif tiap menit saat jam WIB user tercapai.

Semua balasan pakai parse_mode="HTML" (hindari TelegramBadRequest dari _ * [).
"""
import re

from aiogram import Router
from aiogram.types import Message
from aiogram.filters import Command, CommandObject

from services.supabase_service import SupabaseService
from services.waktu import now_wib

router = Router()
db = SupabaseService()

# Terima "21:00", "21.00", "21", "9:5", "09:05" → jam & menit
_TIME_RE = re.compile(r"^\s*(\d{1,2})(?:[:.](\d{1,2}))?\s*$")


def _parse_time(arg: str) -> tuple[int, int] | None:
    m = _TIME_RE.match(arg or "")
    if not m:
        return None
    hh = int(m.group(1))
    mm = int(m.group(2)) if m.group(2) is not None else 0
    if not (0 <= hh <= 23 and 0 <= mm <= 59):
        return None
    return hh, mm


def _status_text(member: dict) -> str:
    hh = member.get("reminder_hour")
    if hh is None:
        now = now_wib()
        return (
            "🔕 <b>Pengingat harian: mati</b>\n\n"
            "Aktifkan biar nggak lupa catat pengeluaran tiap hari:\n"
            "<code>/reminder 21:00</code>  (jam bebas, WIB)\n\n"
            f"🕒 Sekarang {now:%H:%M} WIB"
        )
    mm = member.get("reminder_minute", 0)
    return (
        "🔔 <b>Pengingat harian: aktif</b>\n\n"
        f"Kamu diingatkan tiap hari jam <b>{hh:02d}:{mm:02d} WIB</b>.\n\n"
        "Ubah jam: <code>/reminder 20:30</code>\n"
        "Matikan:  /reminder_off"
    )


@router.message(Command("reminder"))
async def cmd_reminder(message: Message, command: CommandObject) -> None:
    if not message.from_user:
        return
    member = await db.get_member_by_telegram_id(message.from_user.id)
    if not member:
        await message.answer("❗ Ketik /start dulu ya!", parse_mode="HTML")
        return

    arg = (command.args or "").strip()

    # Tanpa argumen → tampilkan status + cara pakai
    if not arg:
        await message.answer(_status_text(member), parse_mode="HTML")
        return

    parsed = _parse_time(arg)
    if not parsed:
        await message.answer(
            "❌ Format jam nggak valid.\n\n"
            "Contoh yang benar:\n"
            "<code>/reminder 21:00</code>\n"
            "<code>/reminder 8:30</code>\n\n"
            "Jam 0–23, menit 0–59 (WIB).",
            parse_mode="HTML",
        )
        return

    hh, mm = parsed
    await db.set_reminder(message.from_user.id, hh, mm)
    await message.answer(
        "✅ <b>Pengingat harian aktif!</b>\n\n"
        f"Tiap hari jam <b>{hh:02d}:{mm:02d} WIB</b> aku ingatkan buat catat "
        "pengeluaran. 🙌\n\n"
        "Matikan kapan aja: /reminder_off",
        parse_mode="HTML",
    )


@router.message(Command("reminder_off"))
async def cmd_reminder_off(message: Message) -> None:
    if not message.from_user:
        return
    member = await db.get_member_by_telegram_id(message.from_user.id)
    if not member:
        await message.answer("❗ Ketik /start dulu ya!", parse_mode="HTML")
        return

    if member.get("reminder_hour") is None:
        await message.answer(
            "🔕 Pengingat harian kamu memang belum aktif.\n\n"
            "Aktifkan: <code>/reminder 21:00</code>",
            parse_mode="HTML",
        )
        return

    await db.clear_reminder(message.from_user.id)
    await message.answer(
        "🔕 <b>Pengingat harian dimatikan.</b>\n\n"
        "Aktifkan lagi kapan aja: <code>/reminder 21:00</code>",
        parse_mode="HTML",
    )
