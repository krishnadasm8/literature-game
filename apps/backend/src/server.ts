import "dotenv/config";

import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createServer } from "node:http";

import authRoutes from "./routes/auth.routes";
import gameRoutes from "./routes/game.routes";
import roomRoutes from "./routes/room.routes";
import userRoutes from "./routes/user.routes";
import { initializeSocketServer } from "./sockets";
import { errorMiddleware } from "./middleware/error.middleware";

const app = express();
const apiRouter = express.Router();

app.use(helmet());
app.use(cors());
app.use(express.json());

apiRouter.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

apiRouter.use("/auth", authRoutes);
apiRouter.use("/rooms", roomRoutes);
apiRouter.use("/games", gameRoutes);
apiRouter.use("/users", userRoutes);
app.use("/api/v1", apiRouter);

app.use(errorMiddleware);

const httpServer = createServer(app);
initializeSocketServer(httpServer);

const port = Number(process.env.PORT ?? 4000);
httpServer.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on port ${port}`);
});
