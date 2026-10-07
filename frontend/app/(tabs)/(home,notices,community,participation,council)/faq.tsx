import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text } from "../../../components/AppTypography";
import { NetworkErrorFallback } from "../../../components/NetworkErrorState";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import LoadingState from "../../../components/LoadingState";
import NaturalAspectMediaImage from "../../../components/NaturalAspectMediaImage";
import { faqApi } from "../../../services/api";
import type { FAQItem } from "../../../types";
import {
  createFaqAccordionState,
  faqRowPresentation,
  toggleFaqExpansion,
} from "../../../utils/faqAccordion";
import { navigateToTabRoot } from "../../../utils/tabNavigation";

import { BackIcon, EmptyDocumentIcon } from "../../../components/icons";
const COLORS = {
  primary: "#2761FF",
  qBadgeBg: "#E6F1FB", // Figma 62:77 Q badge
  qBadgeText: "#0C447C",
  bg: "#FFFFFF",
  border: "#E1E4E9",
  text: "#15171C",
  muted: "#6B7280",
};

export default function FAQScreen() {
  const insets = useSafeAreaInsets();
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [expandedFaqIds, setExpandedFaqIds] = useState<Set<number>>(createFaqAccordionState);

  // FAQ는 원우회 탭 스택 위에 쌓이므로 pop 하면 원우회로 돌아간다.
  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else navigateToTabRoot("council");
  }, []);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== "android") return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });
    return () => subscription.remove();
  }, [handleBack]));

  const loadFAQs = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    setLoadError(null);
    try {
      const response = await faqApi.getFAQs();
      setFaqs(response.data);
    } catch (error) {
      setLoadError(error);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFAQs();
  }, [loadFAQs]);

  const visibleFAQs = useMemo(() => faqs.filter((item) => item.is_active !== false), [faqs]);
  const toggleFAQ = useCallback((faqId: number) => {
    setExpandedFaqIds((current) => toggleFaqExpansion(current, faqId));
  }, []);

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 10) }]}>
        <Pressable accessibilityLabel="뒤로" onPress={handleBack} style={styles.iconButton}>
          <BackIcon size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.appBarTitle}>자주 묻는 질문</Text>
        <View style={styles.iconButton} />
      </View>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <NetworkErrorFallback error={loadError} onRetry={() => void loadFAQs()}>
          <View style={styles.center}>
            <Text style={styles.errorText}>FAQ를 불러오지 못했습니다.</Text>
            <Pressable accessibilityRole="button" onPress={() => void loadFAQs()} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>다시 시도</Text>
            </Pressable>
          </View>
        </NetworkErrorFallback>
      ) : (
        <ScrollView style={styles.scroller} contentContainerStyle={styles.content}>
          {visibleFAQs.length === 0 ? (
            <View style={styles.emptyBox}>
              <EmptyDocumentIcon size={32} />
              <Text style={styles.emptyTitle}>등록된 자주 묻는 질문이 없어요</Text>
              <Text style={styles.emptyDescription}>궁금한 점은 건의사항에 남겨주세요</Text>
            </View>
          ) : null}

          {visibleFAQs.map((item, index) => {
            const presentation = faqRowPresentation(expandedFaqIds, item.id);
            return (
              <View key={item.id} style={[styles.faqItem, index === visibleFAQs.length - 1 ? styles.faqItemLast : null]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: presentation.expanded }}
                  onPress={() => toggleFAQ(item.id)}
                  style={styles.questionRow}
                >
                  <View style={styles.questionBadge}>
                    <Text style={styles.questionBadgeText}>Q</Text>
                  </View>
                  <Text style={styles.questionText}>{item.question}</Text>
                  <Ionicons name={presentation.chevron} size={18} color={COLORS.muted} />
                </Pressable>
                {presentation.showAnswer ? (
                  <View style={styles.answerRow}>
                    <View style={styles.answerBadge}>
                      <Text style={styles.answerBadgeText}>A</Text>
                    </View>
                    <View style={styles.answerContent}>
                      <Text style={styles.answerText}>{item.answer}</Text>
                      {item.attachments
                        .filter((attachment) => attachment.content_type.startsWith("image/"))
                        .map((attachment) => (
                          <NaturalAspectMediaImage
                            key={attachment.id}
                            media={attachment}
                            style={styles.answerImage}
                          />
                        ))}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  appBar: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.bg,
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  appBarTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "500", // Figma: Inter Medium
  },
  scroller: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  errorText: {
    color: COLORS.muted,
    fontSize: 14,
  },
  retryButton: {
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  faqItem: {
    gap: 8,
    paddingVertical: 13,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  faqItemLast: {
    borderBottomWidth: 0,
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  answerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  answerContent: {
    flex: 1,
    gap: 10,
  },
  answerImage: {
    borderRadius: 8,
    overflow: "hidden",
  },
  questionBadge: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: COLORS.qBadgeBg,
  },
  questionBadgeText: {
    color: COLORS.qBadgeText,
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 13,
  },
  answerBadge: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  answerBadgeText: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 13,
  },
  questionText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500", // Figma: Medium
    lineHeight: 17,
  },
  answerText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "400", // Figma: Regular
    lineHeight: 20,
  },
  emptyBox: {
    flex: 1,
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },
  emptyTitle: {
    color: "#2C3038",
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 26,
  },
  emptyDescription: {
    color: "#8A919C",
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
  },
});
