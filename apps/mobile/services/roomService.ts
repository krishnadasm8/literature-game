import { api } from "./api";
import type { RoomDetails, RoomMember } from "../store/roomStore";

interface RoomResponse {
  room: RoomDetails & {
    players: RoomMember[];
  };
  roomCode?: string;
}

export const createRoom = async (maxPlayers: 4 | 6 | 8): Promise<RoomResponse> => {
  const response = await api.post<RoomResponse>("/api/v1/rooms", { maxPlayers });
  return response.data;
};

export const getRoom = async (roomCode: string): Promise<RoomResponse> => {
  const response = await api.get<RoomResponse>(`/api/v1/rooms/${roomCode}`);
  return response.data;
};

export const joinRoom = async (roomCode: string): Promise<RoomResponse> => {
  const response = await api.post<RoomResponse>(`/api/v1/rooms/${roomCode}/join`);
  return response.data;
};

export const leaveRoom = async (roomCode: string): Promise<RoomResponse> => {
  const response = await api.post<RoomResponse>(`/api/v1/rooms/${roomCode}/leave`);
  return response.data;
};

export const setReady = async (roomCode: string, isReady: boolean): Promise<RoomResponse> => {
  const response = await api.post<RoomResponse>(`/api/v1/rooms/${roomCode}/ready`, { isReady });
  return response.data;
};

export const startGame = async (roomCode: string): Promise<RoomResponse> => {
  const response = await api.post<RoomResponse>(`/api/v1/rooms/${roomCode}/start`);
  return response.data;
};
