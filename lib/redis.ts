import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// All keys live under the `pushups:` namespace so the shared grannis.xyz
// Upstash instance stays tidy (blog uses `blog:`, tables uses `tables:`).
export const userKey = (emailLower: string) => `pushups:user:${emailLower}`;
export const userByIdKey = (userId: string) => `pushups:userid:${userId}`;
export const eventsKey = () => `pushups:events`; // set of event ids (global)
export const eventKey = (eventId: string) => `pushups:event:${eventId}`;
export const eventMarketsKey = (eventId: string) => `pushups:event:${eventId}:markets`; // set of market ids
export const eventFillsKey = (eventId: string) => `pushups:event:${eventId}:fills`; // list of Fill JSON
export const marketKey = (marketId: string) => `pushups:market:${marketId}`; // BookDoc
export const tapeKey = () => `pushups:tape`; // list of TapeEntry JSON (capped)
export const resetKey = (token: string) => `pushups:reset:${token}`;
