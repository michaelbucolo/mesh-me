# The mesh, rebuilt

> "The mesh looks cheap and feels useless. Redo everything from the ground up.
> I mean EVERYTHING. Don't reuse a single ui element for the mesh except meshi."

Two complaints, and they are not the same complaint. A restyle fixes neither on
its own, because the second one is about what the surface *does*.

This is the record of what was wrong, with evidence, and what replaces it.

---

## 1. What was actually on screen

Driven against a seeded build at 1440×900 and 390×844, signed in, first-visit
tips dismissed so the photograph was of the mesh and not of a modal scrim.

### Why it looked cheap

1. **Eight identical blue discs with a single letter in each.** S, D, J, N, R,
   L, M, A. These are default-avatar initials. The people on your mesh — the
   single thing the surface is supposedly about — were rendered as
   indistinguishable blobs.
2. **Content cards nobody can read.** ~10px muted grey on near-black, truncated
   mid-word: *"The future of social media isn't about more conten…"*. Eleven of
   them on screen, none legible. They function as grey noise with the texture of
   text.
3. **Hairline dotted connectors.** Uniform, low-contrast, conveying no weight or
   meaning — decoration in the shape of a data structure.
4. **A floating panel that collides with the world.** The right-hand rail sat
   over the canvas and clipped the cards behind it (`@riley…` cut in half).
   Two content surfaces competing for the same pixels.
5. **Vast dead space.** The entire left third and bottom-left were empty black.
6. **One material for everything.** Every element was the same grey rounded
   rectangle at the same elevation. No hierarchy, no depth, no craft.

On a phone it was worse: the panel covered roughly 60% of the viewport, the
centre of the mesh was not visible at all, and cards were clipped at both edges.

### Why it felt useless

1. **The centre of the mesh was you.** The most prominent, most protected
   position on the surface was spent on the one fact the viewer already knows.
2. **The headline number was zero.** "Your pulse — **0** new for you." A
   dashboard whose primary metric is nothing.
3. **"Active now — Quiet right now."** The live-social promise, empty.
4. **The content was nine days old** and presented as a living world.
5. **Position encoded closeness**, which is not actionable. Knowing that Jordan
   sits nearer than Naomi does not give you anything to do.
6. **Every control was navigation.** Find, List, Centre, Create. Nothing on the
   mesh could be *acted on* where it sat; it could only be opened somewhere
   else.

The old dock's own header says it plainly:

> *"It cannot make the mesh worth steering. A dock is the handle; whether there
> is anything in the world to find is decided upstream."*

That was true, and it is the thing being fixed.

---

## 2. What the mesh is now

**The mesh is the one surface that can answer a question no single platform
can: what, across everything I use, actually wants me right now.**

Instagram cannot tell you a Twitter DM is unanswered. YouTube cannot tell you a
reply is waiting on Reddit. That cross-platform triage is the only thing this
surface can do that the platforms it aggregates cannot do for themselves, and it
is therefore the only honest reason for it to be the home tab.

So the organising principle changes:

| | Old | New |
|---|---|---|
| Position means | closeness of a relationship | **how much this wants you** |
| Centre holds | you | **Meshi, reading the field** |
| A node is | a thing you already follow | **a thing you can act on** |
| Empty state | "0 new for you" | **a surface that admits it and offers the best thing available** |

### Rings — distance is urgency

- **Core.** Meshi. The one element carried over, and now the only thing at the
  centre: it reads the field and names the single most worthwhile action.
- **Ring 1 — Needs you.** Unanswered messages, mentions, replies awaiting you,
  across every connected platform. Warm, lit, unmissable.
- **Ring 2 — Happening.** People genuinely active now; conversations in motion.
- **Ring 3 — New.** Unseen work from people you actually engage with, newest
  nearest.
- **Field.** Everything else: dim, cool, searchable, and never competing with
  the rings for attention.

### Every node carries its verb

Not "open detail". **Reply.** **Watch.** **Join.** The verb is visible on the
node at rest, because a surface where every action costs a click to discover is
a surface people stop steering.

---

## 3. Rules this rebuild is held to

1. **No unreadable text, ever.** If a caption does not fit at a legible size,
   show fewer cards. Never render text as texture.
2. **No identical nodes.** A person is their face. If there is no photo there is
   a generated mark that differs per person — never a letter in a blue circle.
3. **Nothing overlaps the world.** Panels do not float over the field. The field
   yields space to them, or they are not open.
4. **The empty state is designed, not reported.** "Nothing needs you" is a good
   outcome and should look like one. A zero in a stat row is a bug report.
5. **Colour carries meaning.** Warmth is urgency; platform identity is hue.
   Decorative colour is not allowed to compete with either.
6. **Mobile is the primary form factor**, not a narrowed desktop. Anything that
   cannot survive 390×844 does not ship.
7. **Meshi is the only carried-over element.** Everything else in this surface
   is new: layout, materials, type, motion, controls, overlays.

---

## 4. Sequencing

Rebuilt in verified slices, newest first in `src/components/meshfield/`. The old
`src/components/mesh/ui/*` is deleted as each replacement lands, so there is
never a period where both exist and one is quietly dead.

The engine-level pieces (camera maths, spatial hashing, hit testing) are written
fresh for the ring model rather than adapted, because a radial fan and a set of
concentric urgency bands do not want the same layout, the same hit ordering, or
the same motion.
