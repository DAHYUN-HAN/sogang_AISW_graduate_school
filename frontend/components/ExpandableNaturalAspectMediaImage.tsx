import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, type ComponentProps } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from "react-native";
import { AppText as Text } from "./AppTypography";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { imageDimensionsFromLoadEvent, type ImageDimensions } from "../utils/imageDimensions";
import {
  naturalImagePreviewLayout,
  POST_DETAIL_IMAGE_PREVIEW_MAX_HEIGHT,
} from "../utils/naturalImagePreview";
import MediaImage from "./MediaImage";
import { useMediaAccessUrl } from "../hooks/useMediaAccessUrl";

type Props = Omit<ComponentProps<typeof MediaImage>, "style" | "onLayout"> & {
  fallbackAspectRatio?: number;
  maxPreviewHeight?: number;
  style?: StyleProp<ViewStyle>;
};

export default function ExpandableNaturalAspectMediaImage({
  fallbackAspectRatio = 16 / 9,
  maxPreviewHeight = POST_DETAIL_IMAGE_PREVIEW_MAX_HEIGHT,
  media,
  onLoad,
  style,
  ...props
}: Props) {
  const insets = useSafeAreaInsets();
  const [containerWidth, setContainerWidth] = useState(0);
  const [dimensions, setDimensions] = useState<ImageDimensions>();
  const [viewerVisible, setViewerVisible] = useState(false);
  const { uri } = useMediaAccessUrl(media);

  // 웹에서는 onLoad 이벤트에 원본 크기가 안 실리는 경우가 있어 getSize로 확정 측정한다.
  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    Image.getSize(
      uri,
      (width, height) => {
        if (!cancelled && width > 0 && height > 0) setDimensions({ width, height });
      },
      () => undefined
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);
  const layout = dimensions
    ? naturalImagePreviewLayout({
        containerWidth,
        imageWidth: dimensions.width,
        imageHeight: dimensions.height,
        maxPreviewHeight,
      })
    : undefined;
  const aspectRatio = layout?.aspectRatio ?? fallbackAspectRatio;

  const openViewer = (event: GestureResponderEvent) => {
    event.stopPropagation();
    setViewerVisible(true);
  };

  return (
    <>
      <View
        onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
        style={[
          styles.frame,
          layout?.isExpandable ? { height: layout.previewHeight } : { aspectRatio },
          style,
        ]}
      >
        <MediaImage
          {...props}
          media={media}
          onLoad={(event) => {
            const nextDimensions = imageDimensionsFromLoadEvent(event);
            if (nextDimensions) setDimensions(nextDimensions);
            onLoad?.(event);
          }}
          resizeMode="contain"
          style={[styles.image, { aspectRatio }]}
        />
        {layout?.isExpandable ? (
          <View pointerEvents="box-none" style={styles.expandOverlay}>
            <LinearGradient
              colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.9)", "#FFFFFF"]}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />
            <Pressable
              accessibilityLabel="사진 전체보기"
              accessibilityRole="button"
              onPress={openViewer}
              style={({ pressed }) => [styles.expandButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.expandButtonText}>사진 전체보기</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setViewerVisible(false)}
        statusBarTranslucent
        visible={viewerVisible}
      >
        <View style={[styles.viewer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.viewerHeader}>
            <View style={styles.viewerHeaderSpacer} />
            <Text style={styles.viewerTitle}>사진 전체보기</Text>
            <Pressable
              accessibilityLabel="사진 전체보기 닫기"
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => setViewerVisible(false)}
              style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]}
            >
              <Ionicons color="#FFFFFF" name="close" size={28} />
            </Pressable>
          </View>
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.viewerContent}
            showsVerticalScrollIndicator
          >
            <MediaImage
              {...props}
              media={media}
              resizeMode="contain"
              style={[styles.viewerImage, { aspectRatio }]}
            />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: "relative",
    width: "100%",
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  image: {
    width: "100%",
    height: undefined,
    backgroundColor: "#F3F4F6",
  },
  expandOverlay: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    height: 112,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 18,
  },
  expandButton: {
    minHeight: 38,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E5EA",
    borderRadius: 999,
    paddingHorizontal: 18,
    backgroundColor: "#FFFFFF",
  },
  expandButtonText: {
    color: "#15171C",
    fontSize: 14,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.7,
  },
  viewer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  viewerHeader: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#242424",
    paddingHorizontal: 16,
  },
  viewerHeaderSpacer: {
    width: 40,
  },
  viewerTitle: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  viewerContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  viewerImage: {
    width: "100%",
    height: undefined,
    backgroundColor: "#000000",
  },
});
