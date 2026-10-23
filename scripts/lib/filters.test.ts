import { describe, expect, test } from 'vitest'
import type { FilterGroup } from '../../src/filters/schema.ts'
import { categoryNames, createTagger, listedOptions, parseAdeFilters, usedFilters } from './filters.ts'

// Trimmed from amsterdam-dance-event.nl/en/program/filter/ (2026-10-23): same tags, attributes and order.
const ICON = '<span class="filter-popup__item__icon"><svg><path d="M18 32"/></svg></span>'
const leaf = (type: string, label: string, id: string): string =>
  `<div class="filter-popup__item"
     data-filter-type="${type}"
     data-name-readable="${label}"
     data-days="2026-10-21,2026-10-22">
     ${label}
     <input type="checkbox" id="${id}" value="${id}" name="category" ><label for="${id}"></label>${ICON}</div>`
const family = (label: string, id: string): string =>
  `<div class="filter-popup__item filter-popup__item--family"
     data-filter-type="Genre"
     data-name-readable="${label}"
     data-days="2026-10-21"
     data-family="${id}"
     role="button"
     tabindex="0">
     ${label}
     <span class="filter-popup__item__border"></span>${ICON}<span class="filter-popup__item__count"></span></div>`
const branch = (id: string, label: string, children: string): string =>
  `<div class="filter-popup__branch"
     data-children-of="${id}"
     hidden><div class="filter-popup__branch__head"><button type="button" class="filter-popup__back" data-back-to="Genre" aria-label="Filter"><svg/></button>
     <h3 class="filter-popup__branch__title">${label}</h3>
     <label class="filter-popup__all" data-filter-type="Genre"><input type="checkbox" id="${id}" value="${id}" name="category"><span data-on="Deselect all">Select all</span></label></div>
     <div class="filter-popup__items">${children}</div></div>`
const section = (title: string, items: string): string =>
  `<div class="filter-popup__section"><h2 class="filter-popup__section__title">${title}</h2><div class="filter-popup__items" data-families="${title}">${items}</div></div>`

const FILTER_PAGE = [
  '<div data-module="_components/results-filters/results-filters"><h2 class="filter-popup__title">Filter program</h2>',
  section('Days', '<div class="filter-popup__item" data-filter-type="day"><span>Wed</span><input type="radio" name="date" id="2026-10-21" value="2026-10-21"></div>'),
  section('Program', leaf('Program', 'Festival', '1485951') + leaf('Program', 'Arts &amp; Culture', '1485953')),
  section(
    'Genre',
    family('House', '450') +
      family('Techno', '37') +
      branch('450', 'House', leaf('Genre', 'Deep House', '449') + leaf('Genre', 'Tech-house', '453')) +
      branch('37', 'Techno', leaf('Genre', 'Hard Techno', '2840691')),
  ),
  section('Type', leaf('Type', 'Club nights', '2528651') + leaf('Type', 'Warehouses', '2592403')),
  '<div class="filter-popup__footer"><label class="filter-popup__switch" data-filter-type="available-tickets"><input type="checkbox" id="available-tickes-only"></label></div></div>',
].join('')

const GROUPS: readonly FilterGroup[] = [
  { id: 'program', label: 'Program', options: [{ id: '1485951', label: 'Festival' }, { id: '1485953', label: 'Arts & Culture' }] },
  {
    id: 'genre',
    label: 'Genre',
    options: [
      { id: '450', label: 'House', children: [{ id: '449', label: 'Deep House' }, { id: '453', label: 'Tech-house' }] },
      { id: '37', label: 'Techno', children: [{ id: '2840691', label: 'Hard Techno' }] },
    ],
  },
  { id: 'type', label: 'Type', options: [{ id: '2528651', label: 'Club nights' }, { id: '2592403', label: 'Warehouses' }] },
]

describe('parseAdeFilters', () => {
  test('reads the Program, Genre and Type groups in page order, with each genre family’s styles', () => {
    expect(parseAdeFilters(FILTER_PAGE)).toEqual(GROUPS)
  })

  test('leaves out the day buttons and the tickets switch, which the map handles itself', () => {
    const labels = parseAdeFilters(FILTER_PAGE).map((group) => group.label)

    expect(labels).not.toContain('day')
    expect(labels).not.toContain('available-tickets')
  })

  test('fails when the page has no filters, so a changed site never wipes the filters silently', () => {
    expect(() => parseAdeFilters('<html><body>Maintenance</body></html>')).toThrow(/filter/i)
  })

  test('fails when an option has no id', () => {
    const broken = section('Type', leaf('Type', 'Club nights', '2528651').replace(/<input[^>]*>/, ''))

    expect(() => parseAdeFilters(broken)).toThrow(/Club nights/)
  })

  test('still reads an option whose tag gains classes or reorders its attributes', () => {
    const restyled = section(
      'Type',
      '<div data-filter-type="Type" class="is-new filter-popup__item" data-name-readable="Warehouses">' +
        '<input name="category" type="checkbox" value="2592403"></div>',
    )

    expect(parseAdeFilters(restyled)).toEqual([{ id: 'type', label: 'Type', options: [{ id: '2592403', label: 'Warehouses' }] }])
  })

  test('finds an option’s checkbox even when it sits inside nested markup', () => {
    const nested = section(
      'Type',
      '<div class="filter-popup__item" data-filter-type="Type" data-name-readable="Warehouses">' +
        '<div class="wrap"><span>Warehouses</span></div><div><input type="checkbox" value="2592403" name="category"></div></div>',
    )

    expect(parseAdeFilters(nested)[0]?.options).toEqual([{ id: '2592403', label: 'Warehouses' }])
  })

  test('drops control characters from labels, so a scraped name can’t drive the terminal it is logged to', () => {
    const sneaky = section('Type', leaf('Type', 'Ware&#27;[31mhouses', '2592403'))

    expect(parseAdeFilters(sneaky)[0]?.options[0]?.label).toBe('Ware[31mhouses')
  })
})

