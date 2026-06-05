import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// All keys live under the `pushups:` namespace so the shared grannis.xyz
// Upstash instance stays tidy (blog uses `blog:`, tables uses `tables:`).
export const userKey = (emailLower: string) => `pushups:user:${emailLower}`;
export const userByIdKey = (userId: string) => `pushups:userid:${userId}`;
export const userEventsKey = (userId: string) => `pushups:userevents:${userId}`;
export const eventKey = (eventId: string) => `pushups:event:${eventId}`;
