import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import { useMediaAccessUrl } from "../hooks/useMediaAccessUrl";
import type { MediaReference } from "../utils/mediaAccess";
import { imageDimensionsFromLoadEvent, type ImageDimensions } from "../utils/imageDimensions";
import {
  activityImageFrame,
  activityImageOrientation,
  resolveActivityImageRule,
  type ActivityImageLayout,
} from "../utils/activityImageLayout";
import MediaImage from "./MediaImage";

type Props = {
  layout: ActivityImageLayout;
  media: MediaReference;
  // 여러 장을 한 프레임에서 넘길 때, 바깥에서 프레임 높이를 맞추는 데 쓴다.
  onFrameHeight?: (height: number) => void;
};

const FALLBACK_ASPECT_RATIO = 16 / 9;

export default function ActivityCertificationMediaImage({ layout, media, onFrameHeight }: Props) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [dimensions, setDimensions] = useState<ImageDimensions>();
  const { uri } = useMediaAccessUrl(media);

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    Image.getSize(
      uri,
      (width, height) => {
        if (!cancelled && width > 0 && height > 0) setDimensions({ width, height });
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const orientation = dimensions
    ? activityImageOrientation(dimensions.width, dimensions.height)
    : "default";
  const rule = resolveActivityImageRule(layout, orientation);
  const frame = dimensions
    ? activityImageFrame(
        layout,
        orientation,
        dimensions.width,
        dimensions.height,
        containerWidth,
      )
    : undefined;
  const fallbackWidth = containerWidth > 0
    ? Math.min(containerWidth, rule.max_width ?? containerWidth)
    : undefined;
  const fallbackHeight = rule.height;
  const resolvedHeight = frame?.height ?? rule.height ?? undefined;

  useEffect(() => {
    if (resolvedHeight !== undefined) onFrameHeight?.(resolvedHeight);
  }, [onFrameHeight, resolvedHeight]);

  return (
    <View
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
      style={styles.container}
    >
      <View
        style={[
          styles.frame,
          frame
            ? { width: frame.width, height: frame.height }
            : fallbackHeight !== null
              ? { width: fallbackWidth ?? "100%", height: fallbackHeight }
              : { width: fallbackWidth ?? "100%", aspectRatio: FALLBACK_ASPECT_RATIO },
        ]}
      >
        <MediaImage
          media={media}
          onLoad={(event) => {
            const nextDimensions = imageDimensionsFromLoadEvent(event);
            if (nextDimensions) setDimensions(nextDimensions);
          }}
          resizeMode={frame?.fit ?? rule.fit}
          style={styles.image}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
  },
  frame: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
