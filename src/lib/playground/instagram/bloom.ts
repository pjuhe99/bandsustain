// 직렬화 포맷: "BSBF"(4) + version u8 + k u8 + m u32LE + count u32LE + bits
const MAGIC = [0x42, 0x53, 0x42, 0x46]; // "BSBF"
const VERSION = 1;
const HEADER_BYTES = 14;

export type BloomFilter = { m: number; k: number; count: number; bits: Uint8Array };

function fnv1a(s: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function bitIndexes(f: BloomFilter, s: string): number[] {
  const h1 = fnv1a(s);
  let h2 = fnv1a(s, 0x9747b28c);
  if (h2 === 0) h2 = 0x27d4eb2f;
  const out: number[] = [];
  for (let i = 0; i < f.k; i++) out.push((h1 + i * h2) % f.m); // double hashing — h1+i*h2 mod m
  return out;
}

export function createBloom(n: number, p = 0.01): BloomFilter {
  const m = Math.ceil((-n * Math.log(p)) / (Math.LN2 * Math.LN2));
  const k = Math.max(1, Math.round((m / n) * Math.LN2));
  return { m, k, count: 0, bits: new Uint8Array(Math.ceil(m / 8)) };
}

export function bloomAdd(f: BloomFilter, s: string): void {
  for (const idx of bitIndexes(f, s)) f.bits[idx >> 3] |= 1 << (idx & 7);
  f.count++;
}

export function bloomHas(f: BloomFilter, s: string): boolean {
  return bitIndexes(f, s).every((idx) => (f.bits[idx >> 3] & (1 << (idx & 7))) !== 0);
}

export function serializeBloom(f: BloomFilter): Uint8Array {
  const out = new Uint8Array(HEADER_BYTES + f.bits.length);
  out.set(MAGIC, 0);
  out[4] = VERSION;
  out[5] = f.k;
  new DataView(out.buffer).setUint32(6, f.m, true);
  new DataView(out.buffer).setUint32(10, f.count, true);
  out.set(f.bits, HEADER_BYTES);
  return out;
}

export function deserializeBloom(input: ArrayBuffer | Uint8Array): BloomFilter {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (buf.length < HEADER_BYTES || MAGIC.some((b, i) => buf[i] !== b)) {
    throw new Error("invalid bloom filter: bad magic");
  }
  if (buf[4] !== VERSION) throw new Error(`invalid bloom filter: version ${buf[4]}`);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const k = buf[5];
  const m = view.getUint32(6, true);
  const count = view.getUint32(10, true);
  const bits = buf.slice(HEADER_BYTES);
  if (bits.length !== Math.ceil(m / 8)) throw new Error("invalid bloom filter: size mismatch");
  return { m, k, count, bits };
}
