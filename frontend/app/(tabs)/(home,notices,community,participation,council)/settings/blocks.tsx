import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { AppText as Text } from "../../../../components/AppTypography";

import BackButton from "../../../../components/BackButton";
import LoadingState from "../../../../components/LoadingState";
import { userApi } from "../../../../services/api";
import type { BlockedUserItem } from "../../../../types";

const COLORS = {
  navy: "#112d4e",
  blue: "#2563eb",
  red: "#b91c1c",
  bg: "#f4f7fb",
  border: "#dbe3ef",
  text: "#111827",
  muted: "#64748b",
};

function BlockedUserCard({ item }: { item: BlockedUserItem }) {
  const queryClient = useQueryClient();

  const unblock = () => {
    Alert.alert("차단 해제", `${item.blocked_user_nickname}님의 차단을 해제할까요?`, [
      { text: "취소", style: "cancel" },
      {
        text: "해제",
        onPress: async () => {
          try {
            await userApi.unblockUser(item.blocked_user_id);
            queryClient.invalidateQueries({ queryKey: ["blocked-users"] });
            queryClient.invalidateQueries({ queryKey: ["posts"] });
            queryClient.invalidateQueries({ queryKey: ["comments"] });
          } catch {
            Alert.alert("해제 실패", "차단을 해제할 수 없습니다.");
          }
        },
      },
    ]);
  };

  return (
    <View style={{ borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: "#ffffff", padding: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Ionicons name="person-remove-outline" size={20} color={COLORS.red} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: "900" }}>{item.blocked_user_nickname}</Text>
          <Text style={{ color: COLORS.muted, marginTop: 3 }}>{new Date(item.created_at).toLocaleString()}</Text>
        </View>
        <Pressable onPress={unblock} style={{ borderRadius: 8, backgroundColor: "#eff6ff", paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text style={{ color: COLORS.blue, fontWeight: "900" }}>해제</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function BlockedUsersScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ["blocked-users"],
    queryFn: userApi.getBlockedUsers,
  });
  const blocks = data?.data ?? [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <BackButton fallback="/(tabs)/settings" />
      <Text style={{ color: COLORS.navy, fontSize: 24, fontWeight: "900", marginTop: 12 }}>차단 관리</Text>
      <Text style={{ color: COLORS.muted, lineHeight: 20, marginTop: 6 }}>
        차단한 작성자의 게시글, 댓글, 검색 결과는 내 화면에서 숨겨집니다.
      </Text>

      {isLoading ? <LoadingState compact style={{ backgroundColor: "transparent" }} /> : null}
      {!isLoading && blocks.length === 0 ? (
        <View style={{ marginTop: 14, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: "#ffffff", padding: 18 }}>
          <Text style={{ color: COLORS.muted }}>차단한 작성자가 없습니다.</Text>
        </View>
      ) : null}
      <View style={{ gap: 10, marginTop: 14 }}>
        {blocks.map((item) => (
          <BlockedUserCard key={item.id} item={item} />
        ))}
      </View>
    </ScrollView>
  );
}
