import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Exchange code → tokens, create Spreadsheet, save to tenant
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code  = searchParams.get("code")
  const state = searchParams.get("state") // "sheets_setup"
  const APP   = process.env.NEXT_PUBLIC_APP_URL!

  if (!code) return NextResponse.redirect(`${APP}/onboarding?error=oauth_denied`)

  // 1. Exchange auth code → tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  `${APP}/api/auth/google/callback`,
      grant_type:    "authorization_code",
    }),
  })

  if (!tokenRes.ok) return NextResponse.redirect(`${APP}/onboarding?error=token_exchange`)

  const { access_token, refresh_token, expires_in } = await tokenRes.json()
  const expiry = new Date(Date.now() + expires_in * 1000).toISOString()

  // 2. Create a new Google Spreadsheet for this tenant
  const sheetRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title: "FinTrack Family — Data Keuangan" },
      sheets: [
        { properties: { title: "Transactions", sheetId: 0 } },
        { properties: { title: "Budgets",      sheetId: 1 } },
        { properties: { title: "Categories",   sheetId: 2 } },
      ],
    }),
  })

  if (!sheetRes.ok) return NextResponse.redirect(`${APP}/onboarding?error=sheet_create`)

  const { spreadsheetId } = await sheetRes.json()

  // 3. Add header rows
  const headers = [
    { range: "Transactions!A1", values: [["id","tenant_id","user_id","type","amount","description","category","date","created_at"]] },
    { range: "Budgets!A1",      values: [["id","tenant_id","category","amount","month","created_at"]] },
    { range: "Categories!A1",   values: [["id","tenant_id","name","type","icon"]] },
  ]
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ valueInputOption: "RAW", data: headers }),
  })

  // 4. Save tokens + spreadsheetId + storage_type to Supabase
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${APP}/login`)

  const { data: member } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single()

  if (!member) return NextResponse.redirect(`${APP}/onboarding?error=no_tenant`)

  await supabase.from("tenants").update({
    storage_type:          "sheets",
    sheets_spreadsheet_id: spreadsheetId,
    sheets_access_token:   access_token,
    sheets_refresh_token:  refresh_token,
    sheets_token_expiry:   expiry,
    updated_at:            new Date().toISOString(),
  }).eq("id", member.tenant_id)

  return NextResponse.redirect(`${APP}/dashboard`)
}
