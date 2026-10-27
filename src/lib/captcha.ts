import "server-only";
import { dbGet, dbRun } from "@/lib/db";
import { createId, safeEqual, sha256 } from "@/lib/ids";
import { normalizeCaptchaAnswer } from "@/lib/validators";

const CAPTCHA_TTL = 10 * 60 * 1000;
const FORM_MIN = 2_000;
const FORM_MAX = 2 * 60 * 60 * 1000;

const SEGMENTS: Record<string, string> = {
  "0": "abcfed",
  "1": "bc",
  "2": "abged",
  "3": "abgcd",
  "4": "fgbc",
  "5": "afgcd",
  "6": "afgedc",
  "7": "abc",
  "8": "abcdefg",
  "9": "abfgcd",
};

function segmentMarkup(mask: string, x: number, y: number) {
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${x + x1}" y1="${y + y1}" x2="${x + x2}" y2="${y + y2}" />`;
  const parts: string[] = [];
  if (mask.includes("a")) parts.push(line(8, 6, 28, 6));
  if (mask.includes("b")) parts.push(line(28, 8, 28, 26));
  if (mask.includes("c")) parts.push(line(28, 30, 28, 48));
  if (mask.includes("d")) parts.push(line(8, 50, 28, 50));
  if (mask.includes("e")) parts.push(line(6, 30, 6, 48));
  if (mask.includes("f")) parts.push(line(6, 8, 6, 26));
  if (mask.includes("g")) parts.push(line(8, 28, 28, 28));
  return parts.join("");
}

function renderCaptcha(left: number, right: number) {
  const tilt = (digit: number, index: number) => {
    const angle = ((left * 3 + right * 5 + index * 7) % 9) - 4;
    const x = index === 0 ? 12 : 104;
    return `<g transform="rotate(${angle} ${x + 16} 32)" stroke="#1f4d38" stroke-width="5" stroke-linecap="round" fill="none">${segmentMarkup(SEGMENTS[String(digit)] ?? SEGMENTS["0"], x, 4)}</g>`;
  };
  const noise = Array.from({ length: 5 }, (_, index) => {
    const y = 8 + ((left * 11 + right * 3 + index * 13) % 48);
    const x2 = 20 + ((index * 37 + right) % 120);
    return `<line x1="${4 + index * 8}" y1="${y}" x2="${x2}" y2="${(y + 17) % 56}" stroke="#1f4d38" stroke-opacity="0.18" />`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="168" height="64" viewBox="0 0 168 64" role="img" aria-label="验证码算式">
    <rect width="168" height="64" rx="8" fill="#f3efe4"/>
    ${noise}
    ${tilt(left, 0)}
    <g stroke="#1f4d38" stroke-width="5" stroke-linecap="round">
      <line x1="74" y1="32" x2="94" y2="32"/>
      <line x1="84" y1="22" x2="84" y2="42"/>
    </g>
    ${tilt(right, 1)}
  </svg>`;
}

async function cleanupChallenges(now = Date.now()) {
  await dbRun("DELETE FROM captcha_challenges WHERE expires_at < ?", [now - 60_000]);
  await dbRun("DELETE FROM form_tokens WHERE issued_at < ?", [now - FORM_MAX]);
}

export async function createCaptcha() {
  const now = Date.now();
  await cleanupChallenges(now);
  const left = 2 + Math.floor(Math.random() * 8);
  const right = 2 + Math.floor(Math.random() * 8);
  const id = createId(16);
  const answer = String(left + right);
  await dbRun(
    "INSERT INTO captcha_challenges (id, answer_hash, expires_at) VALUES (?, ?, ?)",
    [id, sha256(`${id}:${answer}`), now + CAPTCHA_TTL],
  );
  return { id, svg: renderCaptcha(left, right) };
}

export async function consumeCaptcha(id: string, answer: string) {
  const row = await dbGet<{ answer_hash: string; expires_at: number; used_at: number | null }>(
    "SELECT answer_hash, expires_at, used_at FROM captcha_challenges WHERE id = ?",
    [id],
  );
  if (!row || row.used_at || row.expires_at < Date.now()) return false;
  await dbRun("UPDATE captcha_challenges SET used_at = ? WHERE id = ?", [Date.now(), id]);
  const normalized = normalizeCaptchaAnswer(answer);
  return safeEqual(sha256(`${id}:${normalized}`), row.answer_hash);
}

export async function createFormToken() {
  const id = createId(18);
  const now = Date.now();
  await dbRun("INSERT INTO form_tokens (id, issued_at) VALUES (?, ?)", [id, now]);
  return id;
}

export async function consumeFormToken(id: string) {
  const row = await dbGet<{ issued_at: number; used_at: number | null }>(
    "SELECT issued_at, used_at FROM form_tokens WHERE id = ?",
    [id],
  );
  if (!row || row.used_at) return "invalid" as const;
  await dbRun("UPDATE form_tokens SET used_at = ? WHERE id = ?", [Date.now(), id]);
  const elapsed = Date.now() - row.issued_at;
  if (elapsed < FORM_MIN) return "fast" as const;
  if (elapsed > FORM_MAX) return "expired" as const;
  return "ok" as const;
}
