// One-time migration: wipe all old-model events (per-user blotters) ahead of
// the exchange model. User accounts are untouched.
// Usage: node scripts/clear-events.mjs
import { readFileSync } from "node:fs";
import { Redis } from "@upstash/redis";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")])
);

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

const patterns = [
  "pushups:event:*",
  "pushups:userevents:*",
  "pushups:events",
  "pushups:market:*",
  "pushups:tape",
];

let total = 0;
for (const p of patterns) {
  const keys = await redis.keys(p);
  if (keys.length) {
    await Promise.all(keys.map((k) => redis.del(k)));
    console.log(`deleted ${keys.length} key(s) matching ${p}`);
    total += keys.length;
  }
}
const users = await redis.keys("pushups:user:*");
console.log(`done — ${total} keys removed; ${users.length} user account keys untouched`);
