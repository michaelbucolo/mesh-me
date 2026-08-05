// PLATFORM COLOURS LIVE IN ONE MODULE, AND IT IS NOT THIS ONE.
//
// This file was once "shared types for Mesh page components". By the time the
// canvas was deleted it was a husk: five blank lines, a stray comment, and a
// single constant — PLATFORM_COLORS, a hand-copied table of sixteen brand hex
// literals. Commit 821e3e6 ("Mesh rebuild slice 0: clear the ground") moved
// that table to src/lib/palette.ts and deleted this file outright, for a
// reason that has nothing to do with tidiness:
//
//   Brand colours are the ONE set of literals in this product that are not
//   ours to choose — #1DB954 is Spotify's green whether it suits us or not.
//   The palette doctrine forbids colour literals in the data layers, and
//   scene-model.ts sits inside scripts/palette-check's no-literals scan. The
//   exemption that lets those sixteen hexes exist at all is pinned to
//   src/lib/palette.ts specifically. A second table living out here is a
//   second exemption nobody granted.
//
// Restoring the 66-file canvas verbatim brought this file back, table and all,
// byte-identical to the palette's copy. Byte-identical TODAY. Two tables that
// agree are not one source of truth; they are one source of truth and one
// silent time bomb, and the bomb goes off the first time somebody corrects a
// brand hex in palette.ts — the module the doctrine points at, the module the
// gate reads — and the mesh canvas keeps painting the old colour because it
// was reading a copy that no check has ever looked at.
//
// So the table does not come back. This module forwards, and the mesh canvas
// gets the same object every other surface gets, from the module that owns it.
//
// This file exists at all only because scene-model.ts imports PLATFORM_COLORS
// from here, and that file is not this change's to edit. It should be, and
// then this module should go the way 821e3e6 already sent it once: point
// scene-model.ts at "@/lib/palette" and delete this file. Nothing else in the
// repo references it.

export { PLATFORM_COLORS } from "@/lib/palette";
