import { NextRequest, NextResponse } from "next/server"

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "openid",
  "email",
].join(" ")

export async function GET(req: NextRequest) {
  const intent = req.nextUrl.searchParams.get("intent") ?? "sheets_setup"

  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID!,
    redirect_uri:  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
    response_type: "code",
    scope:         SCOPES,
    access_type:   "offline",
    prompt:        "consent",        // force refresh_token tiap kali
    state:         intent,
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
}
