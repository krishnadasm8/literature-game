"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = void 0;
const errorMiddleware = (error, _req, res, _next) => {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    res.status(500).json({ error: message });
};
exports.errorMiddleware = errorMiddleware;
