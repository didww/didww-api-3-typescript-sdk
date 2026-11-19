import { createHash } from 'node:crypto';
import { constants, gunzipSync, gzipSync } from 'node:zlib';

// The decompressed size of the first `length` bytes of a gzip member.
function outputOf(member: Buffer, length: number): number {
  return gunzipSync(member.subarray(0, length), { finishFlush: constants.Z_SYNC_FLUSH }).length;
}

// The shortest prefix of `member` that decompresses to at least `size` bytes.
function cutAt(member: Buffer, size: number): number {
  let low = 0;
  let high = member.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (outputOf(member, middle) >= size) high = middle;
    else low = middle + 1;
  }
  return low;
}

/**
 * A CSV of about 26 KB (header `a`, one hex value per line) as a gzip member
 * followed by zero padding, in three parts: the first decompresses to about
 * 7.5 KB, the second takes the output just past 16 KiB, the third is the rest
 * of the member and the padding. Written in this order to a gunzip whose
 * reader has read the output of the first part only, the last write leaves
 * 16 KiB or more unread as the gunzip ends, after which Node 18 never calls
 * the callback of that write.
 */
export function paddedGzipInThreeParts(): { text: string; parts: [Buffer, Buffer, Buffer] } {
  const lines = Array.from({ length: 400 }, (_, i) => createHash('sha256').update(String(i)).digest('hex'));
  const text = `a\n${lines.join('\n')}\n`;
  const member = gzipSync(text);
  const first = cutAt(member, 7500);
  const second = cutAt(member, 16384 + 200);
  const gz = Buffer.concat([member, Buffer.alloc(16)]);
  return { text, parts: [gz.subarray(0, first), gz.subarray(first, second), gz.subarray(second)] };
}
