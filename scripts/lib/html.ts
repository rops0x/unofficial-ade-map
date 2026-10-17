const MAX_CODE_POINT = 0x10ffff

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/** Decodes the HTML entities that appear in ADE titles and attributes. Output is plain text, never HTML. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, entity: string) => {
    if (!entity.startsWith('#')) return NAMED_ENTITIES[entity.toLowerCase()] ?? match
    const isHex = entity[1] === 'x' || entity[1] === 'X'
    const codePoint = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10)
    return codePoint <= MAX_CODE_POINT ? String.fromCodePoint(codePoint) : match
  })
}

export function safeDecodeUri(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}
