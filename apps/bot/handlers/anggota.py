"""
Handler: /anggota — lihat daftar anggota keluarga & generate invite link
"""
from aiogram import Router, F, Bot
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import Command

from services.supabase_service import SupabaseService

router = Router()
db = SupabaseService()

ROLE_ICON = {"admin": "👑", "member": "👤"}


def _member_list_text(members: list[dict], family_name: str) -> str:
    lines = [f"👨‍👩‍👧‍👦 *Anggota {family_name}* ({len(members)} orang)\n"]
    for m in members:
        icon = ROLE_ICON.get(m.get("role", "member"), "👤")
        lines.append(f"{icon} {m['display_name']} — `{m.get('role','member')}`")
    return "\n".join(lines)


def _invite_keyboard(tenant_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🔗 Buat Link Undangan", callback_data=f"invite:{tenant_id}"),
    ]])


@router.message(Command("anggota"))
async def cmd_anggota(message: Message) -> None:
    tg_id  = message.from_user.id
    member = await db.get_member_by_telegram_id(tg_id)
    if not member:
        await message.answer("❗ Ketik /start dulu ya!")
        return

    tenant  = await db.get_tenant(member["tenant_id"]) or {}
    members = await db.get_tenant_members(member["tenant_id"])

    await message.answer(
        _member_list_text(members, tenant.get("name", "Keluarga")),
        parse_mode="Markdown",
        reply_markup=_invite_keyboard(member["tenant_id"]),
    )


@router.callback_query(F.data.startswith("invite:"))
async def cb_invite(callback: CallbackQuery, bot: Bot) -> None:
    tenant_id = callback.data.split(":", 1)[1]

    # Cek caller memang admin di tenant ini
    member = await db.get_member_by_telegram_id(callback.from_user.id)
    if not member or member["tenant_id"] != tenant_id:
        await callback.answer("❌ Akses ditolak.", show_alert=True)
        return

    me       = await bot.get_me()
    bot_name = me.username
    # Encode tenant_id (UUID) sbg deep-link payload. Telegram start-param hanya
    # menerima [A-Za-z0-9_]; kita buang tanda '-' → hex 32 char murni (tanpa
    # underscore) supaya link KEBAL parse_mode Markdown (underscore = italic,
    # bikin karakter hilang). Handler /start merekonstruksi UUID dari hex ini.
    payload  = f"join{tenant_id.replace('-', '')}"
    link     = f"https://t.me/{bot_name}?start={payload}"

    # Kirim TANPA parse_mode Markdown agar link (dan underscore apa pun) utuh.
    await callback.message.answer(
        "🔗 Link Undangan\n\n"
        f"Bagikan link ini ke anggota keluarga:\n{link}\n\n"
        "Link ini akan menambahkan mereka ke workspace kamu secara otomatis.",
    )
    await callback.answer()
