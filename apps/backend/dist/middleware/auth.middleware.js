"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    const token = authHeader.slice("Bearer ".length);
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        res.status(500).json({ error: "JWT_SECRET is not configured" });
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, secret);
        const userId = payload.userId ?? payload.sub;
        if (!userId) {
            res.status(401).json({ error: "Invalid token payload" });
            return;
        }
        req.user = { id: userId };
        next();
    }
    catch {
        res.status(401).json({ error: "Invalid token" });
    }
};
exports.authMiddleware = authMiddleware;
