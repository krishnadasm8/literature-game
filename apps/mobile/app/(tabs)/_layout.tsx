import React from "react";
import { Tabs } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

const TAB_META: Record<string, { icon: string; title: string }> = {
  index: { icon: "🏠", title: "Home" },
  lobby: { icon: "🃏", title: "Lobby" },
  profile: { icon: "👤", title: "Profile" },
  store: { icon: "🛒", title: "Store" },
};

const TabIcon = ({ focused, icon, label }: { focused: boolean; icon: string; label: string }): JSX.Element => (
  <View style={styles.tabItem}>
    <View style={styles.indicatorWrap}>{focused ? <View style={styles.activeIndicator} /> : <View style={styles.indicatorSpacer} />}</View>
    <Text style={[styles.tabIcon, focused ? styles.tabIconActive : styles.tabIconInactive]}>{icon}</Text>
    <Text style={[styles.tabLabel, focused ? styles.tabLabelActive : styles.tabLabelInactive]}>{label}</Text>
  </View>
);

export default function TabsLayout(): JSX.Element {
  return (
    <Tabs
      screenOptions={({ route }) => {
        const meta = TAB_META[route.name] ?? { icon: "•", title: route.name };
        return {
          animation: "fade",
          headerShown: true,
          headerStyle: styles.header,
          headerShadowVisible: false,
          headerTitleAlign: "center",
          headerTitleStyle: styles.headerTitle,
          headerTintColor: "#f59e0b",
          title: meta.title,
          tabBarStyle: styles.tabBar,
          tabBarShowLabel: false,
          tabBarButton: (props) => (
            <Pressable
              {...props}
              onPress={(event) => {
                if (Platform.OS !== "web") {
                  void Haptics.selectionAsync();
                }
                props.onPress?.(event);
              }}
            />
          ),
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={meta.icon} label={meta.title} />,
        };
      }}
    >
      <Tabs.Screen name="index" options={{ headerRight: () => <Text style={styles.headerAction}> </Text> }} />
      <Tabs.Screen name="lobby" options={{ headerRight: () => <Text style={styles.headerAction}>?</Text> }} />
      <Tabs.Screen name="profile" options={{ headerRight: () => <Text style={styles.headerAction}>✎</Text> }} />
      <Tabs.Screen name="store" options={{ headerRight: () => <Text style={styles.headerAction}> </Text> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    height: 56,
  },
  headerTitle: {
    color: "#f1f5f9",
    fontSize: 17,
    fontWeight: "800",
  },
  headerAction: {
    color: "#f59e0b",
    fontWeight: "800",
    fontSize: 18,
    paddingRight: 6,
  },
  tabBar: {
    backgroundColor: "#1e293b",
    borderTopColor: "#334155",
    borderTopWidth: 1,
    height: 65,
    paddingBottom: 6,
    paddingTop: 4,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 62,
  },
  indicatorWrap: {
    height: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  activeIndicator: {
    width: 16,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#f59e0b",
  },
  indicatorSpacer: {
    width: 16,
    height: 4,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  tabIcon: {
    fontSize: 16,
  },
  tabIconActive: {
    color: "#f59e0b",
  },
  tabIconInactive: {
    color: "#64748b",
  },
  tabLabel: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: "700",
  },
  tabLabelActive: {
    color: "#f59e0b",
  },
  tabLabelInactive: {
    color: "#64748b",
  },
});
