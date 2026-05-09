import { Router } from "express";

const router = Router();

router.get("/me", (_req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

router.patch("/me", (_req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

export default router;
