import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post("/google", async (req, res) => {
  try {
    console.log("Auth request body:", req.body);
    console.log("idToken:", req.body.idToken ? "present" : "missing");
    console.log("accessToken:", req.body.accessToken ? "present" : "missing");

    const idToken = req.body?.idToken as string | undefined;
    const accessToken = req.body?.accessToken as string | undefined;

    if (!idToken && !accessToken) {
      res.status(400).json({ error: "idToken or accessToken required" });
      return;
    }

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      res.status(500).json({ error: "GOOGLE_CLIENT_ID is not configured." });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!jwtSecret || !jwtRefreshSecret) {
      res.status(500).json({ error: "JWT secrets are not configured." });
      return;
    }

    let payload: any;

    if (idToken) {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: googleClientId,
      });
      payload = ticket.getPayload();
    } else if (accessToken) {
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userInfoRes.ok) {
        res.status(401).json({ error: "Invalid Google access token." });
        return;
      }
      payload = await userInfoRes.json();
    }

    if (!payload?.sub) {
      res.status(401).json({ error: "Invalid token payload." });
      return;
    }

    const googleId = payload.sub as string;
    const email = payload.email as string | undefined;
    const displayName = payload.name ?? email ?? "Literature Player";
    const avatarUrl = (payload.picture as string | undefined) ?? null;

    const user = await prisma.user.upsert({
      where: { googleId },
      update: {
        displayName,
        avatarUrl,
      },
      create: {
        googleId,
        displayName,
        avatarUrl,
        coins: 0,
        gamesPlayed: 0,
        gamesWon: 0,
      },
    });

    const jwtAccessToken = jwt.sign({ userId: user.id }, jwtSecret, {
      expiresIn: "15m",
    });

    const jwtRefreshToken = jwt.sign({ userId: user.id }, jwtRefreshSecret, {
      expiresIn: "30d",
    });

    res.json({ accessToken: jwtAccessToken, refreshToken: jwtRefreshToken, user });
  } catch (error) {
    console.log("Auth error:", error instanceof Error ? error.message : String(error));
    const message = error instanceof Error ? error.message : "Google sign-in failed.";
    res.status(401).json({ error: message });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.body?.refreshToken as string | undefined;
    if (!refreshToken) {
      res.status(400).json({ error: "refreshToken is required." });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!jwtSecret || !jwtRefreshSecret) {
      res.status(500).json({ error: "JWT secrets are not configured." });
      return;
    }

    let payload: jwt.JwtPayload;
    try {
      const verified = jwt.verify(refreshToken, jwtRefreshSecret);
      if (typeof verified === "string") {
        res.status(401).json({ error: "Invalid refresh token." });
        return;
      }
      payload = verified;
    } catch {
      res.status(401).json({ error: "Invalid or expired refresh token." });
      return;
    }

    const userId = payload.userId as string | undefined;
    if (!userId) {
      res.status(401).json({ error: "Invalid refresh token payload." });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(401).json({ error: "User no longer exists." });
      return;
    }

    const accessToken = jwt.sign({ userId: user.id }, jwtSecret, {
      expiresIn: "15m",
    });
    const nextRefreshToken = jwt.sign({ userId: user.id }, jwtRefreshSecret, {
      expiresIn: "30d",
    });

    res.status(200).json({ accessToken, refreshToken: nextRefreshToken });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to refresh token." });
  }
});

router.post("/logout", (_req, res) => {
  res.status(200).json({ ok: true });
});

export default router;
