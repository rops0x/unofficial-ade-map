import { describe, expect, test } from 'vitest'
import { decodeEntities, safeDecodeUri } from './html.ts'

describe('decodeEntities', () => {
  test('decodes named, decimal and hex entities', () => {
    expect(decodeEntities('Rock &amp; Roll &#039;26 &#x2764; &quot;live&quot;')).toBe('Rock & Roll \'26 ❤ "live"')
  })

  test('leaves out-of-range numeric entities alone instead of throwing', () => {
    expect(decodeEntities('odd &#99999999; title')).toBe('odd &#99999999; title')
  })

  test('leaves unknown entities alone', () => {
    expect(decodeEntities('&bogus; stays')).toBe('&bogus; stays')
  })
})

describe('safeDecodeUri', () => {
  test('decodes percent-encoding', () => {
    expect(safeDecodeUri('Dam%201')).toBe('Dam 1')
  })

  test('returns malformed input unchanged instead of throwing', () => {
    expect(safeDecodeUri('100%')).toBe('100%')
  })
})
