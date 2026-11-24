import AsyncStorage from "@react-native-async-storage/async-storage";
import { createElement, createContext, useContext, useEffect, useState } from "react";
import { Platform, useColorScheme } from "react-native";

export const lightColors = {
  background: "#f7f8fc",
  card: "#ffffff",
  text: "#222222",
  textSub: "#555555",
  textMuted: "#999999",
  border: "#f0f0f0",
  accent: "#6C63FF",
  tabBar: "#ffffff",
  input: "#ffffff",
  deleteAction: "#e74c3c",
  sectionTitle: "#888888",
};

export const darkColors = {
  background: "#0d0d1a",
  card: "#1a1a2e",
  text: "#f0f0f0",
  textSub: "#cccccc",
  textMuted: "#888888",
  border: "#2a2a40",
  accent: "#6C63FF",
  tabBar: "#1a1a2e",
  input: "#252540",
  deleteAction: "#c0392b",
  sectionTitle: "#777777",
};

export type AppColors = typeof lightColors;

type ThemeContextType = {
  isDark: boolean;
  colors: AppColors;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  colors: lightColors,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemScheme === "dark");

  useEffect(() => {
    AsyncStorage.getItem("ontrack_theme").then((val) => {
      if (val === "dark") setIsDark(true);
      else if (val === "light") setIsDark(false);
    });
  }, []);

  // Website: paint the page behind the app and the browser toolbar to match the theme
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const bg = (isDark ? darkColors : lightColors).background;
    document.documentElement.style.backgroundColor = bg;
    document.body.style.backgroundColor = bg;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
  }, [isDark]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    AsyncStorage.setItem("ontrack_theme", next ? "dark" : "light");
  };

  return createElement(
    ThemeContext.Provider,
    { value: { isDark, colors: isDark ? darkColors : lightColors, toggleTheme } },
    children
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
