"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const node_http_1 = require("node:http");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const game_routes_1 = __importDefault(require("./routes/game.routes"));
const room_routes_1 = __importDefault(require("./routes/room.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const sockets_1 = require("./sockets");
const error_middleware_1 = require("./middleware/error.middleware");
const app = (0, express_1.default)();
const apiRouter = express_1.default.Router();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
apiRouter.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
});
apiRouter.use("/auth", auth_routes_1.default);
apiRouter.use("/rooms", room_routes_1.default);
apiRouter.use("/games", game_routes_1.default);
apiRouter.use("/users", user_routes_1.default);
app.use("/api/v1", apiRouter);
app.use(error_middleware_1.errorMiddleware);
const httpServer = (0, node_http_1.createServer)(app);
(0, sockets_1.initializeSocketServer)(httpServer);
const port = Number(process.env.PORT ?? 4000);
httpServer.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on port ${port}`);
});
