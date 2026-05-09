"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const google_auth_library_1 = require("google-auth-library");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const googleClient = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID);
router.post("/google", async (req, res) => {
    try {
        console.log("Auth request body:", req.body);
        console.log("idToken:", req.body.idToken ? "present" : "missing");
        console.log("accessToken:", req.body.accessToken ? "present" : "missing");
        const idToken = req.body?.idToken;
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
        const accessToken = jsonwebtoken_1.default.sign({ userId: user.id }, jwtSecret, {
            expiresIn: "15m",
        });
        const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, jwtRefreshSecret, {
            expiresIn: "30d",
        });
        res.json({ accessToken, refreshToken, user });
    }
    catch (error) {
        console.log("Auth error:", error instanceof Error ? error.message : String(error));
        const message = error instanceof Error ? error.message : "Google sign-in failed.";
        res.status(401).json({ error: message });
    }
});
router.post("/refresh", async (req, res) => {
    try {
        const refreshToken = req.body?.refreshToken;
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
        let payload;
        try {
            const verified = jsonwebtoken_1.default.verify(refreshToken, jwtRefreshSecret);
            if (typeof verified === "string") {
                res.status(401).json({ error: "Invalid refresh token." });
                return;
            }
            payload = verified;
        }
        catch {
            res.status(401).json({ error: "Invalid or expired refresh token." });
            return;
        }
        const userId = payload.userId;
        if (!userId) {
            res.status(401).json({ error: "Invalid refresh token payload." });
            return;
        }
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            res.status(401).json({ error: "User no longer exists." });
            return;
        }
        const accessToken = jsonwebtoken_1.default.sign({ userId: user.id }, jwtSecret, {
            expiresIn: "15m",
        });
        const nextRefreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, jwtRefreshSecret, {
            expiresIn: "30d",
        });
        res.status(200).json({ accessToken, refreshToken: nextRefreshToken });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to refresh token." });
    }
});
router.post("/logout", (_req, res) => {
    res.status(200).json({ ok: true });
});
exports.default = router;
