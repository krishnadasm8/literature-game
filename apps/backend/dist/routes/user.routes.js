"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.get("/me", (_req, res) => {
    res.status(501).json({ message: "Not implemented" });
});
router.patch("/me", (_req, res) => {
    res.status(501).json({ message: "Not implemented" });
});
exports.default = router;
