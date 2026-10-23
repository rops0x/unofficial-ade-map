// Reads the filters from ADE's program page and works out which of them each event matches.
import type { FilterChoice, FilterGroup } from '../../src/filters/schema.ts'
import { decodeEntities } from './html.ts'

/** The filter groups plus, for options the event listing doesn't name (Program), the ADE event ids listed under each. */
export interface FilterSource {
  readonly groups: readonly FilterGroup[]
  readonly members: Readonly<Record<string, readonly number[]>>
}

export type Tagger = (adeId: number, categoryNames: readonly string[]) => readonly string[]

// Days are the map's own day buttons; everything else on ADE's filter panel is an option group.
const IGNORED_TYPES = new Set(['day'])
// Every tag is read whole and judged by its class list, so extra classes or a new attribute order don't hide it.
// `[^<>]*` stops at the next tag, which keeps these linear even on broken or hostile HTML.
const DIV_TAG = /<div\b([^<>]*)>/g
const INPUT_TAG = /<input\b[^<>]*>/g
const ATTRIBUTE = /\s([a-z-]+)="([^"]*)"/g
// Labels end up in the terminal log; an escape sequence in one must not reach it.
const CONTROL_CHARACTERS = /\p{Cc}/gu
const CATEGORY_SEPARATOR = ' / '
// The event listing names an event's genres and types, but not its program; ADE's API is asked per program option instead.
const LISTED_GROUP_ID = 'program'
// ADE offers 3 programs. Each is a crawl of its own, so many more means the page changed.
const MAX_LISTED_OPTIONS = 10

type TagKind = 'branch' | 'family' | 'leaf'

interface FilterTag {
  readonly kind: TagKind
  readonly attrs: ReadonlyMap<string, string>
  readonly start: number
  readonly end: number
}

type Token =
  | { readonly kind: 'branch'; readonly familyId: string }
  | { readonly kind: 'family' | 'leaf'; readonly type: string; readonly id: string; readonly label: string }

interface Item extends FilterChoice {
  readonly kind: 'family' | 'leaf'
  readonly type: string
  /** The genre family whose styles this item is listed under, if any. */
  readonly branchId: string | null
}

const slug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function attributes(tag: string): ReadonlyMap<string, string> {
  return new Map(
    [...tag.matchAll(ATTRIBUTE)].map(([, name, value]) => [name ?? '', decodeEntities(value ?? '').replace(CONTROL_CHARACTERS, '').trim()]),
  )
}

function kindOf(classAttribute: string): TagKind | null {
  const classes = new Set(classAttribute.split(/\s+/))
  if (classes.has('filter-popup__branch')) return 'branch'
  if (classes.has('filter-popup__item--family')) return 'family'
  return classes.has('filter-popup__item') ? 'leaf' : null
}

function filterTags(html: string): readonly FilterTag[] {
  return [...html.matchAll(DIV_TAG)].flatMap((match) => {
    const attrs = attributes(match[1] ?? '')
    const kind = kindOf(attrs.get('class') ?? '')
    return kind ? [{ kind, attrs, start: match.index, end: match.index + match[0].length }] : []
  })
}

/** The id in the first category checkbox of an option's markup. */
function categoryValue(body: string): string {
  const checkbox = [...body.matchAll(INPUT_TAG)].map(([tag]) => attributes(tag)).find((attrs) => attrs.get('name') === 'category')
  return checkbox?.get('value') ?? ''
}

/** `body` is the markup from this tag up to the next filter tag. */
function toToken(tag: FilterTag, body: string): Token | null {
  if (tag.kind === 'branch') return { kind: 'branch', familyId: tag.attrs.get('data-children-of') ?? '' }

  const type = tag.attrs.get('data-filter-type') ?? ''
  const label = tag.attrs.get('data-name-readable') ?? ''
  if (!type || IGNORED_TYPES.has(type)) return null
  if (tag.kind === 'family') return { kind: 'family', type, label, id: tag.attrs.get('data-family') ?? '' }
  // A plain option keeps its id in the checkbox inside it.
  return { kind: 'leaf', type, label, id: categoryValue(body) }
}

function toItems(tokens: readonly Token[]): readonly Item[] {
  return tokens.reduce<{ readonly branchId: string | null; readonly items: readonly Item[] }>(
    (state, token) =>
      token.kind === 'branch'
        ? { ...state, branchId: token.familyId }
        : { ...state, items: [...state.items, { ...token, branchId: state.branchId }] },
    { branchId: null, items: [] },
  ).items
}

