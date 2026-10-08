import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { AppText as Text } from "../AppTypography";
import type { Board, PostListItem } from "../../types";
import { postApi } from "../../services/api";
import { homeNoticeCategory } from "../../utils/noticeFeed";
import { adminBoardTag, adminBoardVisiblePage } from "../../utils/adminBoardTree";
import { adminBoardContentControl } from "../../utils/adminContentManagement";
import { ActionButton, Field } from "./AdminControls";
import { useAdminWorkspace } from "./AdminWorkspace";
import AdminTable from "./AdminTable";
import { AdminBoardContentQueryState } from "./AdminBoardContentPanel";

export default function AdminBoardPostsTable({boards, boardIds, noticeCategory, onNoticeEdit}: {
  boards:Board[];boardIds:number[]|null;noticeCategory?:"academic"|"event"|"other";
  onNoticeEdit:(post:PostListItem)=>void;
}) {
  const router=useRouter();
  const workspace=useAdminWorkspace();
  const [search,setSearch]=useState("");
  const [applied,setApplied]=useState("");
  const [mode,setMode]=useState("all");
  const [page,setPage]=useState(1);
  const [menu,setMenu]=useState<number|null>(null);
  const params={page,size:10,q:applied||undefined,board_ids:boardIds?.join(","),notice_category:noticeCategory,
    is_pinned:mode==="pinned"?true:undefined,is_notice:mode==="notice"?true:undefined};
  const query=useQuery({queryKey:["admin-posts","board-console",params],queryFn:()=>postApi.getAdminPosts(params),enabled:boardIds===null||boardIds.length>0,refetchInterval:30_000});
  const rows=query.data?.data??[];
  const total=query.data?.pagination?.total??0;
  const pages=query.data?.pagination?.total_pages??0;
  useEffect(()=>{if(query.isSuccess&&page>Math.max(1,pages))setPage(adminBoardVisiblePage(page,pages));},[pages,page,query.isSuccess]);
  const link=(label:string,onPress:()=>void)=><Pressable accessibilityRole="button" onPress={onPress} style={{paddingVertical:6,paddingHorizontal:4}}><Text style={{fontSize:13,color:"#374151"}}>{label}</Text></Pressable>;
  const edit=(post:PostListItem)=>{setMenu(null);if(boards.find(b=>b.id===post.board_id)?.board_type==="notice")onNoticeEdit(post);else router.push(`/admin/boards/post/${post.id}/edit` as never);};
  return <View style={{gap:16}}>
    <View style={{flexDirection:"row",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <View style={{flexGrow:1,flexBasis:240}}><Field value={search} onChangeText={setSearch} placeholder="제목·내용·작성자 검색" /></View>
      <ActionButton label="검색" tone="outline" onPress={()=>{setApplied(search.trim());setPage(1);}} />
      <select aria-label="게시글 상태" value={mode} onChange={e=>{setMode(e.target.value);setPage(1);}} style={{fontFamily:"inherit",fontSize:13,padding:11,border:"1px solid #E1E4E9",borderRadius:6,background:"white",color:"#374151"}}><option value="all">전체 상태</option><option value="notice">공지글</option><option value="pinned">고정글</option></select>
    </View>
    <Text style={{fontSize:12,color:"#6B7280"}}>전체 {total}건</Text>
    <AdminBoardContentQueryState isLoading={query.isLoading} isError={query.isError} isEmpty={!query.isLoading&&!query.isError&&rows.length===0} emptyMessage="표시할 게시글이 없습니다." onRetry={()=>void query.refetch()} />
    {rows.length>0?<AdminTable minimumWidth={620} columns={[{label:"제목 · 태그",flex:4},{label:"작성자",width:90},{label:"작성일",width:80},{label:"상태",width:64},{label:"작업",width:64}]} rows={rows.map(post=>{
      const board=boards.find(b=>b.id===post.board_id);
      const caption=board?.board_type==="notice"?homeNoticeCategory(post,board):board?adminBoardTag(board):post.board_name;
      return {key:post.id,cells:[
        <View key="title" style={{gap:7}}><Pressable accessibilityRole="link" onPress={()=>router.push(`/admin/boards/post/${post.id}` as never)}><Text style={{fontSize:14,color:"#111827",fontWeight:"500"}}>{post.title}</Text></Pressable><Text style={{fontSize:12,color:"#6B7280"}}>{caption}{post.activity_source_title?` · ${post.activity_source_title}`:""}</Text>
          {post.poll_summary ? <Pressable accessibilityRole="button" accessibilityLabel={`${post.title} 투표 관리 · 투표 ${post.poll_summary.question_count}개 · 진행 ${post.poll_summary.open_count} · 종료 ${post.poll_summary.closed_count} · 응답자 ${post.poll_summary.participant_count}명`} onPress={()=>edit(post)} style={{paddingVertical:6}}>
            <Text style={{fontSize:12,color:"#2761FF",lineHeight:19}}>투표 {post.poll_summary.question_count}개 · 진행 {post.poll_summary.open_count} · 종료 {post.poll_summary.closed_count} · 응답자 {post.poll_summary.participant_count}명 ›</Text>
          </Pressable> : null}</View>,
        <Text key="author" style={{fontSize:13,color:"#6B7280"}}>{post.is_anonymous?"익명":post.author_nickname}</Text>,
        <Text key="date" style={{fontSize:12,color:"#6B7280"}}>{new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",month:"2-digit",day:"2-digit"}).format(new Date(post.created_at))}</Text>,
        <Text key="status" style={{fontSize:12,color:"#374151"}}>{post.status==="hidden"?"숨김":post.status==="draft"?"임시저장":post.is_pinned?"고정":post.is_notice?"공지":"일반"}</Text>,
        <View key="menu" style={{gap:5}}><Pressable accessibilityRole="button" accessibilityLabel={`${post.title} 작업`} onPress={()=>setMenu(menu===post.id?null:post.id)} style={{padding:4}}><Text style={{fontSize:20,color:"#6B7280"}}>⋯</Text></Pressable>{menu===post.id?<View style={{gap:2}}>{link("수정",()=>edit(post))}{link(post.is_pinned?"고정 해제":"고정",()=>{setMenu(null);void workspace.handlePinAdminPost(post);})}{board&&adminBoardContentControl(board).canReplaceRepresentativeImage?link("대표 이미지",()=>{setMenu(null);void workspace.handleReplacePostRepresentativeImage(post);}):null}{link("삭제",()=>{setMenu(null);workspace.handleDeleteAdminPost(post);})}</View>:null}</View>,
      ]};
    })} />:null}
    {pages>1?<View style={{flexDirection:"row",gap:14,alignItems:"center",justifyContent:"center"}}><ActionButton label="이전" tone="outline" disabled={page<=1||query.isFetching} onPress={()=>setPage(p=>p-1)} /><Text style={{fontSize:13,color:"#6B7280"}}>{page} / {pages}</Text><ActionButton label="다음" tone="outline" disabled={page>=pages||query.isFetching} onPress={()=>setPage(p=>p+1)} /></View>:null}
  </View>;
}