describe('listedOptions', () => {
  test('returns the options ADE’s API is asked about one by one: the Program group’s', () => {
    expect(listedOptions(GROUPS).map((option) => option.label)).toEqual(['Festival', 'Arts & Culture'])
  })

  test('fails when the page has no Program group, rather than quietly tagging no event with a program', () => {
    expect(() => listedOptions(GROUPS.filter((group) => group.id !== 'program'))).toThrow(/Program/)
  })

  test('fails when Program has more options than ADE offers, so a changed page can’t start a long crawl', () => {
    const many = Array.from({ length: 11 }, (_, index) => ({ id: String(index + 1), label: `Option ${index + 1}` }))

    expect(() => listedOptions([{ id: 'program', label: 'Program', options: many }])).toThrow(/11/)
  })
})

describe('categoryNames', () => {
  test('splits ADE’s category text and decodes entities', () => {
    expect(categoryNames('Nighttime events / Club nights / R&amp;B /  ')).toEqual(['Nighttime events', 'Club nights', 'R&B'])
  })

  test('an event without categories has none', () => {
    expect(categoryNames(null)).toEqual([])
    expect(categoryNames(undefined)).toEqual([])
  })
})

describe('createTagger', () => {
  const tag = createTagger({ groups: GROUPS, members: { '1485951': [7, 8] } })

  test('tags an event with the options its categories name, ignoring case', () => {
    expect(tag(1, ['club NIGHTS', 'Warehouses'])).toEqual(['2528651', '2592403'])
  })

  test('a style also tags its genre family, so choosing the family finds it', () => {
    expect(tag(1, ['Deep House'])).toEqual(['449', '450'])
  })

  test('adds options the event was listed under by the API, such as its program', () => {
    expect(tag(7, ['Techno'])).toEqual(['1485951', '37'])
  })

  test('ignores categories that are not filters, such as city areas', () => {
    expect(tag(1, ['Centre', 'NDSM'])).toEqual([])
  })

  test('an option the API lists is matched by that list only, never by a category with the same name', () => {
    expect(tag(1, ['Festival'])).toEqual([])
    expect(tag(8, [])).toEqual(['1485951'])
  })

  test('lists each option once, even when a style and its family are both named', () => {
    expect(tag(1, ['Deep House', 'House', 'deep house'])).toEqual(['449', '450'])
  })

  test('a label ADE lists in two places tags both, because the category text doesn’t say which', () => {
    const shared: readonly FilterGroup[] = [
      {
        id: 'genre',
        label: 'Genre',
        options: [
          { id: '10', label: 'Trance', children: [{ id: '11', label: 'Progressive' }] },
          { id: '20', label: 'House', children: [{ id: '21', label: 'Progressive' }] },
        ],
      },
    ]

    expect(createTagger({ groups: shared, members: {} })(1, ['Progressive'])).toEqual(['10', '11', '20', '21'])
  })

  test('only whole category names match: "Live" is not "Live Performances"', () => {
    const live: readonly FilterGroup[] = [{ id: 'type', label: 'Type', options: [{ id: '31', label: 'Live Performances' }] }]

    expect(createTagger({ groups: live, members: {} })(1, ['Live'])).toEqual([])
  })
})

describe('usedFilters', () => {
  test('keeps only options some event has, and drops groups left empty', () => {
    const used = usedFilters(GROUPS, new Set(['450', '453', '2592403']))

    expect(used).toEqual([
      { id: 'genre', label: 'Genre', options: [{ id: '450', label: 'House', children: [{ id: '453', label: 'Tech-house' }] }] },
      { id: 'type', label: 'Type', options: [{ id: '2592403', label: 'Warehouses' }] },
    ])
  })

  test('a family with no styles left has no children list', () => {
    expect(usedFilters(GROUPS, new Set(['37']))).toEqual([
      { id: 'genre', label: 'Genre', options: [{ id: '37', label: 'Techno' }] },
    ])
  })
})
