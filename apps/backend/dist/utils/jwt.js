"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.signRefreshToken = exports.signAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const getSecret = (key) => {
    const value = process.env[key];
    if (!value) {
        throw new Error(`${key} is not configured`);
    }
    return value;
};
const signToken = (payload, secret, expiresIn) => {
    return jsonwebtoken_1.default.sign(payload, secret, { expiresIn });
};
const signAccessToken = (userId) => {
    return signToken({ sub: userId }, getSecret("JWT_SECRET"), "15m");
};
exports.signAccessToken = signAccessToken;
const signRefreshToken = (userId) => {
    return signToken({ sub: userId }, getSecret("JWT_REFRESH_SECRET"), "30d");
};
exports.signRefreshToken = signRefreshToken;
const verifyToken = (token, secret = getSecret("JWT_SECRET")) => {
    const decoded = jsonwebtoken_1.default.verify(token, secret);
    if (typeof decoded === "string") {
        throw new Error("Invalid token payload");
    }
    const userId = decoded.userId ?? decoded.sub;
    if (!userId) {
        throw new Error("Invalid token payload");
    }
    return {
        ...decoded,
        userId,
        sub: decoded.sub ?? userId,
    };
};
exports.verifyToken = verifyToken;
