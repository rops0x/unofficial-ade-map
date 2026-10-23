import { z } from 'zod'
import { filterOptionIds, FilterGroupsSchema } from '../filters/schema.ts'
import { isHiddenVenueName } from './hidden.ts'

// Generous box around Amsterdam and its ADE satellite venues (Zaandam, Amstelveen, Diemen).
export const AMSTERDAM_BOUNDS = { south: 52.25, north: 52.5, west: 4.7, east: 5.1 } as const

const name = z.string().trim().min(1)
const instant = z.iso.datetime({ offset: true })
const httpUrl = z.url({ protocol: /^https?$/ })

export const VenueSchema = z.object({
  id: z.string().min(1),
  name: name.refine((value) => !isHiddenVenueName(value), 'venue location is not public'),
  address: name.refine((value) => !isHiddenVenueName(value), 'venue location is not public'),
  lat: z.number().min(AMSTERDAM_BOUNDS.south).max(AMSTERDAM_BOUNDS.north),
  lng: z.number().min(AMSTERDAM_BOUNDS.west).max(AMSTERDAM_BOUNDS.east),
})

export const EventSchema = z
  .object({
    id: z.string().min(1),
    name,
    venueId: z.string().min(1),
    start: instant,
    end: instant,
    isEndEstimated: z.boolean(),
    isDaily: z.boolean(),
    sourceUrl: httpUrl,
    /** Ids of the filter options (in `EventData.filters`) this event matches. */
    tags: z.array(z.string().min(1)).optional(),
    /** Sold out when the data was collected. */
    isSoldOut: z.boolean().optional(),
  })
  .refine((event) => Date.parse(event.end) > Date.parse(event.start), {
    message: 'end must be after start',
    path: ['end'],
  })

export const EventDataSchema = z
  .object({
    collectedAt: instant,
    venues: z.array(VenueSchema),
    events: z.array(EventSchema),
    filters: FilterGroupsSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const venueIds = new Set(data.venues.map((venue) => venue.id))
    const seenIds = new Set<string>()
    // FilterGroupsSchema already rejects an option id used twice.
    const knownTags = new Set(filterOptionIds(data.filters ?? []))
    data.events.forEach((event, index) => {
      if (seenIds.has(event.id)) {
        ctx.addIssue({ code: 'custom', message: `duplicate event id ${event.id}`, path: ['events', index, 'id'] })
      }
      seenIds.add(event.id)
      if (!venueIds.has(event.venueId)) {
        ctx.addIssue({ code: 'custom', message: `unknown venue ${event.venueId}`, path: ['events', index, 'venueId'] })
      }
      const unknownTag = event.tags?.find((tag) => !knownTags.has(tag))
      if (unknownTag !== undefined) {
        ctx.addIssue({ code: 'custom', message: `unknown filter option ${unknownTag}`, path: ['events', index, 'tags'] })
      }
    })
  })

export type Venue = z.infer<typeof VenueSchema>
export type MapEvent = z.infer<typeof EventSchema>
export type EventData = z.infer<typeof EventDataSchema>
