import { create } from "zustand";

export interface RoomMember {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  isReady: boolean;
  isBot: boolean;
  team: "TEAM_A" | "TEAM_B";
  seatNumber: number;
  coins?: number;
}

export interface RoomDetails {
  id: string;
  roomCode: string;
  hostId: string;
  status: "WAITING" | "STARTING" | "IN_PROGRESS" | "FINISHED";
  maxPlayers: number;
  createdAt: string;
}

interface RoomStoreState {
  room: RoomDetails | null;
  players: RoomMember[];
  setRoom: (room: RoomDetails, players?: RoomMember[]) => void;
  setPlayers: (players: RoomMember[]) => void;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomStoreState>((set) => ({
  room: null,
  players: [],
  setRoom: (room, players) => {
    set({
      room,
      players: players ?? [],
    });
  },
  setPlayers: (players) => {
    set({ players });
  },
  clearRoom: () => {
    set({
      room: null,
      players: [],
    });
  },
}));
