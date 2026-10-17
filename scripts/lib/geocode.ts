/** The address as listed, then without notes like "(upstairs)" and unit letters like "12 A-K". */
export function addressVariants(address: string): readonly string[] {
  const cleaned = address
    .replace(/\([^)]*\)/g, '')
    .replace(/\b(\d+)\s+[A-Z](?:\s*-\s*[A-Z])?\b/g, '$1')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return cleaned === address ? [address] : [address, cleaned]
}
