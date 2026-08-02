// THE REPAIR THAT MUST NOT DAMAGE THE TEXT IT IS REPAIRING.
//
// Meta's JSON exports have a long-standing bug: the UTF-8 BYTES of every string
// are written out as if each byte were a separate Latin-1 character. A caption
// reading "café" ships as "cafÃ©", because the two bytes C3 A9 became the two
// characters Ã and ©. An emoji fares worse — 😀 is four bytes, so it arrives as
// four characters, three of which are C1 control codes with no glyph at all.
//
// Left alone, someone imports their history and finds every accent, every
// emoji, and every curly apostrophe they ever typed replaced with garbage.
//
// ── THE DANGEROUS HALF ──────────────────────────────────────────────────────
//
// The repair is easy. Knowing WHEN to apply it is the whole problem, because
// the same operation run on text that was never broken destroys it. Turkish,
// Vietnamese, Portuguese and Nordic captions are full of the exact characters
// this transformation consumes. A decoder that repairs eagerly trades a visible
// bug affecting Meta imports for an invisible one affecting everybody else, and
// the second is far worse: the user can SEE mojibake and re-export, but silently
// mangled text looks like something they typed.
//
// So this refuses unless the evidence is conclusive, and the load-bearing
// evidence is STRICT UTF-8 VALIDATION — not a list of suspicious characters.
//
// Read the string's code units as bytes and ask whether that byte sequence is
// well-formed UTF-8. Genuine Latin-1 text almost never is: "é" is byte E9, which
// announces a three-byte sequence, and in real text the next character is a
// space or a letter rather than the two continuation bytes UTF-8 demands. The
// sequence falls apart immediately. Mojibake, by construction, is always
// perfectly well-formed UTF-8 — it IS UTF-8, just misread. That asymmetry is
// sharper than any heuristic about which characters look suspicious, and it is
// what this module leans on.
//
// Three conditions, all required:
//
//   1. Every code unit is <= 0xFF. A string containing real Unicode (or the
//      surrogate halves of a real emoji) was never a misread byte sequence, so
//      there is nothing here to repair.
//   2. At least one byte is >= 0x80. Pure ASCII decodes to itself; skipping it
//      early keeps the common case free and the intent obvious.
//   3. The bytes are STRICTLY valid UTF-8 — TextDecoder in fatal mode, which
//      rejects overlong forms, lone surrogates and truncated sequences.
//
// Anything that fails is returned untouched. The bias is deliberate and one
// directional: leaving mojibake alone shows the user a problem they can act on,
// while a wrong repair hands them corruption they cannot even detect.
//
// ── WHAT THIS CANNOT DO, STATED PLAINLY ─────────────────────────────────────
//
// A string whose genuine content is exactly a well-formed mojibake sequence is
// indistinguishable from the mangling, and will be repaired. "Ã©" becomes "é"
// whether or not that is what the author typed. This is accepted rather than
// worked around: writing a capital A-tilde immediately followed by a copyright
// sign is not something that happens in a caption, and every alternative rule
// costs real accented text somewhere.
//
// Mixed strings are also out of scope. If part of a caption is mangled and part
// is already correct, condition 1 sees the correct part and the whole string is
// left alone. That is the safe direction — half-repaired text would be worse
// than untouched text, and the user can still read what they wrote.
//
// ── WHY REPEATING IS SAFE HERE ──────────────────────────────────────────────
//
// Meta has shipped doubly-encoded strings, where the mangling was applied twice.
// Repeating the repair sounds reckless, but the three conditions make it
// self-limiting: a correctly repaired string is almost never still valid UTF-8
// when re-read as bytes. "cafÃ©" repairs to "café", whose only high byte is E9,
// a lead byte with no continuations — invalid, so the loop stops on its own. The
// cap below is a backstop against pathological input, not the actual mechanism.

/** Text plus what was done to it. The count is reported, never assumed. */
export type DecodedText = {
  /** The text as it should read. Identical to the input when nothing applied. */
  text: string;
  /**
   * How many repair passes were applied. 0 means the text was already correct —
   * which is the answer for every platform except Meta, and must stay cheap.
   */
  repairs: number;
};

/**
 * More than this and the input is pathological rather than doubly-encoded. Meta
 * has shipped two layers; three would be a new bug worth seeing rather than
 * silently unwinding.
 */
const MAX_PASSES = 3;

const STRICT_UTF8 = new TextDecoder("utf-8", { fatal: true });

/**
 * One pass, or null if this string fails any of the three conditions.
 *
 * Returning null rather than the input makes "nothing to do" impossible to
 * confuse with "repaired to the same value" at the call site below.
 */
function repairOnce(text: string): string | null {
  const bytes = new Uint8Array(text.length);
  let sawHighByte = false;

  for (let i = 0; i < text.length; i += 1) {
    const unit = text.charCodeAt(i);
    // Condition 1. Real Unicode, or half of a surrogate pair, means this string
    // is not a misread byte sequence and must not be treated as one.
    if (unit > 0xff) return null;
    if (unit >= 0x80) sawHighByte = true;
    bytes[i] = unit;
  }

  // Condition 2, and it is what makes the loop terminate rather than merely
  // making the common case fast. Pure ASCII is valid UTF-8 that decodes to
  // ITSELF, so without this the decode below keeps "succeeding" at a
  // transformation that changes nothing, and every ASCII caption runs to the
  // pass cap and reports repairs on text nobody touched.
  //
  // A high byte cannot do that. It is only valid UTF-8 as part of a multi-byte
  // sequence, and every such sequence collapses to fewer code units than it
  // occupied — so once one is present a successful decode is strictly shorter
  // than its input, and progress is always real. That asymmetry is why one
  // check is enough here and a second "did it actually change?" test would be
  // unreachable code pretending to be a safeguard.
  if (!sawHighByte) return null;

  // Condition 3, and the one carrying the argument. Fatal mode is the point:
  // the default replaces bad bytes with U+FFFD, which would turn "did not
  // decode" into "decoded, with damage" and defeat the entire check.
  try {
    return STRICT_UTF8.decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Repair Meta's UTF-8-as-Latin-1 mangling, if and only if that is provably what
 * happened. Pure: no I/O, no configuration, same answer every time.
 */
export function decodeExportText(text: string): DecodedText {
  let current = text;
  let repairs = 0;

  while (repairs < MAX_PASSES) {
    const next = repairOnce(current);
    if (next === null) break;
    current = next;
    repairs += 1;
  }

  return { text: current, repairs };
}
