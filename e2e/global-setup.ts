// The Worker answers /health before Vite is up, and Playwright only waits for the first URL.
// Also picks the second origin: a different origin gives a second person their own guest session,
// and which loopback address Vite listens on depends on the machine (IPv4 or IPv6).
async function reachable(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).ok
  } catch {
    return false
  }
}

export default async function globalSetup(): Promise<void> {
  const deadline = Date.now() + 120_000
  while (!(await reachable('http://localhost:5173/'))) {
    if (Date.now() > deadline) throw new Error('the web app did not start on http://localhost:5173')
    await new Promise((r) => setTimeout(r, 500))
  }
  for (const origin of ['http://127.0.0.1:5173', 'http://[::1]:5173']) {
    if (await reachable(origin + '/')) {
      process.env.E2E_ORIGIN_B = origin
      return
    }
  }
  throw new Error('the web app is reachable on localhost only: a second origin is needed for a second person')
}
