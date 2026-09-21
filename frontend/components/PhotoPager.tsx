import { useEffect, useRef, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

type Props<T> = {
  items: T[];
  index: number;
  onIndexChange: (next: number) => void;
  renderItem: (item: T, index: number) => ReactNode;
  itemKey: (item: T, index: number) => string;
};

/**
 * 사진을 좌우로 넘기는 페이저. 홈 배너(HomeBannerCarousel)와 같이 가로 ScrollView의
 * 페이징을 그대로 쓴다.
 *
 * PanResponder로 직접 판정하지 않는 이유가 둘 있다.
 * - 손가락을 따라 사진이 밀리지 않으면 아무리 임계값을 맞춰도 매끄럽게 느껴지지
 *   않는다. 네이티브 스크롤은 추적·관성·스냅을 전부 해준다.
 * - PanResponder는 onResponderTerminationRequest 기본값이 true라, 가로 스와이프를
 *   가져간 뒤에도 바깥 세로 ScrollView가 도로 가져갈 수 있다. 그러면 release가
 *   불리지 않아 그 스와이프가 통째로 사라진다. 네이티브 스크롤은 그럴 일이 없다.
 *
 * 탭과 스와이프 구분도 ScrollView가 처리하므로, 안에 Pressable을 그대로 두어도
 * 쓸어 넘기다 눌린 것으로 오인되지 않는다.
 *
 * 모든 페이지가 같은 높이를 가지므로, 사진마다 높이가 달라야 하는 화면에는 쓰지 않는다.
 */
export default function PhotoPager<T>({ items, index, onIndexChange, renderItem, itemKey }: Props<T>) {
  const scrollRef = useRef<ScrollView | null>(null);
  const [width, setWidth] = useState(0);
  // 스크롤이 만들어낸 변경까지 다시 scrollTo로 되돌리면 넘기는 중에 튄다.
  const settledIndex = useRef(index);

  useEffect(() => {
    if (width <= 0 || settledIndex.current === index) return;
    settledIndex.current = index;
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
  }, [index, width]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next <= 0 || next === width) return;
    setWidth(next);
    // 회전이나 첫 측정 뒤 현재 사진이 정확히 화면에 오도록 맞춘다.
    scrollRef.current?.scrollTo({ x: index * next, animated: false });
  };

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const next = Math.max(0, Math.min(Math.round(event.nativeEvent.contentOffset.x / width), items.length - 1));
    settledIndex.current = next;
    if (next !== index) onIndexChange(next);
  };

  return (
    <View onLayout={handleLayout} style={styles.viewport}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        decelerationRate="fast"
        scrollEnabled={items.length > 1}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {width > 0
          ? items.map((item, itemIndex) => (
              <View key={itemKey(item, itemIndex)} style={{ width, height: "100%" }}>
                {renderItem(item, itemIndex)}
              </View>
            ))
          : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    ...StyleSheet.absoluteFillObject,
  },
});
