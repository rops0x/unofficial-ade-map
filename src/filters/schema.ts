import { z } from 'zod'

// The filters ADE's own program page offers (Program, Genre, Type), as collected from it.
// Option ids are ADE's category ids, so an event's `tags` name the options it matches.

const label = z.string().trim().min(1)
// The collector also sends an id back to ADE's API as `category=`, so it must be a single number.
const categoryId = z.string().regex(/^\d+$/, 'not an ADE category id')

export const FilterChoiceSchema = z.object({ id: categoryId, label })

/** A genre family (House, Techno, …) has styles (Deep House, …); other options have none. */
export const FilterOptionSchema = FilterChoiceSchema.extend({ children: z.array(FilterChoiceSchema).min(1).optional() })

export const FilterGroupSchema = z.object({ id: z.string().min(1), label, options: z.array(FilterOptionSchema).min(1) })

export type FilterChoice = z.infer<typeof FilterChoiceSchema>
export type FilterOption = z.infer<typeof FilterOptionSchema>
export type FilterGroup = z.infer<typeof FilterGroupSchema>

/** Every option id in the groups, styles included. */
export function filterOptionIds(groups: readonly FilterGroup[]): readonly string[] {
  return groups.flatMap((group) => group.options.flatMap((option) => [option.id, ...(option.children ?? []).map((child) => child.id)]))
}

const repeated = (values: readonly string[]): readonly string[] => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]

/** A visitor's choices are kept per group id, and an event's tags name option ids, so both must be unique. */
export const FilterGroupsSchema = z.array(FilterGroupSchema).superRefine((groups, ctx) => {
  repeated(groups.map((group) => group.id)).forEach((id) => ctx.addIssue({ code: 'custom', message: `filter group ${id} is listed twice` }))
  repeated(filterOptionIds(groups)).forEach((id) => ctx.addIssue({ code: 'custom', message: `filter option id ${id} is used twice` }))
})
