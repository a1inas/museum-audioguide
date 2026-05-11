import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const COOKIE_NAME = "admin_session";

function getSecret() {
  return process.env.ADMIN_COOKIE_SECRET ?? "";
}

function sign(data: string) {
  return crypto.createHmac("sha256", getSecret()).update(data).digest("hex");
}

export function issueAdminCookie(res: Response) {
  const payload = JSON.stringify({
    v: 1,
    iat: Date.now(),
  });

  const b64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = sign(b64);
  const token = `${b64}.${sig}`;

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // secure: true, // включишь на https
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
  });
}

export function clearAdminCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const secret = getSecret();
  if (!secret || secret.length < 10) {
    return res.status(500).json({
      ok: false,
      error: "ADMIN_COOKIE_SECRET is not set (or too short)",
    });
  }

  const token = req.cookies?.[COOKIE_NAME];
  if (!token || typeof token !== "string") {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const [b64, sig] = token.split(".");
  if (!b64 || !sig) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const expected = sign(b64);
  if (sig !== expected) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  // payload пока не используем (можно добавить exp и роль позже)
  next();
}
