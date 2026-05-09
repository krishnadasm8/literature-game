import { io, type Socket } from "socket.io-client";

import { useAuthStore } from "../store/authStore";

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || "http://localhost:3001";

type EventHandler<TPayload = unknown> = (payload: TPayload) => void;

class SocketService {
  private sockets = new Map<string, Socket>();
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  connect(namespace = "/game"): Socket {
    const namespaceUrl = namespace === "/" ? SOCKET_URL : `${SOCKET_URL}${namespace}`;
    const accessToken = useAuthStore.getState().accessToken;
    const existingSocket = this.sockets.get(namespace);

    if (!existingSocket) {
      const socket = io(namespaceUrl, {
        autoConnect: false,
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        auth: {
          token: accessToken ?? undefined,
        },
      });

      socket.on("connect_error", () => {
        this.scheduleReconnect(namespace);
      });
      socket.on("disconnect", (reason) => {
        if (reason !== "io client disconnect") {
          this.scheduleReconnect(namespace);
        }
      });
      socket.on("reconnect_attempt", () => {
        const reconnectSocket = this.sockets.get(namespace);
        if (reconnectSocket) {
          reconnectSocket.auth = {
            token: useAuthStore.getState().accessToken ?? undefined,
          };
        }
      });

      this.sockets.set(namespace, socket);
    }

    const socket = this.sockets.get(namespace);
    if (!socket) {
      throw new Error("Socket initialization failed.");
    }

    socket.auth = {
      token: accessToken ?? undefined,
    };

    if (!socket.connected) {
      socket.connect();
    }

    return socket;
  }

  disconnect(namespace = "/game"): void {
    const reconnectTimer = this.reconnectTimers.get(namespace);
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      this.reconnectTimers.delete(namespace);
    }
    const socket = this.sockets.get(namespace);
    if (socket) {
      socket.disconnect();
      this.sockets.delete(namespace);
    }
  }

  emit<TPayload>(event: string, payload: TPayload, namespace = "/game"): void {
    this.sockets.get(namespace)?.emit(event, payload);
  }

  on<TPayload>(event: string, handler: EventHandler<TPayload>, namespace = "/game"): () => void {
    this.sockets.get(namespace)?.on(event, handler);
    return () => {
      this.sockets.get(namespace)?.off(event, handler);
    };
  }

  private scheduleReconnect(namespace: string): void {
    const socket = this.sockets.get(namespace);
    if (!socket || socket.connected || this.reconnectTimers.has(namespace)) {
      return;
    }
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(namespace);
      const reconnectSocket = this.sockets.get(namespace);
      if (reconnectSocket && !reconnectSocket.connected) {
        reconnectSocket.connect();
      }
    }, 1500);
    this.reconnectTimers.set(namespace, timer);
  }
}

export const socketService = new SocketService();
