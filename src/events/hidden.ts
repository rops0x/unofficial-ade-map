// Underground events stay hidden: a venue whose name or address signals that the
// location is secret or not public yet is never placed on the map. When unsure, hide.
const HIDDEN_WORDS =
  /\b(secrets?|tba|tbc|tbd|undisclosed|to be (announced|confirmed|revealed)|(surprise|mystery|hidden|unknown|private) (location|venue|spot|address)|(address|location) (upon|on) request|geheime? (locatie|plek))\b/
const UNREVEALED_LOCATION =
  /\b(location|locatie|venue)\b.*\b(announced|revealed|on the day|shared|dm|message|bekend|bekendgemaakt|volgt)\b/

const INVISIBLE_CHARACTERS = /[­​-‏⁠﻿]/g
const COMBINING_MARKS = /[̀-ͯ]/g
const LOOKALIKE_DIGITS: Readonly<Record<string, string>> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's' }

/** Folds tricks like "S3cret", "T.B.A." and zero-width characters into plain lowercase words. */
function normalizeForMatching(text: string): string {
  return text
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .replace(INVISIBLE_CHARACTERS, '')
    .toLowerCase()
    .replace(/(?<=[a-z])[01345](?=[a-z])/g, (digit) => LOOKALIKE_DIGITS[digit] ?? digit)
    .replace(/\b([a-z])\.(?=[a-z]\.)/g, '$1')
    .replace(/\b([a-z])\.(?=\s|$)/g, '$1')
}

export function isHiddenVenueName(name: string): boolean {
  const text = normalizeForMatching(name)
  return HIDDEN_WORDS.test(text) || UNREVEALED_LOCATION.test(text)
}
