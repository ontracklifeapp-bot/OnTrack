import { ReactNode } from "react";
import { View } from "react-native";

// Web stand-in for Swipeable: mouse users can't easily swipe, so the same
// action buttons are shown under the card instead of hidden behind it.
type Props = {
  children: ReactNode;
  renderLeftActions?: (...args: any[]) => ReactNode;
  renderRightActions?: (...args: any[]) => ReactNode;
  [key: string]: unknown;
};

export default function SwipeRow({ children, renderLeftActions, renderRightActions }: Props) {
  return (
    <View>
      {children}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", height: 46, marginTop: -4 }}>
        {renderLeftActions?.()}
        {renderRightActions?.()}
      </View>
    </View>
  );
}
