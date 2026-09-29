import { FontAwesome5 } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { postDetailRoute, type PostDetailReturnRoute } from "../utils/appRoutes";

// 공지 리스트/검색 결과가 항상 같은 디자인을 쓰도록 공용화한 행 컴포넌트.

export type NoticeRowModel = {
  key: string;
  postId?: number;
  title: string;
  category: string;
  date: string;
  isPinned?: boolean;
};

export function noticeRowTone(category: string) {
  if (category.includes("행사")) {
    return { backgroundColor: "#FBEAF0", color: "#993556" };
  }
  if (category.includes("특강")) {
    return { backgroundColor: "#E6F9FB", color: "#14788A" };
  }
  if (category.includes("기타")) {
    return { backgroundColor: "#F0EEF9", color: "#6543A2" };
  }
  return { backgroundColor: "#E6F1FB", color: "#0C447C" };
}

export default function NoticeRow({ item, isLast, returnTo }: { item: NoticeRowModel; isLast?: boolean; returnTo?: PostDetailReturnRoute }) {
  const tone = noticeRowTone(item.category);
  const postId = item.postId;
  const handlePress = postId ? () => router.push(postDetailRoute(postId, undefined, returnTo) as never) : undefined;

  return (
    <Pressable
      disabled={!handlePress}
      onPress={handlePress}
      style={[styles.noticeRow, item.isPinned ? styles.noticeRowPinned : null, isLast && !item.isPinned ? styles.noticeRowLast : null]}
    >
      <View style={styles.noticeMain}>
        <View style={styles.metaRow}>
          {item.isPinned ? <FontAwesome5 name="thumbtack" size={11} color="#1647D9" /> : null}
          <View style={[styles.categoryPill, { backgroundColor: tone.backgroundColor }]}>
            <Text style={[styles.categoryText, { color: tone.color }]}>{item.category}</Text>
          </View>
        </View>
        <Text numberOfLines={2} style={[styles.noticeTitle, item.isPinned ? styles.noticeTitlePinned : null]}>
          {item.title}
        </Text>
        <Text style={styles.noticeDate}>{item.date}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  noticeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E1E4E9",
    paddingVertical: 14,
  },
  noticeRowPinned: {
    borderBottomWidth: 0,
    borderRadius: 12,
    backgroundColor: "#EEF0F3",
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 6,
  },
  noticeRowLast: {
    borderBottomWidth: 0,
  },
  noticeMain: {
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryPill: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 13,
  },
  noticeTitle: {
    color: "#15171C",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 17,
    marginTop: 6,
  },
  noticeTitlePinned: {
    fontWeight: "500",
  },
  noticeDate: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 15,
    marginTop: 6,
  },
});
