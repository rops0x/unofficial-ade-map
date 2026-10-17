// The data scripts only ever talk to these hosts, over https. Anything else in a
// scraped response (a tampered venue URL, a redirect) is refused, not fetched.
const ALLOWED_HOSTS: ReadonlySet<string> = new Set(['www.amsterdam-dance-event.nl', 'nominatim.openstreetmap.org'])

export function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && ALLOWED_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}
