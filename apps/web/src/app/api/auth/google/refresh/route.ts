import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { refresh_token } = await req.json()
  if (!refresh_token) return NextResponse.json({ error: "Missing refresh_token" }, { status: 400 })

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token,
      grant_type:    "refresh_token",
    }),
  })

  if (!res.ok) return NextResponse.json({ error: "Refresh failed" }, { status: 502 })

  const { access_token, expires_in } = await res.json()
  return NextResponse.json({ access_token, expires_in })
}
