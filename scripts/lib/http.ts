// Polite HTTP for the data scripts: only allowed hosts, identifies itself, waits
// between requests to the same host, and retries only transient failures.
import { isAllowedUrl } from './hosts.ts'

const MIN_INTERVAL_MS = 1100
const MAX_ATTEMPTS = 3
const RETRY_BASE_MS = 2000
const REQUEST_TIMEOUT_MS = 30_000

const contact = process.env.ADE_MAP_CONTACT
export const USER_AGENT = `UnofficialADEMap/0.1 (community festival map${contact ? `; ${contact}` : ''})`

const lastRequestAt = new Map<string, number>()

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function throttle(host: string): Promise<void> {
  const elapsed = Date.now() - (lastRequestAt.get(host) ?? 0)
  if (elapsed < MIN_INTERVAL_MS) await wait(MIN_INTERVAL_MS - elapsed)
  lastRequestAt.set(host, Date.now())
}

type Attempt =
  | { readonly ok: true; readonly body: string }
  | { readonly ok: false; readonly isRetryable: boolean; readonly error: Error }

async function attemptGet(url: string, headers: Readonly<Record<string, string>>): Promise<Attempt> {
  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, ...headers },
      redirect: 'error', // a redirect could lead to a host outside the allowlist
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    // Network errors and timeouts are worth retrying; a refused redirect is not.
    return { ok: false, isRetryable: !/redirect/i.test(message), error: new Error(`GET ${url} failed: ${message}`) }
  }
  if (response.ok) return { ok: true, body: await response.text() }
  const isRetryable = response.status === 429 || response.status >= 500
  return { ok: false, isRetryable, error: new Error(`GET ${url} failed with HTTP ${response.status}`) }
}

export async function politeGet(url: string, headers: Readonly<Record<string, string>> = {}): Promise<string> {
  if (!isAllowedUrl(url)) throw new Error(`Refusing to fetch ${url}: not an allowed https host`)
  const host = new URL(url).host
  for (let attempt = 1; ; attempt += 1) {
    await throttle(host)
    const result = await attemptGet(url, headers)
    if (result.ok) return result.body
    if (!result.isRetryable || attempt >= MAX_ATTEMPTS) throw result.error
    await wait(RETRY_BASE_MS * attempt)
  }
}

export async function politeGetJson(url: string, headers: Readonly<Record<string, string>> = {}): Promise<unknown> {
  const body = await politeGet(url, { Accept: 'application/json', ...headers })
  try {
    return JSON.parse(body)
  } catch {
    throw new Error(`GET ${url} did not return JSON`)
  }
}
