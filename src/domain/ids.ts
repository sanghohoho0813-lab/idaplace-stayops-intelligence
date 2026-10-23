const ALPHABET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function randomBytes(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  globalThis.crypto.getRandomValues(arr);
  return arr;
}

export function randomString(len: number): string {
  const bytes = randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

export function uid(prefix: string): string {
  return `${prefix}_${randomString(10)}`;
}

/** 체크인 링크용 예약 토큰 — 추측 불가능한 난수. 도어락 명령·PIN을 담지 않는다. */
export function guestToken(): string {
  return randomString(24);
}

export function digits(len: number): string {
  const bytes = randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += String(bytes[i] % 10);
  return s;
}
