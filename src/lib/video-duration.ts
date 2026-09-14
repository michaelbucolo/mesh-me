/** Read container metadata without decoding media or trusting client fields.
 * MP4/MOV: moov/mvhd (ISO BMFF). WebM: Segment/Info/Duration (Matroska).
 * Missing, fragmented-only or malformed metadata stays unknown, never short.
 */
export function readVideoDuration(bytes: Uint8Array, mime: string): number | null {
  if (bytes.length < 8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let remaining = 4096;
  const positive = (value: number) => Number.isFinite(value) && value > 0 ? value : null;

  if (mime === "video/mp4" || mime === "video/quicktime") {
    const boxes = (start: number, end: number, insideMovie: boolean): number | null => {
      for (let offset = start; offset < end;) {
        if (--remaining < 0 || end - offset < 8) return null;
        let size = view.getUint32(offset);
        let header = 8;
        if (size === 1) {
          if (end - offset < 16) return null;
          const extended = view.getBigUint64(offset + 8);
          if (extended > BigInt(Number.MAX_SAFE_INTEGER)) return null;
          size = Number(extended);
          header = 16;
        } else if (size === 0) size = end - offset;
        if (size < header || size > end - offset) return null;
        const type = view.getUint32(offset + 4);
        const body = offset + header;
        if (!insideMovie && type === 0x6d6f6f76) return boxes(body, offset + size, true); // moov
        if (insideMovie && type === 0x6d766864) { // mvhd
          if (size - header < 20) return null;
          const version = bytes[body];
          if (version !== 0 && version !== 1) return null;
          if (version === 1 && size - header < 32) return null;
          const scale = view.getUint32(body + (version === 1 ? 20 : 12));
          const ticks = version === 1 ? view.getBigUint64(body + 24) : BigInt(view.getUint32(body + 16));
          if (!scale || ticks === (version === 1 ? BigInt("0xffffffffffffffff") : BigInt("0xffffffff")) || ticks > BigInt(Number.MAX_SAFE_INTEGER)) return null;
          return positive(Number(ticks) / scale);
        }
        offset += size;
      }
      return null;
    };
    return boxes(0, bytes.length, false);
  }

  if (mime !== "video/webm") return null;
  const vint = (offset: number, end: number, isId: boolean) => {
    if (offset >= end || bytes[offset] === 0) return null;
    let length = 1;
    let mask = 0x80;
    while (!(bytes[offset] & mask)) { length++; mask >>= 1; }
    if (length > (isId ? 4 : 8) || offset + length > end) return null;
    let value = BigInt(isId ? bytes[offset] : bytes[offset] & (mask - 1));
    for (let i = 1; i < length; i++) value = (value << BigInt(8)) | BigInt(bytes[offset + i]);
    const unknown = !isId && value === (BigInt(1) << BigInt(7 * length)) - BigInt(1);
    if (!unknown && value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return { length, value: unknown ? 0 : Number(value), unknown };
  };
  const elements = (start: number, end: number, level: "root" | "segment" | "info"): number | null => {
    let scale = 1_000_000;
    let duration: number | null = null;
    for (let offset = start; offset < end;) {
      if (--remaining < 0) return null;
      const id = vint(offset, end, true);
      if (!id) return null;
      const size = vint(offset + id.length, end, false);
      if (!size) return null;
      const body = offset + id.length + size.length;
      // Only Segment can safely extend to EOF without traversing children.
      if (size.unknown && !(level === "root" && id.value === 0x18538067)) return null;
      const stop = size.unknown ? end : body + size.value;
      if (stop > end || stop < body) return null;
      if (level === "root" && id.value === 0x18538067) return elements(body, stop, "segment");
      if (level === "segment" && id.value === 0x1549a966) return elements(body, stop, "info");
      if (level === "info" && id.value === 0x2ad7b1) {
        if (size.value < 1 || size.value > 8) return null;
        let value = BigInt(0);
        for (let i = body; i < stop; i++) value = (value << BigInt(8)) | BigInt(bytes[i]);
        if (value === BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
        scale = Number(value);
      }
      if (level === "info" && id.value === 0x4489) {
        if (size.value !== 4 && size.value !== 8) return null;
        duration = positive(size.value === 4 ? view.getFloat32(body) : view.getFloat64(body));
        if (duration === null) return null;
      }
      offset = stop;
    }
    return duration === null ? null : positive(duration * scale / 1_000_000_000);
  };
  return elements(0, bytes.length, "root");
}

/** A mixed post is short only if every attached video has a known duration. */
export function nativeVideoDuration(media: { type: string; durationSeconds?: number | null }[]): number | null {
  const videos = media.filter((item) => item.type === "video");
  if (!videos.length || videos.some((item) => !Number.isFinite(item.durationSeconds) || (item.durationSeconds ?? 0) <= 0)) return null;
  return Math.max(...videos.map((item) => item.durationSeconds!));
}
