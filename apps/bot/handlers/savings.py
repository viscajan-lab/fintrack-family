"""
Handler: /tabungan     — lihat daftar target tabungan + progres bar
Handler: /nabung       — setor ke target tabungan (hybrid: one-shot + interaktif)
Handler: /target_baru  — buat target tabungan baru (hybrid: one-shot + interaktif)

Padanan bot untuk fitur "Savings Goals" yang sudah ada di web dashboard.
Tabel: savings_goals (id, tenant_id, name, target_amount, saved_amount,
deadline, note, achieved_at). Setoran = update saved_amount (tak ada tabel
kontribusi terpisah).
"""
from aiogram import Router, F
from aiogram.types import Message
from aiogram.filters import Command, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from datetime import date, datetime

from services.supabase_service import SupabaseService
from services.nlp_parser import _parse_amount

router = Router()
db = SupabaseService()


def format_idr(amount: int) -> str:
    return f"Rp {amount:,.0f}".replace(",", ".")


def progress_bar(saved: int, target: int, width: int = 10) -> str:
    ratio  = min(saved / target, 1.0) if target > 0 else 0
    filled = round(ratio * width)
    bar    = "█" * filled + "░" * (width - filled)
    pct    = round(ratio * 100)
    icon   = "🎉" if pct >= 100 else "🟢" if pct >= 66 else "🟡" if pct >= 33 else "🔴"
    return f"{icon} {bar} {pct}%"


def _days_left_label(deadline: str | None) -> str:
    if not deadline:
        return ""
    try:
        d    = datetime.strptime(deadline, "%Y-%m-%d").date()
        diff = (d - date.today()).days
    except (ValueError, TypeError):
        return ""
    if diff > 0:
        return f"⏳ {diff} hari lagi (s/d {d.strftime('%d %b %Y')})"
    if diff == 0:
        return "⏰ Jatuh tempo hari ini!"
    return f"⚠️ Lewat {abs(diff)} hari (deadline {d.strftime('%d %b %Y')})"


# ══════════════════════════════════════════════════════════════════════════════
#  /tabungan — daftar target + progres
# ══════════════════════════════════════════════════════════════════════════════

@router.message(Command("tabungan"))
async def cmd_tabungan(message: Message) -> None:
    if not message.from_user:
        return
    member = await db.get_member_by_telegram_id(message.from_user.id)
    if not member:
        await message.answer("❗ Ketik /start dulu ya!")
        return

    goals = await db.get_savings_goals(member["tenant_id"])
    if not goals:
        await message.answer(
            "🎯 *Target Tabungan*\n\n"
            "Belum ada target tabungan.\n\n"
            "Buat target baru: `/target_baru <nama> <target>`\n"
            "Contoh: `/target_baru Dana Darurat 10jt`\n\n"
            "Atau lewat web: https://fintrack-family.vercel.app/dashboard/savings",
            parse_mode="Markdown",
        )
        return

    lines = ["🎯 *Target Tabungan*\n"]
    total_target = 0
    total_saved  = 0

    for g in goals:
        name      = g["name"]
        target    = g["target_amount"] or 0
        saved     = g["saved_amount"] or 0
        remaining = max(target - saved, 0)
        total_target += target
        total_saved  += saved

        head = f"*{name}*"
        if g.get("achieved_at"):
            head += " ✅"

        block = [
            head,
            progress_bar(saved, target),
            f"Terkumpul: {format_idr(saved)} / {format_idr(target)}",
        ]
        if remaining > 0:
            block.append(f"Kurang: *{format_idr(remaining)}*")
        else:
            block.append("*Tercapai!* 🎉")
        dl = _days_left_label(g.get("deadline"))
        if dl:
            block.append(dl)
        lines.append("\n".join(block) + "\n")

    lines.append("─────────────────")
    lines.append(f"Total terkumpul: {format_idr(total_saved)} / {format_idr(total_target)}")
    lines.append("")
    lines.append("💰 Nabung: `/nabung <target> <nominal>`")
    lines.append("➕ Target baru: `/target_baru <nama> <target>`")

    await message.answer("\n".join(lines), parse_mode="Markdown")


# ══════════════════════════════════════════════════════════════════════════════
#  /nabung — setor ke target (hybrid one-shot + FSM)
# ══════════════════════════════════════════════════════════════════════════════

class Nabung(StatesGroup):
    waiting_goal   = State()
    waiting_amount = State()


