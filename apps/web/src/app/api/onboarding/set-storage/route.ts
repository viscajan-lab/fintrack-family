import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const { storage_type } = await req.json()

  if (!["supabase", "sheets"].includes(storage_type)) {
    return NextResponse.json({ error: "Invalid storage_type" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Get tenant_id for this user (toleran multi-tenant: ambil yang terbaru)
  const { data: member, error: memberErr } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (memberErr || !member) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
  }

  const { error } = await supabase
    .from("tenants")
    .update({ storage_type, updated_at: new Date().toISOString() })
    .eq("id", member.tenant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
