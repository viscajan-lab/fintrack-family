"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import type { StorageProvider, StorageType } from "@/lib/providers"

interface StorageCtx {
  provider:    StorageProvider | null
  storageType: StorageType | null
  loading:     boolean
}

const Ctx = createContext<StorageCtx>({ provider: null, storageType: null, loading: true })

export function useStorage() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useStorage must be used inside <StorageProvider>")
  return ctx
}

// ─── Provider component ────────────────────────────────────────────────────────
// Fetches /api/storage/provider on mount → lazy-imports the right implementation

export function StorageContextProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StorageCtx>({ provider: null, storageType: null, loading: true })

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const res = await fetch("/api/storage/provider-info")
        if (!res.ok) { setState(s => ({ ...s, loading: false })); return }

        const { storage_type, sheets_config } = await res.json() as {
          storage_type:  StorageType
          sheets_config?: {
            spreadsheetId: string
            accessToken:   string
            refreshToken:  string
          }
        }

        let provider: StorageProvider

        if (storage_type === "sheets" && sheets_config) {
          const { SheetsProvider } = await import("@/lib/providers/sheets-provider")
          provider = new SheetsProvider({
            spreadsheetId: sheets_config.spreadsheetId,
            accessToken:   sheets_config.accessToken,
            refreshToken:  sheets_config.refreshToken,
            refreshFn: async (rt) => {
              const r = await fetch("/api/auth/google/refresh", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: rt }),
              })
              const { access_token } = await r.json()
              return access_token
            },
          })
        } else {
          const { SupabaseProvider } = await import("@/lib/providers/supabase-provider")
          const { createBrowserClient } = await import("@supabase/ssr")
          const db = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          )
          provider = new SupabaseProvider(db)
        }

        if (!cancelled) setState({ provider, storageType: storage_type, loading: false })
      } catch {
        if (!cancelled) setState(s => ({ ...s, loading: false }))
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}