async def _goal_menu(tenant_id: str) -> str:
    goals = await db.get_savings_goals(tenant_id)
    if not goals:
        return ""
    return "\n".join(f"• {g['name']}" for g in goals)


async def _do_setor(message: Message, goal: dict, amount: int) -> None:
    updated   = await db.add_savings_contribution(goal, amount)
    saved     = updated["saved_amount"] or 0
    target    = updated["target_amount"] or 0
    remaining = max(target - saved, 0)

    msg = [
        f"✅ *Setoran tercatat!*\n",
        f"Target : *{updated['name']}*",
        f"Setor  : *{format_idr(amount)}*",
        f"{progress_bar(saved, target)}",
        f"Terkumpul: {format_idr(saved)} / {format_idr(target)}",
    ]
    if remaining > 0:
        msg.append(f"Kurang: *{format_idr(remaining)}*")
    else:
        msg.append("\n🎉 *Selamat! Target tabungan tercapai!* 🎉")
    await message.answer("\n".join(msg), parse_mode="Markdown")


@router.message(Command("nabung"))
async def cmd_nabung(message: Message, state: FSMContext) -> None:
    await state.clear()
    if not message.from_user:
        return
    member = await db.get_member_by_telegram_id(message.from_user.id)
    if not member:
        await message.answer("❗ Ketik /start dulu ya!")
        return

    goals = await db.get_savings_goals(member["tenant_id"])
    if not goals:
        await message.answer(
            "🎯 Belum ada target tabungan. Buat dulu:\n"
            "`/target_baru <nama> <target>`",
            parse_mode="Markdown",
        )
        return

    parts = (message.text or "").split(maxsplit=1)
    args  = parts[1].strip() if len(parts) > 1 else ""

    # ── Jalur ONE-SHOT: "/nabung <nama> <nominal>" ──────────────────────────
    if args:
        tokens = args.rsplit(maxsplit=1)
        if len(tokens) == 2:
            goal_raw, amount_raw = tokens[0], tokens[1]
            goal   = await db.get_savings_goal_by_name(member["tenant_id"], goal_raw)
            amount = _parse_amount(amount_raw)
            if goal and amount and amount > 0:
                await _do_setor(message, goal, amount)
                return
            if not goal:
                await message.answer(
                    f"⚠️ Target *{goal_raw}* tidak ditemukan. Pilih dari daftar:",
                    parse_mode="Markdown",
                )
            elif not amount or amount <= 0:
                await message.answer(
                    f"⚠️ Nominal *{amount_raw}* tidak valid (mis. `500rb`, `1jt`).",
                    parse_mode="Markdown",
                )

    # ── Jalur INTERAKTIF ─────────────────────────────────────────────────────
    await state.set_state(Nabung.waiting_goal)
    await message.answer(
        "💰 *Nabung*\n\n"
        "Mau nabung ke target yang mana? Ketik namanya:\n\n"
        f"{await _goal_menu(member['tenant_id'])}\n\n"
        "_Ketik /batal untuk membatalkan._",
        parse_mode="Markdown",
    )


