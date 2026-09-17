import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMediaAccessUrl } from "../hooks/useMediaAccessUrl";
import { constrainTransform, fitImage, imagePageAfterSwipe, zoomAroundPoint } from "../utils/imageViewer";
import type { MediaReference } from "../utils/mediaAccess";
import StatusBarScrim from "./StatusBarScrim";

type Props = { images: MediaReference[]; initialIndex: number; onClose: () => void };

export default function ImageViewerModal({ images, initialIndex, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(Math.max(0, Math.min(initialIndex, images.length - 1)));
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const changePage = useCallback((next: number) => {
    setIndex(Math.max(0, Math.min(next, images.length - 1)));
  }, [images.length]);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <StatusBar style={Platform.OS === "android" ? "dark" : "light"} />
        {Platform.OS === "android" ? <StatusBarScrim /> : null}
        <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <Text style={styles.title}>사진 보기</Text>
              <Text accessibilityLiveRegion="polite" style={styles.counter}>{index + 1} / {images.length}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="사진 보기 닫기" onPress={onClose} style={styles.iconButton}>
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </Pressable>
          </View>
          <View style={styles.stage} onLayout={(event) => setViewport(event.nativeEvent.layout)}>
            {viewport.width > 0 && viewport.height > 0 && images[index] ? (
              <ZoomableImage key={`${index}:${viewport.width}:${viewport.height}`} media={images[index]} viewport={viewport}
                index={index} count={images.length} onPage={changePage} onClose={onClose} />
            ) : null}
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function ZoomableImage({ media, viewport, index, count, onPage, onClose }: {
  media: MediaReference; viewport: { width: number; height: number }; index: number; count: number;
  onPage: (index: number) => void; onClose: () => void;
}) {
  const { uri, isError, refresh } = useMediaAccessUrl(media);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const imageHeight = Math.max(1, viewport.height);
  const fitted = fitImage(dimensions.width, dimensions.height, viewport.width, imageHeight);
  const scale = useSharedValue(1);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const wasPinching = useSharedValue(false);
  const pinchTracking = useSharedValue(false);

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    setLoaded(false);
    setFailed(false);
    Image.getSize(uri, (width, height) => {
      if (!cancelled) setDimensions({ width, height });
    }, () => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [uri, retry]);

  const applyZoom = useCallback((nextScale: number) => {
    const next = zoomAroundPoint(scale.value, offsetX.value, offsetY.value, nextScale, 0, 0, 0, 0);
    const bounded = constrainTransform(next.scale, next.x, next.y, fitted.width, fitted.height, viewport.width, imageHeight);
    scale.value = bounded.scale;
    offsetX.value = bounded.x;
    offsetY.value = bounded.y;
  }, [scale, offsetX, offsetY, fitted.width, fitted.height, viewport.width, imageHeight]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handleKey = (event: KeyboardEvent) => {
      if (!["Escape", "ArrowLeft", "ArrowRight", "+", "=", "-", "0"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") onPage(index - 1);
      else if (event.key === "ArrowRight") onPage(index + 1);
      else applyZoom(event.key === "0" ? 1 : scale.value + (event.key === "-" ? -0.5 : 0.5));
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [applyZoom, index, onClose, onPage, scale]);

  const pinch = Gesture.Pinch().enabled(loaded && !failed)
    // Android reports a new focal point when a finger lifts. Freeze this pinch
    // until the next gesture so the image does not jump toward the remaining finger.
    .onTouchesDown((event) => { if (event.numberOfTouches !== 2) pinchTracking.value = false; })
    .onTouchesUp(() => { pinchTracking.value = false; })
    .onStart((event) => {
      pinchTracking.value = true;
      wasPinching.value = true;
      startScale.value = scale.value;
      startX.value = offsetX.value;
      startY.value = offsetY.value;
      focalX.value = event.focalX - viewport.width / 2;
      focalY.value = event.focalY - imageHeight / 2;
    })
    .onUpdate((event) => {
      if (!pinchTracking.value) return;
      const next = zoomAroundPoint(startScale.value, startX.value, startY.value, startScale.value * event.scale,
        focalX.value, focalY.value, event.focalX - viewport.width / 2, event.focalY - imageHeight / 2);
      const bounded = constrainTransform(next.scale, next.x, next.y, fitted.width, fitted.height, viewport.width, imageHeight);
      scale.value = bounded.scale;
      offsetX.value = bounded.x;
      offsetY.value = bounded.y;
    });

  const pan = Gesture.Pan().enabled(loaded && !failed).maxPointers(1).minDistance(8)
    .onBegin(() => { wasPinching.value = false; })
    .onStart(() => {
      startX.value = offsetX.value;
      startY.value = offsetY.value;
      startScale.value = scale.value;
    })
    .onUpdate((event) => {
      if (wasPinching.value || scale.value <= 1) return;
      const bounded = constrainTransform(scale.value, startX.value + event.translationX, startY.value + event.translationY,
        fitted.width, fitted.height, viewport.width, imageHeight);
      offsetX.value = bounded.x;
      offsetY.value = bounded.y;
    }).onEnd((event, success) => {
      if (!success || wasPinching.value) return;
      const next = imagePageAfterSwipe(index, count, startScale.value, event.translationX, event.translationY);
      if (next !== index) runOnJS(onPage)(next);
    });

  const doubleTap = Gesture.Tap().numberOfTaps(2).enabled(loaded && !failed).onEnd((event, success) => {
    if (!success) return;
    const next = zoomAroundPoint(scale.value, offsetX.value, offsetY.value, scale.value > 1 ? 1 : 2.5,
      event.x - viewport.width / 2, event.y - imageHeight / 2, event.x - viewport.width / 2, event.y - imageHeight / 2);
    const bounded = constrainTransform(next.scale, next.x, next.y, fitted.width, fitted.height, viewport.width, imageHeight);
    scale.value = bounded.scale;
    offsetX.value = bounded.x;
    offsetY.value = bounded.y;
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }, { translateY: offsetY.value }, { scale: scale.value }],
  }));
  const hasError = failed || isError;

  return (
      <View style={[styles.imageViewport, { height: imageHeight }]}>
        <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
          <View collapsable={false} style={styles.imageCanvas}>
            {uri ? (
              <Animated.Image key={`${uri}:${retry}`} source={{ uri }} accessibilityLabel={`${index + 1}번째 사진 원본`}
                resizeMode="contain" onLoad={() => { setLoaded(true); setFailed(false); }} onError={() => setFailed(true)}
                style={[{ width: fitted.width, height: fitted.height }, animatedStyle]} />
            ) : null}
          </View>
        </GestureDetector>
        {!loaded && !hasError ? <ActivityIndicator accessibilityLabel="사진 불러오는 중" color="#FFFFFF" style={StyleSheet.absoluteFill} /> : null}
        {hasError ? (
          <View style={styles.error}>
            <Text style={styles.help}>사진을 불러오지 못했어요.</Text>
            <Pressable accessibilityRole="button" onPress={() => { setFailed(false); setRetry((value) => value + 1); void refresh(); }} style={styles.retry}>
              <Text style={styles.title}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}
        {count > 1 ? (
          <>
            <Pressable accessibilityRole="button" accessibilityLabel="이전 사진 보기" disabled={index === 0} onPress={() => onPage(index - 1)} style={[styles.arrow, styles.leftArrow, index === 0 && styles.disabled]}>
              <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="다음 사진 보기" disabled={index === count - 1} onPress={() => onPage(index + 1)} style={[styles.arrow, styles.rightArrow, index === count - 1 && styles.disabled]}>
              <Ionicons name="chevron-forward" size={26} color="#FFFFFF" />
            </Pressable>
          </>
        ) : null}
      </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#101114" },
  header: { height: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#25262B" },
  headerTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  title: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  counter: { color: "#B9BDC8", fontSize: 14, fontVariant: ["tabular-nums"] },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  stage: { flex: 1 },
  imageViewport: { overflow: "hidden", position: "relative" },
  imageCanvas: { flex: 1, alignItems: "center", justifyContent: "center" },
  arrow: { position: "absolute", top: "50%", marginTop: -22, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)" },
  leftArrow: { left: 12 },
  rightArrow: { right: 12 },
  disabled: { opacity: 0.25 },
  help: { color: "#ADB2BF", fontSize: 12, textAlign: "center" },
  error: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: "#101114" },
  retry: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: "#30333C" },
});
