import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

import { COIN_STARTING } from "../config/coinEconomy";
import { applyPassiveCoinRegen } from "../services/coinService";

const router = Router();
const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/** JWT `aud` may be Web, Android, or iOS OAuth client id depending on how the user signed in. */
function googleIdTokenAudiences(): string | string[] {
  const ids = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
  ]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    return process.env.GOOGLE_CLIENT_ID ?? "";
  }
  if (unique.length === 1) {
    return unique[0]!;
  }
  return unique;
}

router.post("/google", async (req, res) => {
  try {
    console.log("Auth request body:", req.body);
    console.log("idToken:", req.body.idToken ? "present" : "missing");
    console.log("accessToken:", req.body.accessToken ? "present" : "missing");
    console.log("code:", req.body.code ? "present" : "missing");

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

    const code = req.body?.code as string | undefined;
    const codeRedirectUri = req.body?.redirectUri as string | undefined;
    const codeClientId = req.body?.clientId as string | undefined;
    const codeVerifier = req.body?.codeVerifier as string | undefined;

    let payload: any = null;

    // Android auth code exchange (PKCE, no client secret)
    if (code && codeRedirectUri) {
      console.log("Exchanging auth code for tokens...");
      console.log("code:", `${code.substring(0, 20)}...`);
      console.log("redirectUri:", codeRedirectUri);

      try {
        if (!codeClientId) {
          res.status(400).json({ error: "clientId is required for code exchange." });
          return;
        }
        if (!codeVerifier) {
          res.status(400).json({ error: "codeVerifier is required for code exchange." });
          return;
        }

        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            code,
            client_id: codeClientId,
            redirect_uri: codeRedirectUri,
            grant_type: "authorization_code",
            code_verifier: codeVerifier,
          }).toString(),
        });

        const tokens = (await tokenResponse.json()) as {
          id_token?: string;
          access_token?: string;
          error?: string;
          error_description?: string;
        };

        console.log("Token exchange result:", {
          has_id_token: !!tokens.id_token,
          has_access_token: !!tokens.access_token,
          error: tokens.error,
          error_description: tokens.error_description,
        });

        if (tokens.error) {
          res.status(401).json({
            error: tokens.error_description ?? tokens.error,
          });
          return;
        }

        if (tokens.id_token) {
          const ticket = await googleClient.verifyIdToken({
            idToken: tokens.id_token,
            audience: googleIdTokenAudiences(),
          });
          payload = ticket.getPayload();
        } else if (tokens.access_token) {
          const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
            },
          });
          if (!userInfoRes.ok) {
            res.status(401).json({ error: "Invalid Google access token." });
            return;
          }
          payload = await userInfoRes.json();
        }
      } catch (codeError) {
        console.error("Code exchange error:", codeError);
        res.status(401).json({
          error: "Failed to exchange auth code",
        });
        return;
      }
    }

    // Existing idToken / accessToken handling
    if (!payload) {
      const idToken = req.body?.idToken as string | undefined;
      const accessToken = req.body?.accessToken as string | undefined;

      if (idToken) {
        const ticket = await googleClient.verifyIdToken({
          idToken,
          audience: googleIdTokenAudiences(),
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
        coins: COIN_STARTING,
        gamesPlayed: 0,
        gamesWon: 0,
      },
    });

    await applyPassiveCoinRegen(user.id);
    const refreshedUser = await prisma.user.findUnique({ where: { id: user.id } });

    const jwtAccessToken = jwt.sign({ userId: user.id }, jwtSecret, {
      expiresIn: "15m",
    });

    const jwtRefreshToken = jwt.sign({ userId: user.id }, jwtRefreshSecret, {
      expiresIn: "30d",
    });

    res.json({ accessToken: jwtAccessToken, refreshToken: jwtRefreshToken, user: refreshedUser ?? user });
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
