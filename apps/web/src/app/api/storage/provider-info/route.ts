import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: member } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single()

  if (!member) return NextResponse.json({ error: "No tenant" }, { status: 404 })

  const { data: tenant } = await supabase
    .from("tenants")
    .select("storage_type, sheets_spreadsheet_id, sheets_access_token, sheets_refresh_token, sheets_token_expiry")
    .eq("id", member.tenant_id)
    .single()

  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 })

  const payload: Record<string, unknown> = { storage_type: tenant.storage_type }

  if (tenant.storage_type === "sheets") {
    // Refresh token if expiring within 5 minutes
    const expiry = tenant.sheets_token_expiry ? new Date(tenant.sheets_token_expiry) : null
    let accessToken = tenant.sheets_access_token

    if (expiry && expiry.getTime() - Date.now() < 5 * 60 * 1000) {
      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id:     process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: tenant.sheets_refresh_token!,
          grant_type:    "refresh_token",
        }),
      })
      if (refreshRes.ok) {
        const { access_token, expires_in } = await refreshRes.json()
        accessToken = access_token
        const newExpiry = new Date(Date.now() + expires_in * 1000).toISOString()
        await supabase.from("tenants").update({
          sheets_access_token: access_token,
          sheets_token_expiry: newExpiry,
        }).eq("id", member.tenant_id)
      }
    }

    payload.sheets_config = {
      spreadsheetId: tenant.sheets_spreadsheet_id,
      accessToken,
      refreshToken: tenant.sheets_refresh_token,
    }
  }

  return NextResponse.json(payload)
}
