import { createHash, timingSafeEqual } from "node:crypto";

export const ADMIN_USER = "admin";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Confere o header Authorization (Basic) contra ADMIN_PASSWORD. Sem senha configurada, ninguém entra. */
export function isAdminAuthorized(authorization: string | null) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12 || !authorization?.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
  } catch {
    return false;
  }
  const i = decoded.indexOf(":");
  if (i < 0) return false;
  const userOk = timingSafeEqual(digest(decoded.slice(0, i)), digest(ADMIN_USER));
  const passOk = timingSafeEqual(digest(decoded.slice(i + 1)), digest(password));
  return userOk && passOk;
}
