import { router, usePathname } from "expo-router";
import { ComponentType, createContext, memo, ReactNode, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useTheme } from "../utils/theme";

// Mobile website: all tab pages sit side by side in one strip (like TikTok / Snapchat).
// Dragging moves the strip with your finger, so the neighbouring page is always there.
//
// For smoothness this is plain browser code (the pager only exists on the web):
//  • the finger position is written straight to the strip's CSS transform — no React re-render
//  • the glide is a CSS transition, so the GPU animates it even if JavaScript is busy
//  • pages are memoised and the URL is updated only after the glide finishes
//  • once a drag is clearly sideways, vertical scrolling is blocked for that drag
// The expo-router <Tabs> navigator still owns the URL; its own copy of each screen renders
// nothing while the pager is active (see pagerRoute below).

const PagerModeContext = createContext(false); // true while the pager is showing the tabs
const PagerCopyContext = createContext(false); // true inside the pager's own copy of a page

export const PagerModeProvider = PagerModeContext.Provider;

// Wrap a tab route's screen: when the pager is active, the navigator's copy renders nothing
// (the pager shows the page instead), so each page is only mounted once.
export function pagerRoute<P extends object>(Screen: ComponentType<P>) {
  function PagerAwareRoute(props: P) {
    const pagerMode = useContext(PagerModeContext);
    const isPagerCopy = useContext(PagerCopyContext);
    if (pagerMode && !isPagerCopy) return null;
    return <Screen {...props} />;
  }
  PagerAwareRoute.displayName = `pagerRoute(${Screen.displayName || Screen.name || "Screen"})`;
  return PagerAwareRoute;
}

export type PagerTab = { path: string; title: string; emoji: string; badge?: number; Screen: ComponentType };

// A page only re-renders when its own data changes, never because another page was selected
const Page = memo(function Page({ Screen }: { Screen: ComponentType }) {
  return (
    <PagerCopyContext.Provider value>
      <Screen />
    </PagerCopyContext.Provider>
  );
});

const GLIDE = "transform 320ms cubic-bezier(0.22, 0.61, 0.36, 1)";

