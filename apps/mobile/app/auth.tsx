import { useEffect } from "react";
import { Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

export default function AuthCallbackScreen(): JSX.Element {
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0f172a",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#f59e0b" }}>Completing sign in...</Text>
    </View>
  );
}

