import { Pressable, View } from "react-native";
import BackButton from "../BackButton";
import LoadingState from "../LoadingState";
import { AppText as Text } from "../AppTypography";

export default function AdminPostRouteState({loading=false, onRetry}: {loading?:boolean; onRetry:()=>void}) {
  return <View style={{padding:24,gap:16}}>
    <BackButton fallback="/admin/boards" />
    {loading ? <LoadingState /> : <Text>게시글 또는 게시판 정보를 불러올 수 없습니다.</Text>}
    {!loading && <Pressable accessibilityRole="button" onPress={onRetry}><Text>다시 시도</Text></Pressable>}
  </View>;
}
