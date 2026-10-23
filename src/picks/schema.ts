import { z } from 'zod'

// A note is a line under the event name in a narrow popup, not a review.
export const PICK_NOTE_MAX_LENGTH = 140

const text = z.string().trim().min(1)

/** Where a pick came from, e.g. one of r/amsterdam_rave's daily previews. Every pick credits one. */
export const PickSourceSchema = z.object({
  id: z.string().min(1),
  name: text,
  title: text,
  url: z.url({ protocol: /^https?$/ }),
})

export const PickSchema = z.object({
  eventId: z.string().min(1),
  sourceId: z.string().min(1),
  note: text.max(PICK_NOTE_MAX_LENGTH).optional(),
})

export const PicksDataSchema = z
  .object({
    sources: z.array(PickSourceSchema),
    picks: z.array(PickSchema),
  })
  .superRefine((data, ctx) => {
    const sourceIds = new Set<string>()
    data.sources.forEach((source, index) => {
      if (sourceIds.has(source.id)) {
        ctx.addIssue({ code: 'custom', message: `duplicate source id ${source.id}`, path: ['sources', index, 'id'] })
      }
      sourceIds.add(source.id)
    })
    const pickedIds = new Set<string>()
    data.picks.forEach((pick, index) => {
      if (!sourceIds.has(pick.sourceId)) {
        ctx.addIssue({ code: 'custom', message: `unknown source ${pick.sourceId}`, path: ['picks', index, 'sourceId'] })
      }
      if (pickedIds.has(pick.eventId)) {
        ctx.addIssue({ code: 'custom', message: `event ${pick.eventId} is picked twice`, path: ['picks', index, 'eventId'] })
      }
      pickedIds.add(pick.eventId)
    })
  })

export type PickSource = z.infer<typeof PickSourceSchema>
export type Pick = z.infer<typeof PickSchema>
export type PicksData = z.infer<typeof PicksDataSchema>
