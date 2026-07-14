import { redirect } from "next/navigation"
import { getWizardState } from "./actions"
import { WizardClient } from "./WizardClient"

export const dynamic = "force-dynamic"

export default async function WizardPage() {
  const state = await getWizardState()

  // Belum login → arahkan ke register dulu (A1: register jadi fondasi wizard).
  if (!state.authenticated) redirect("/register")

  return <WizardClient initial={state} />
}
