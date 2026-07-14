"""
Handler: /hubungkan_grup — ikat grup Telegram ⇄ workspace keluarga.

Dijalankan DI DALAM grup oleh admin tenant. Menyimpan chat_id grup ke
tenants.group_chat_id supaya scheduler bisa broadcast rekap harian ke grup.

Perintah:
  /hubungkan_grup  → ikat grup ini ke workspace admin yang menjalankan.
  /lepas_grup      → lepaskan grup ini dari workspace.
  /status_grup     → cek status koneksi grup ↔ workspace.
"""
from aiogram import Router
from aiogram.types import Message
from aiogram.filters import Command

from services.supabase_service import SupabaseService

router = Router()
db = SupabaseService()

# Jenis chat yang dianggap "grup"
_GROUP_TYPES = {"group", "supergroup"}


def _is_group(message: Message) -> bool:
    return bool(message.chat) and message.chat.type in _GROUP_TYPES


@router.message(Command("hubungkan_grup"))
async def cmd_hubungkan_grup(message: Message) -> None:
    if not message.from_user:
        return

    # Harus dijalankan di dalam grup, bukan chat pribadi
    if not _is_group(message):
        await message.answer(
            "👥 Perintah ini dijalankan *di dalam grup keluarga*, bukan chat pribadi.\n\n"
            "1. Tambahkan bot ke grup Telegram keluargamu.\n"
            "2. Ketik `/hubungkan_grup` di dalam grup itu.\n"
            "Nanti rekap harian otomatis dikirim ke grup. 🎉",
            parse_mode="Markdown",
        )
        return

    tg_id = message.from_user.id
    member = await db.get_member_by_telegram_id(tg_id)
    if not member:
        await message.answer(
            "❌ Kamu belum punya workspace keluarga.\n"
            "Chat bot secara pribadi lalu ketik /start dulu untuk buat / gabung workspace."
        )
        return

    # Hanya admin yang boleh mengikat grup
    if member.get("role") != "admin":
        await message.answer("🔒 Hanya *admin* keluarga yang bisa menghubungkan grup ini.", parse_mode="Markdown")
        return

    group_chat_id = message.chat.id
    group_title   = message.chat.title

    # Grup ini sudah terikat ke tenant lain?
    existing = await db.get_tenant_by_group_chat(group_chat_id)
    if existing and existing["id"] != member["tenant_id"]:
        await message.answer(
            "⚠️ Grup ini sudah terhubung ke workspace keluarga lain.\n"
            "Lepaskan dulu dari sana (`/lepas_grup`) sebelum menghubungkan ke sini.",
            parse_mode="Markdown",
        )
        return
    if existing and existing["id"] == member["tenant_id"]:
        await message.answer("✅ Grup ini *sudah* terhubung ke workspace keluargamu. Rekap harian aktif. 🎉", parse_mode="Markdown")
        return

    await db.set_tenant_group_chat(member["tenant_id"], group_chat_id, group_title)

    tenant = await db.get_tenant(member["tenant_id"]) or {}
    hour   = tenant.get("group_recap_hour", 21)
    await message.answer(
        f"✅ Grup *{group_title or 'ini'}* berhasil terhubung ke workspace "
        f"*{tenant.get('name', 'keluargamu')}*! 🎉\n\n"
        f"📊 Setiap hari pukul *{hour:02d}:00 WIB* bot akan kirim rekap pemasukan & "
        f"pengeluaran keluarga ke grup ini.\n\n"
        f"Mau matikan? Ketik `/lepas_grup`.",
        parse_mode="Markdown",
    )


@router.message(Command("lepas_grup"))
async def cmd_lepas_grup(message: Message) -> None:
    if not message.from_user:
        return
    if not _is_group(message):
        await message.answer("👥 Jalankan `/lepas_grup` di dalam grup yang mau dilepas.", parse_mode="Markdown")
        return

    tg_id = message.from_user.id
    member = await db.get_member_by_telegram_id(tg_id)
    if not member:
        await message.answer("❌ Kamu belum punya workspace keluarga.")
        return
    if member.get("role") != "admin":
        await message.answer("🔒 Hanya *admin* keluarga yang bisa melepas grup.", parse_mode="Markdown")
        return

    existing = await db.get_tenant_by_group_chat(message.chat.id)
    if not existing or existing["id"] != member["tenant_id"]:
        await message.answer("ℹ️ Grup ini belum terhubung ke workspace keluargamu.")
        return

    await db.unset_tenant_group_chat(member["tenant_id"])
    await message.answer("✅ Grup ini sudah dilepas. Rekap harian tidak akan dikirim ke sini lagi.")


@router.message(Command("status_grup"))
async def cmd_status_grup(message: Message) -> None:
    if not message.from_user:
        return
    if not _is_group(message):
        await message.answer("👥 Jalankan `/status_grup` di dalam grup keluarga.", parse_mode="Markdown")
        return

    existing = await db.get_tenant_by_group_chat(message.chat.id)
    if not existing:
        await message.answer(
            "🔌 Grup ini *belum* terhubung ke workspace mana pun.\n"
            "Admin keluarga bisa ketik `/hubungkan_grup` untuk mengaktifkan rekap harian.",
            parse_mode="Markdown",
        )
        return

    hour   = existing.get("group_recap_hour", 21)
    active = existing.get("group_daily_recap", True)
    status = f"aktif (setiap {hour:02d}:00 WIB)" if active else "dimatikan sementara"
    await message.answer(
        f"✅ Grup ini terhubung ke workspace *{existing.get('name', 'keluarga')}*.\n"
        f"📊 Rekap harian: *{status}*.",
        parse_mode="Markdown",
    )
