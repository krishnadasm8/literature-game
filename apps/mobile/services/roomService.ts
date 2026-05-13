import { api } from "./api";
import type { RoomDetails, RoomMember } from "../store/roomStore";

interface RoomResponse {
  room: RoomDetails & {
    players: RoomMember[];
  };
  roomCode?: string;
}

export type LeaveRoomResponse = {
  room: (RoomDetails & { players: RoomMember[] }) | null;
  yourCoins?: number;
};

export const createRoom = async (maxPlayers: 4 | 6 | 8): Promise<RoomResponse> => {
  const response = await api.post<RoomResponse>("/rooms", { maxPlayers });
  return response.data;
};

export const getRoom = async (roomCode: string): Promise<RoomResponse> => {
  const response = await api.get<RoomResponse>(`/rooms/${roomCode}`);
  return response.data;
};

export const joinRoom = async (roomCode: string): Promise<RoomResponse> => {
  const response = await api.post<RoomResponse>(`/rooms/${roomCode}/join`);
  return response.data;
};

export const leaveRoom = async (roomCode: string): Promise<LeaveRoomResponse> => {
  const response = await api.post<LeaveRoomResponse>(`/rooms/${roomCode}/leave`);
  return response.data;
};

export const setReady = async (roomCode: string, isReady: boolean): Promise<RoomResponse> => {
  const response = await api.post<RoomResponse>(`/rooms/${roomCode}/ready`, { isReady });
  return response.data;
};

export const startGame = async (roomCode: string): Promise<RoomResponse> => {
  const response = await api.post<RoomResponse>(`/rooms/${roomCode}/start`);
  return response.data;
};

export const switchTeam = async (
  roomCode: string,
  team: "TEAM_A" | "TEAM_B",
): Promise<RoomResponse> => {
  const response = await api.patch<RoomResponse>(`/rooms/${roomCode}/team`, { team });
  return response.data;
};
