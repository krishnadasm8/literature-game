import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import { authMiddleware } from "../middleware/auth.middleware";
import { gameManager } from "../services/gameManager";

const router = Router();

router.get("/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const game = await gameManager.getGameState({
    gameIdOrRoomCode: String(req.params.id),
    requestingPlayerId: userId,
  });

  if (!game) {
    res.status(404).json({ error: "Game not found." });
    return;
  }

  res.status(200).json(game);
});

router.post("/:id/move", (_req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

router.post("/:id/forfeit", (_req, res) => {
  res.status(501).json({ message: "Not implemented" });
});

export default router;
