# Unofficial ADE map

## Problem
During Amsterdam Dance Event (ADE), parties are spread across many websites and social channels. The official ADE listing is the only place that gathers them, and it leaves many out, especially pop-ups. Festival-goers and locals moving between venues can't easily see what's happening near them right now, so they miss good events.

## Evidence
- Founder-observed, not yet measured. The ADE 2026 pilot is the validation.
- People, the founder and friends included, hear about good events only after they've happened.
- Pop-up parties run during ADE that don't appear on the official ADE list.
- People ask "what's on near me right now?" in group chats and on social media.
- Current workarounds: screenshots, shared spreadsheets, WhatsApp groups.

## Users
- **Primary**: Festival-goers in Amsterdam during ADE who want to find a party near them, often right now, on their phone.
- **Primary**: Locals moving between venues over the ADE nights.
- **Secondary (submitters)**: Anyone who knows of a pop-up event, whether organiser or attendee, and wants it on the map.
- **Operator**: The founder, who reviews and approves submitted pop-ups.
- **Not for**: People looking to buy tickets (the map links out); visitors to festivals other than ADE.

## Hypothesis
We believe **a live map of ADE parties (official events plus approved community-submitted pop-ups) that can be viewed at any moment of the festival** will **help people find parties near them and miss fewer good events** for **festival-goers and locals moving between venues**.
We'll know we're right when **the site reaches 100 unique visitors and receives 10 pop-up submissions during ADE 2026**.

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| Unique visitors during ADE 2026 | 100 | Site visitor count |
| Pop-up events submitted | 10 | Count of submissions received, approved or not |

## Scope
**MVP**
- A map of Amsterdam that opens on the events happening right now. If the page is opened before the first event starts, it opens at the first event's start time instead. After ADE has ended, it says "See you in 2027!"
- Shows the visitor's own location on the map if they allow it. The map works without it.
- A time control: pick any other moment during ADE and see what's on then.
- Each event shows name, venue, start and end time, and a link to its source.
- Official events: everything on the official ADE website, collected repeatedly during the event (plus Amsterdam venue listings if time allows). Each event must link to a public event page as proof it's happening. If no end time is listed, assume 8 hours.
- Underground events stay hidden: only publicly listed events with a public venue are shown. Secret or "TBA" locations are never pinned.
- A public form for submitting a pop-up event. Submissions appear on the map only after the founder approves them.
- Works well on a phone.
- Named "Unofficial ADE map".

**Out of scope**
- Ticket sales: link out to the organiser instead.
- User accounts: not needed to browse or submit.
- Favourites, sharing and other social features: not needed to test the hypothesis.
- Native app: a mobile website reaches people fastest within a week.
- Recommendations: not needed to test the hypothesis.
- Festivals other than ADE: the pilot covers ADE 2026 only.

## Delivery Milestones
<!-- Business outcomes, not engineering tasks. /plan turns each into a plan. -->
<!-- Status: pending | in-progress | complete -->

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Live map of official events | Visitors see official ADE and venue events on a map that opens on "now" (or on the first event, before ADE starts), see where they are, and can change the time | in-progress | `.claude/plans/unofficial-ade-map-m1-live-map.plan.md` |
| 2 | Pop-up submissions | Anyone can submit a pop-up; once the founder approves it, it appears on the map | pending | — |
| 3 | Launch | The site is public and shared in the founder's networks before ADE opens | pending | — |
| 4 | Pilot review | Visitor and submission counts are compared with targets and a decision is made on next year | pending | — |

## Open Questions
- [ ] The exact ADE 2026 dates and hours the time control must cover.
- [x] Does the official ADE website allow its listings to be collected automatically? The founder believes so, but this isn't yet checked against the site's terms. A one-time collection before launch is enough.
- [ ] Which Amsterdam venues to include, and whether their listings need checking more than once.
- [x] Should the map show the visitor's own location ("near me")? Yes.
- [x] What should the map open on after ADE has ended? A "See you in 2027!" message.
- [ ] What must a pop-up submission include for the founder to approve it? Partly answered: a link to a public event page or other proof it's happening, and a public venue (underground events stay hidden). Other required fields still open.
- [x] How are time changes and cancellations reflected once an event is on the map? ADE events: by re-collecting the ADE website during the event. Every event also links to its source.

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| About one week until ADE opens (from 17 Oct 2026) | High | High | Hold to the MVP; if time runs short, launch milestone 1 first and add submissions in the festival's first days |
| The official ADE site doesn't allow collection | Low (founder's view) | High | Check its terms before collecting; enter the biggest events by hand as a fallback |
| Event information goes out of date (time changes, cancellations) | Medium | Medium | Re-collect the ADE website during the event; link every event to its source so visitors can check |
| Mistaken for the official ADE site, or a brand complaint | Low | Medium | "Unofficial" in the name, plus a visible note that the site isn't affiliated with ADE |
| Fewer than 100 visitors | Medium | Medium | Share in the founder's networks before ADE opens |
| Submissions wait for approval while the founder is out at events | Medium | Medium | Check the approval queue at set times each day |
| Fake or spam submissions | Low (founder's view) | Low | Every submission is approved before it appears |

---
*Status: DRAFT — requirements only. Implementation planning pending via /plan.*
