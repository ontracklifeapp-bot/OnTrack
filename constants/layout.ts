import { Platform } from "react-native";

// Space above each screen's header. The phone app needs room for the status bar;
// in a browser the address bar already sits outside the page.
export const TOP_GAP = Platform.OS === "web" ? 24 : 60;