@router.message(Command("batal"), StateFilter(Nabung))
async def cancel_nabung(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("❌ Dibatalkan. Tidak ada setoran yang tercatat.")


@router.message(StateFilter(Nabung.waiting_goal), F.text)
async def nb_got_goal(message: Message, state: FSMContext) -> None:
    if not message.from_user:
        return
    member = await db.get_member_by_telegram_id(message.from_user.id)
    if not member:
        await state.clear()
        await message.answer("❗ Ketik /start dulu ya!")
        return
    goal = await db.get_savings_goal_by_name(member["tenant_id"], message.text or "")
    if not goal:
        await message.answer(
            "⚠️ Target tidak ditemukan. Ketik salah satu (boleh disingkat):\n\n"
            f"{await _goal_menu(member['tenant_id'])}",
            parse_mode="Markdown",
        )
        return
    await state.update_data(goal_id=goal["id"])
    await state.set_state(Nabung.waiting_amount)
    await message.answer(
        f"Oke, nabung ke *{goal['name']}*.\n\n"
        f"Ketik nominal setoran (mis. `500rb`, `1jt`, `250000`):",
        parse_mode="Markdown",
    )


@router.message(StateFilter(Nabung.waiting_amount), F.text)
async def nb_got_amount(message: Message, state: FSMContext) -> None:
    amount = _parse_amount(message.text or "")
    if not amount or amount <= 0:
        await message.answer(
            "⚠️ Nominal tidak valid. Ketik angka > 0, mis. `500rb`, `1jt`:",
            parse_mode="Markdown",
        )
        return
    data   = await state.get_data()
    member = await db.get_member_by_telegram_id(message.from_user.id) if message.from_user else None
    await state.clear()
    if not member:
        await message.answer("❗ Ketik /start dulu ya!")
        return
    # Re-fetch goal fresh by id (saved_amount bisa berubah selama FSM)
    goals = await db.get_savings_goals(member["tenant_id"])
    goal  = next((g for g in goals if g["id"] == data.get("goal_id")), None)
    if not goal:
        await message.answer("⚠️ Target sudah tidak ada. Coba /tabungan lagi.")
        return
    await _do_setor(message, goal, amount)


# ══════════════════════════════════════════════════════════════════════════════
#  /target_baru — buat target tabungan (hybrid one-shot + FSM)
# ══════════════════════════════════════════════════════════════════════════════

class NewGoal(StatesGroup):
    waiting_name   = State()
    waiting_target = State()


async def _do_create(message: Message, member: dict, name: str, target: int) -> None:
    await db.create_savings_goal(member["tenant_id"], name, target)
    await message.answer(
        f"✅ *Target tabungan dibuat!*\n\n"
        f"Nama   : *{name}*\n"
        f"Target : *{format_idr(target)}*\n\n"
        f"Mulai nabung: `/nabung {name} <nominal>`\n"
        f"Lihat semua: /tabungan",
        parse_mode="Markdown",
    )


@router.message(Command("target_baru"))
async def cmd_target_baru(message: Message, state: FSMContext) -> None:
    await state.clear()
    if not message.from_user:
        return
    member = await db.get_member_by_telegram_id(message.from_user.id)
    if not member:
        await message.answer("❗ Ketik /start dulu ya!")
        return

    parts = (message.text or "").split(maxsplit=1)
    args  = parts[1].strip() if len(parts) > 1 else ""

    # ── ONE-SHOT: "/target_baru <nama multi kata> <target>" ─────────────────
    if args:
        tokens = args.rsplit(maxsplit=1)
        if len(tokens) == 2:
            name_raw, target_raw = tokens[0].strip(), tokens[1]
            target = _parse_amount(target_raw)
            if name_raw and target and target > 0:
                await _do_create(message, member, name_raw, target)
                return
            if not target or target <= 0:
                await message.answer(
                    f"⚠️ Target *{target_raw}* tidak valid (mis. `10jt`, `5000000`).",
                    parse_mode="Markdown",
                )

    # ── INTERAKTIF ───────────────────────────────────────────────────────────
    await state.set_state(NewGoal.waiting_name)
    await message.answer(
        "🎯 *Buat Target Tabungan*\n\n"
        "Kasih nama targetnya apa? (mis. `Dana Darurat`, `Liburan Bali`)\n\n"
        "_Ketik /batal untuk membatalkan._",
        parse_mode="Markdown",
    )


@router.message(Command("batal"), StateFilter(NewGoal))
async def cancel_newgoal(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("❌ Dibatalkan. Tidak ada target yang dibuat.")


@router.message(StateFilter(NewGoal.waiting_name), F.text)
async def ng_got_name(message: Message, state: FSMContext) -> None:
    name = (message.text or "").strip()
    if not name or name.startswith("/"):
        await message.answer("⚠️ Nama tidak valid. Ketik nama target (mis. `Dana Darurat`):")
        return
    await state.update_data(name=name)
    await state.set_state(NewGoal.waiting_target)
    await message.answer(
        f"Oke, target *{name}*.\n\n"
        f"Berapa target nominalnya? (mis. `10jt`, `5000000`):",
        parse_mode="Markdown",
    )


@router.message(StateFilter(NewGoal.waiting_target), F.text)
async def ng_got_target(message: Message, state: FSMContext) -> None:
    target = _parse_amount(message.text or "")
    if not target or target <= 0:
        await message.answer(
            "⚠️ Target tidak valid. Ketik angka > 0, mis. `10jt`, `5000000`:",
            parse_mode="Markdown",
        )
        return
    data   = await state.get_data()
    member = await db.get_member_by_telegram_id(message.from_user.id) if message.from_user else None
    await state.clear()
    if not member:
        await message.answer("❗ Ketik /start dulu ya!")
        return
    await _do_create(message, member, data["name"], target)
