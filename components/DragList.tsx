import { ReactNode, useRef, useState } from "react";
import type { PanResponderInstance } from "react-native";
import { Animated, PanResponder, View } from "react-native";

// A vertical list you can reorder by dragging (mouse or finger). Only active when `enabled`.
// The dragged row follows the pointer; the rows it passes slide out of the way; on release
// onReorder(newOrder) is called with the item keys in their new order.
type Props<T> = {
  items: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T, index: number, dragging: boolean) => ReactNode;
  enabled: boolean;
  gap?: number;
  onReorder: (keys: string[]) => void;
  onDragChange?: (dragging: boolean) => void; // e.g. to pause page scrolling
};

export default function DragList<T>({ items, keyOf, renderItem, enabled, gap = 8, onReorder, onDragChange }: Props<T>) {
  const heights = useRef<Record<string, number>>({});
  const [drag, setDrag] = useState<{ from: number; dy: number } | null>(null);
  const dyAnim = useRef(new Animated.Value(0)).current;

  const rowHeight = (i: number) => (heights.current[keyOf(latest.current.items[i])] ?? 72) + gap;

  // Where the dragged row would land for a given vertical offset
  const targetFor = (from: number, dy: number) => {
    let t = from, acc = 0;
    if (dy > 0) {
      while (t < latest.current.items.length - 1 && dy > acc + rowHeight(t + 1) / 2) { acc += rowHeight(t + 1); t++; }
    } else {
      while (t > 0 && -dy > acc + rowHeight(t - 1) / 2) { acc += rowHeight(t - 1); t--; }
    }
    return t;
  };

  // Keep the latest values for the long-lived drag handlers below
  const latest = useRef({ items, enabled, onReorder, onDragChange });
  latest.current = { items, enabled, onReorder, onDragChange };
  // One drag handler per row, created once (re-creating it mid-drag would lose the gesture)
  const pans = useRef<Record<string, PanResponderInstance>>({});
  const panFor = (key: string) => {
    if (!pans.current[key]) pans.current[key] = makePan(key);
    return pans.current[key];
  };
  const indexOfKey = (key: string) => latest.current.items.findIndex((it) => keyOf(it) === key);

  const makePan = (key: string) =>
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => latest.current.enabled,
      onMoveShouldSetPanResponderCapture: () => latest.current.enabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dyAnim.setValue(0);
        setDrag({ from: indexOfKey(key), dy: 0 });
        latest.current.onDragChange?.(true);
      },
      onPanResponderMove: (_, g) => {
        dyAnim.setValue(g.dy);
        setDrag({ from: indexOfKey(key), dy: g.dy });
      },
      onPanResponderRelease: (_, g) => {
        const from = indexOfKey(key);
        const to = targetFor(from, g.dy);
        setDrag(null);
        dyAnim.setValue(0);
        latest.current.onDragChange?.(false);
        if (from >= 0 && to !== from) {
          const keys = latest.current.items.map(keyOf);
          const [moved] = keys.splice(from, 1);
          keys.splice(to, 0, moved);
          latest.current.onReorder(keys);
        }
      },
      onPanResponderTerminate: () => { setDrag(null); dyAnim.setValue(0); latest.current.onDragChange?.(false); },
    });

  const target = drag ? targetFor(drag.from, drag.dy) : -1;
  const draggedHeight = drag ? rowHeight(drag.from) : 0;

  return (
    <View>
      {items.map((item, i) => {
        const key = keyOf(item);
        const isDragged = drag?.from === i;
        // Rows between the start and the target slide up/down by the dragged row's height
        let shift = 0;
        if (drag && !isDragged) {
          if (drag.from < target && i > drag.from && i <= target) shift = -draggedHeight;
          if (drag.from > target && i < drag.from && i >= target) shift = draggedHeight;
        }
        const pan = enabled ? panFor(key).panHandlers : {};
        return (
          <Animated.View
            key={key}
            onLayout={(e) => { heights.current[key] = e.nativeEvent.layout.height; }}
            {...pan}
            style={[
              { marginBottom: gap },
              enabled && ({ cursor: isDragged ? "grabbing" : "grab", touchAction: "none", userSelect: "none" } as any),
              isDragged
                ? { transform: [{ translateY: dyAnim }, { scale: 1.02 }], zIndex: 10, opacity: 0.95, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }
                : { transform: [{ translateY: shift }] },
            ]}
          >
            {renderItem(item, i, isDragged)}
          </Animated.View>
        );
      })}
    </View>
  );
}
