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
    if (!idToken) {
      res.status(400).json({ error: "idToken is required." });
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

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: googleClientId,
    });
    const payload = ticket.getPayload();

    if (!payload?.sub) {
      res.status(401).json({ error: "Invalid Google token payload." });
      return;
    }

    const googleId = payload.sub;
    const email = payload.email;
    const displayName = payload.name ?? email ?? "Literature Player";
    const avatarUrl = payload.picture ?? null;

    const user = await prisma.user.upsert({
      where: { googleId },
      update: { 
        displayName, 
        avatarUrl 
      },
      create: { 
        googleId, 
        displayName, 
        avatarUrl, 
        coins: 0, 
        gamesPlayed: 0, 
        gamesWon: 0 
      },
    });

    const accessToken = jwt.sign({ userId: user.id }, jwtSecret, {
      expiresIn: "15m",
    });

    const refreshToken = jwt.sign({ userId: user.id }, jwtRefreshSecret, {
      expiresIn: "30d",
    });

    res.json({ accessToken, refreshToken, user });
  } catch (error) {
    console.log("Auth error:", error instanceof Error ? error.message : String(error));
    const message = error instanceof Error ? error.message : "Google sign-in failed.";
    res.status(401).json({ error: message });
  }
});

router.post("/refresh", (_req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

router.post("/logout", (_req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

export default router;