export function MobileTabPager({ tabs, overlay }: { tabs: PagerTab[]; overlay?: ReactNode }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const pathname = usePathname();

  const routeIndex = Math.max(0, tabs.findIndex((t) => t.path === pathname));
  const [index, setIndex] = useState(routeIndex); // drives the tab-bar highlight
  const current = useRef(routeIndex); // the page the strip is on / heading to
  const [mountAll, setMountAll] = useState(false);
  const viewportRef = useRef<any>(null);
  const stripRef = useRef<any>(null);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prepare every page shortly after opening, so nothing has to load in the middle of a swipe
  useEffect(() => {
    const t = setTimeout(() => setMountAll(true), 600);
    return () => clearTimeout(t);
  }, []);

  const setX = (x: number, animate: boolean) => {
    const el: HTMLElement | null = stripRef.current;
    if (!el) return;
    el.style.transition = animate ? GLIDE : "none";
    el.style.transform = `translate3d(${x}px, 0, 0)`;
  };

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const glideTo = useCallback((i: number, updateUrl: boolean) => {
    current.current = i;
    setIndex(i);
    setX(-i * width, true);
    // Change the URL after the glide, so the navigator's re-render can't make it stutter
    if (navTimer.current) clearTimeout(navTimer.current);
    if (updateUrl) {
      navTimer.current = setTimeout(() => {
        const path = tabsRef.current[i].path;
        if (path !== window.location.pathname) router.navigate(path as any);
      }, 340);
    }
  }, [width]);
  // Touch handlers read the latest glideTo through a ref, so they never need re-attaching
  // mid-drag (e.g. when a badge count updates)
  const glideRef = useRef(glideTo);
  glideRef.current = glideTo;

  // Follow outside navigation (calendar button, Home's stat chips, links)
  useEffect(() => {
    if (routeIndex !== current.current) glideTo(routeIndex, false);
  }, [routeIndex, glideTo]);

  // Line the strip up before the first paint (no flash of Home) and when the screen is resized
  useLayoutEffect(() => { setX(-current.current * width, false); }, [width]);

  // Touch handling with native listeners: touchmove must be non-passive to block scrolling
  useEffect(() => {
    const vp: HTMLElement | null = viewportRef.current;
    if (!vp) return;
    let start: { x: number; y: number } | null = null;
    let horizontal: boolean | null = null;
    let samples: { x: number; t: number }[] = [];

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { start = null; return; }
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY };
      horizontal = null;
      samples = [{ x: t.clientX, t: e.timeStamp }];
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const t = e.touches[0];
      const dx = t.clientX - start.x, dy = t.clientY - start.y;
      if (horizontal === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        horizontal = Math.abs(dx) > Math.abs(dy); // decide once per drag: swipe or scroll
        if (horizontal && navTimer.current) clearTimeout(navTimer.current);
      }
      if (!horizontal) return;
      e.preventDefault(); // a sideways swipe: don't let the page scroll up/down as well
      samples.push({ x: t.clientX, t: e.timeStamp });
      if (samples.length > 6) samples.shift();
      const i = current.current;
      const atEdge = (dx > 0 && i === 0) || (dx < 0 && i === tabs.length - 1);
      setX(-i * width + (atEdge ? dx * 0.3 : dx), false);
    };
    const onEnd = (e: TouchEvent) => {
      if (!start || !horizontal) { start = null; return; }
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      start = null;
      // Flick speed from the last ~100ms of movement (px per ms)
      const last = samples[samples.length - 1];
      const ref = samples.find((s) => last.t - s.t <= 100) ?? samples[0];
      const v = (last.x - ref.x) / Math.max(1, last.t - ref.t);
      const i = current.current;
      let target = i;
      if (Math.abs(v) > 0.35) target = i + (v < 0 ? 1 : -1);
      else if (Math.abs(dx) > width * 0.35) target = i + (dx < 0 ? 1 : -1);
      target = Math.min(tabs.length - 1, Math.max(0, target));
      glideRef.current(target, target !== i);
    };
    const onCancel = () => { start = null; setX(-current.current * width, true); };

    vp.addEventListener("touchstart", onStart, { passive: true });
    vp.addEventListener("touchmove", onMove, { passive: false });
    vp.addEventListener("touchend", onEnd, { passive: true });
    vp.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      vp.removeEventListener("touchstart", onStart);
      vp.removeEventListener("touchmove", onMove);
      vp.removeEventListener("touchend", onEnd);
      vp.removeEventListener("touchcancel", onCancel);
    };
  }, [width, tabs.length]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View ref={viewportRef} style={[styles.viewport, { touchAction: "pan-y" } as any]}>
        <View
          ref={stripRef}
          style={[styles.strip, { width: width * tabs.length, willChange: "transform" } as any]}
        >
          {tabs.map((tab, i) => (
            <View key={tab.path} style={{ width, height: "100%", backgroundColor: colors.background }}>
              {(mountAll || Math.abs(i - routeIndex) <= 1) && <Page Screen={tab.Screen} />}
            </View>
          ))}
        </View>
        {overlay}
      </View>

      {/* Bottom tab bar */}
      <View style={[styles.bar, { backgroundColor: colors.tabBar, borderTopColor: colors.border }]}>
        {tabs.map((tab, i) => {
          const active = i === index;
          return (
            <TouchableOpacity
              key={tab.path}
              style={styles.barItem}
              onPress={() => glideTo(i, true)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab.title}
            >
              <View>
                <Text style={{ fontSize: 20 }}>{tab.emoji}</Text>
                {!!tab.badge && (
                  <View style={styles.badge}><Text style={styles.badgeText}>{tab.badge > 9 ? "9+" : tab.badge}</Text></View>
                )}
              </View>
              <Text numberOfLines={1} style={[styles.barLabel, { color: active ? colors.accent : colors.textMuted }]}>{tab.title}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: "hidden" },
  strip: { flex: 1, flexDirection: "row" },
  bar: { flexDirection: "row", height: 80, paddingBottom: 16, paddingTop: 8, borderTopWidth: 1 },
  barItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  barLabel: { fontSize: 10, fontWeight: "600" },
  badge: { position: "absolute", top: -4, right: -8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#e74c3c", justifyContent: "center", alignItems: "center", paddingHorizontal: 3 },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
});
