import { redis, resetKey } from "./redis";

export interface ResetRecord {
  uid: string;
  exp: number; // epoch ms
}

/**
 * Read a reset token and return its record only if it exists and hasn't
 * expired. Independent of Redis TTL: the embedded `exp` is the source of
 * truth, so a token is rejected after 1 hour even if the TTL didn't fire.
 */
export async function readReset(token: string): Promise<ResetRecord | null> {
  if (!token) return null;
  const rec = await redis.get<ResetRecord | string>(resetKey(token));
  if (!rec || typeof rec === "string") return null;
  if (!rec.uid || typeof rec.exp !== "number" || Date.now() > rec.exp) return null;
  return rec;
}
