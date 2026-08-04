// THE LAND, drawn coarsely on purpose.
//
// A deliberately low-detail coastline in unit map space scaled to a 1000×1000
// box — enough to answer "roughly where in the world is this", and nowhere
// near enough to answer "which street". That is the right amount of map for
// MeshiMap: pins are already snapped to cells a kilometre across, so a
// street-accurate basemap under them would only imply a precision the data
// does not have.
//
// ── WHY THIS IS NOT A TILE SERVICE ─────────────────────────────────────────
//
// Every pan and zoom on a tiled map is a request telling the tile host where
// the user is looking. Building a location feature around not knowing where
// people are, and then handing a third party a live feed of exactly that, is
// self-defeating. A static path ships with the bundle and phones nobody.
//
// Coordinates are Web Mercator unit space × 1000: x = (lng+180)/360, and
// y from the Mercator latitude formula — the same projection meshimap/project
// uses, so the coastline and the pins can never disagree about where a
// coordinate is.

/** Continent outlines, ~1000×1000 unit-map-space. */
export const WORLD_PATH = [
  // North America
  "M 130 175 L 200 165 L 265 172 L 300 190 L 292 232 L 268 250 L 275 285 L 250 300 L 230 330 L 205 345 L 195 375 L 175 360 L 168 320 L 148 300 L 140 265 L 118 240 L 112 205 Z",
  // Central America into the isthmus
  "M 230 335 L 258 352 L 272 372 L 262 380 L 240 362 L 224 345 Z",
  // South America
  "M 272 385 L 305 378 L 330 400 L 338 445 L 325 495 L 305 545 L 288 585 L 272 600 L 262 570 L 268 520 L 258 470 L 262 425 Z",
  // Greenland
  "M 330 120 L 375 112 L 395 138 L 380 172 L 345 178 L 328 152 Z",
  // Africa
  "M 470 340 L 520 330 L 560 340 L 575 372 L 565 420 L 545 470 L 525 520 L 505 552 L 488 530 L 480 480 L 468 430 L 462 385 Z",
  // Europe
  "M 470 205 L 520 195 L 548 208 L 545 240 L 520 262 L 492 268 L 472 250 L 462 228 Z",
  // Asia
  "M 552 185 L 640 165 L 720 168 L 790 185 L 820 215 L 812 258 L 782 288 L 740 300 L 700 292 L 660 300 L 622 288 L 588 262 L 562 232 Z",
  // India
  "M 660 302 L 692 300 L 700 335 L 682 372 L 665 345 Z",
  // South-east Asia and the archipelago
  "M 712 315 L 760 320 L 795 340 L 812 372 L 782 388 L 742 375 L 718 350 Z",
  // Australia
  "M 790 452 L 848 445 L 882 470 L 876 512 L 840 532 L 800 522 L 782 490 Z",
  // New Zealand
  "M 900 520 L 918 512 L 928 538 L 912 558 L 898 542 Z",
  // Antarctica — a band, because Mercator makes it one
  "M 60 700 L 940 700 L 940 760 L 60 760 Z",
].join(" ");
