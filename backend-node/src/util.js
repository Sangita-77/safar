import crypto from "node:crypto";

export class HttpError extends Error {
  constructor(status, detail) {
    super(typeof detail === "string" ? detail : "Validation error");
    this.status = status;
    this.detail = detail;
  }
}

export function parse(schema, data, where = "body") {
  const r = schema.safeParse(data ?? {});
  if (!r.success) {
    throw new HttpError(422, r.error.issues.map((i) => ({ loc: [where, ...i.path], msg: i.message, type: i.code })));
  }
  return r.data;
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export const randInt = (lo, hi) => crypto.randomInt(lo, hi + 1);

// Python's round(): half to even, so fares match the original backend exactly.
export function pyRound(n, digits = 0) {
  const m = 10 ** digits;
  const v = n * m;
  let r = Math.round(v);
  if (Math.abs(v % 1) === 0.5) r = 2 * Math.round(v / 2);
  return r / m;
}
