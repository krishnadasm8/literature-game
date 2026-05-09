import type { Namespace } from "socket.io";

export const attachGameNamespace = (namespace: Namespace): void => {
  namespace.on("connection", (socket) => {
    socket.on("game:play_card", (_payload: unknown) => {
      // Stub handler.
    });

    socket.on("game:forfeit", (_payload: unknown) => {
      // Stub handler.
    });

    socket.on("game:sync", (_payload: unknown) => {
      // Stub handler.
    });
  });
};
