import { Router } from "express";

const router = Router();

router.get("/:id", (_req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

router.post("/:id/move", (_req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

router.post("/:id/forfeit", (_req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

export default router;
