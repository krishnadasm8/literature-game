import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Safe storage that works on both web and native
const isWeb = Platform.OS === "web";

export const saveToken = async (key: string, value: string): Promise<void> => {
  try {
    if (isWeb) {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (error) {
    console.error("saveToken error:", error);
    try {
      await AsyncStorage.setItem(key, value);
    } catch (fallbackError) {
      console.error("saveToken fallback error:", fallbackError);
    }
  }
};

export const getToken = async (key: string): Promise<string | null> => {
  try {
    if (isWeb) {
      return localStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  } catch (error) {
    console.error("getToken error:", error);
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  }
};

export const deleteToken = async (key: string): Promise<void> => {
  try {
    if (isWeb) {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch (error) {
    console.error("deleteToken error:", error);
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
};
