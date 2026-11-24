import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useTheme } from "../utils/theme";

function SingleSkeleton({ opacity }: { opacity: Animated.Value }) {
  const { colors } = useTheme();
  return (
    <Animated.View style={[styles.card, { backgroundColor: colors.card, opacity }]}>
      <View style={[styles.circle, { backgroundColor: colors.border }]} />
      <View style={styles.lines}>
        <View style={[styles.lineShort, { backgroundColor: colors.border }]} />
        <View style={[styles.lineLong, { backgroundColor: colors.border }]} />
      </View>
      <View style={[styles.badge, { backgroundColor: colors.border }]} />
    </Animated.View>
  );
}

export default function SkeletonLoader({ count = 3 }: { count?: number }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [opacity]);

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SingleSkeleton key={i} opacity={opacity} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  circle: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
  lines: { flex: 1, gap: 8 },
  lineShort: { height: 13, borderRadius: 6, width: "60%" },
  lineLong: { height: 10, borderRadius: 6, width: "40%" },
  badge: { width: 52, height: 24, borderRadius: 12 },
});
