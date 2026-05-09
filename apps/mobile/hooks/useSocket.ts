import { useEffect } from "react";

import type { SocketPayloads } from "@shared/src";

import { socketService } from "../services/socket";

type SocketEventName = keyof SocketPayloads;
type SocketEventHandler<TEvent extends SocketEventName> = (
  payload: SocketPayloads[TEvent],
) => void;

export const useSocket = <TEvent extends SocketEventName>(
  event: TEvent,
  handler: SocketEventHandler<TEvent>,
): void => {
  useEffect(() => {
    socketService.connect();
    const unsubscribe = socketService.on(event, handler);

    return () => {
      unsubscribe();
    };
  }, [event, handler]);
};
