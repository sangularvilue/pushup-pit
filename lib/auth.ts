import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { redis, userByIdKey, userKey } from "./redis";
import type { PublicUser } from "./types";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "change-me-in-production"
);
const COOKIE_NAME = "pushups_token";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface StoredUser {
  id: string;
  email: string;
  displayName: string;
  /** scrypt hash, stored as `salt:hash` (both hex). */
  passHash: string;
  createdAt: number;
}

// ---- password hashing (node crypto, no external deps) ----

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// ---- JWT session ----

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function currentUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return (payload.uid as string) || null;
  } catch {
    return null;
  }
}

export async function getUserById(id: string): Promise<StoredUser | null> {
  const email = await redis.get<string>(userByIdKey(id));
  if (!email) return null;
  return redis.get<StoredUser>(userKey(email));
}

export async function currentUser(): Promise<PublicUser | null> {
  const id = await currentUserId();
  if (!id) return null;
  const u = await getUserById(id);
  if (!u) return null;
  return { id: u.id, email: u.email, displayName: u.displayName };
}