function toGroup(type: string, items: readonly Item[]): FilterGroup {
  const inGroup = items.filter((item) => item.type === type)
  const familyIds = new Set(inGroup.filter((item) => item.kind === 'family').map((item) => item.id))
  const isStyle = (item: Item): boolean => item.kind === 'leaf' && item.branchId !== null && familyIds.has(item.branchId)
  const options = inGroup
    .filter((item) => !isStyle(item))
    .map((item) => {
      const children = inGroup.filter((child) => isStyle(child) && child.branchId === item.id).map(({ id, label }) => ({ id, label }))
      return children.length > 0 ? { id: item.id, label: item.label, children } : { id: item.id, label: item.label }
    })
  return { id: slug(type), label: type, options }
}

/** Parses the filter panel of amsterdam-dance-event.nl/en/program/filter/. Throws if the page no longer looks like it. */
export function parseAdeFilters(html: string): readonly FilterGroup[] {
  const tags = filterTags(html)
  const tokens = tags
    .map((tag, index) => toToken(tag, html.slice(tag.end, tags[index + 1]?.start ?? html.length)))
    .filter((token): token is Token => token !== null)
  const items = toItems(tokens)
  const nameless = items.find((item) => !item.id || !item.label)
  if (nameless) throw new Error(`ADE filter option "${nameless.label || '?'}" has no id or name — the page may have changed.`)
  if (items.length === 0) throw new Error('No filters found on the ADE program page — the page may have changed.')

  const types = [...new Set(items.map((item) => item.type))]
  return types.map((type) => toGroup(type, items))
}

/** The options ADE's API is asked about one by one (Program). Throws if the page no longer looks like it. */
export function listedOptions(groups: readonly FilterGroup[]): readonly FilterChoice[] {
  const listed = groups.find((group) => group.id === LISTED_GROUP_ID)
  if (!listed) throw new Error('ADE’s filter page has no Program group — the page may have changed.')
  if (listed.options.length > MAX_LISTED_OPTIONS) {
    throw new Error(`ADE’s Program filter has ${listed.options.length} options, more than the ${MAX_LISTED_OPTIONS} expected — the page may have changed.`)
  }
  return listed.options
}

/** ADE lists an event's categories as one string: "Nighttime events / Techno / Hard Techno". */
export function categoryNames(categories: string | null | undefined): readonly string[] {
  return (categories ?? '')
    .split(CATEGORY_SEPARATOR)
    .map((name) => decodeEntities(name).trim())
    .filter((name) => name.length > 0)
}

/** Collects values under their key in one pass. The Map is built here and handed out read-only. */
function groupByKey<K, V>(pairs: readonly (readonly [K, readonly V[]])[]): ReadonlyMap<K, readonly V[]> {
  const grouped = new Map<K, readonly V[]>()
  for (const [key, values] of pairs) grouped.set(key, [...(grouped.get(key) ?? []), ...values])
  return grouped
}

/** `listedIds`: options the API lists (Program); they are matched by that list, not by name. */
function idsByName(groups: readonly FilterGroup[], listedIds: ReadonlySet<string>): ReadonlyMap<string, readonly string[]> {
  // A style also carries its family's id, so choosing "House" finds "Deep House" events.
  const entries = groups.flatMap((group) =>
    group.options
      .filter((option) => !listedIds.has(option.id))
      .flatMap((option) => [
        [option.label.toLowerCase(), [option.id]] as const,
        ...(option.children ?? []).map((child) => [child.label.toLowerCase(), [child.id, option.id]] as const),
      ]),
  )
  return groupByKey(entries)
}

function idsByMember(members: FilterSource['members']): ReadonlyMap<number, readonly string[]> {
  return groupByKey(Object.entries(members).flatMap(([optionId, adeIds]) => adeIds.map((adeId) => [adeId, [optionId]] as const)))
}

/** Returns a function giving the sorted filter option ids an event matches. Categories that are not filters (areas) are ignored. */
export function createTagger(source: FilterSource): Tagger {
  const byName = idsByName(source.groups, new Set(Object.keys(source.members)))
  const byMember = idsByMember(source.members)
  return (adeId, names) => {
    const ids = [...names.flatMap((name) => byName.get(name.toLowerCase()) ?? []), ...(byMember.get(adeId) ?? [])]
    return [...new Set(ids)].sort()
  }
}

/** The groups with only the options some event has; options, styles and groups left empty are dropped. */
export function usedFilters(groups: readonly FilterGroup[], usedIds: ReadonlySet<string>): readonly FilterGroup[] {
  return groups
    .map((group) => ({
      ...group,
      options: group.options
        .filter((option) => usedIds.has(option.id))
        .map(({ children, ...option }) => {
          const used = (children ?? []).filter((child) => usedIds.has(child.id))
          return used.length > 0 ? { ...option, children: used } : option
        }),
    }))
    .filter((group) => group.options.length > 0)
}
