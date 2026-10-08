import { useState } from "react";
import { Pressable, View } from "react-native";
import { AppText as Text } from "../AppTypography";
import type { Board } from "../../types";
import { ADMIN_BOARD_GROUPS, adminBoardParent, adminBoardSection, adminBoardSections, type AdminBoardSectionKey } from "../../utils/adminBoardTree";
import { adminScopeForBoard } from "../../utils/adminContentManagement";

export default function AdminBoardsSidebar({boards, selectedSection, selectedBoardId, noticeCategory, disabled, onSelect, onCreate}: {
  boards:Board[];selectedSection:AdminBoardSectionKey|null;selectedBoardId:number|null;noticeCategory:string|null;disabled:boolean;
  onSelect:(section:AdminBoardSectionKey|null,boardId:number|null,noticeCategory?:"academic"|"event"|"other")=>void;onCreate:()=>void;
}) {
  const [open,setOpen]=useState<string[]>(["council"]);
  const sections=adminBoardSections(boards);
  const choice=(label:string,selected:boolean,onPress:()=>void,indent=0,key=label)=><Pressable key={key} accessibilityRole="button" accessibilityState={{selected,disabled}} disabled={disabled} onPress={onPress} style={{paddingVertical:10,paddingHorizontal:10+indent*10,borderRadius:6,backgroundColor:selected?"#EDF2FE":"#FFFFFF",opacity:disabled?.55:1}}><Text style={{fontSize:13,color:selected?"#2761FF":"#374151",fontWeight:selected?"600":"400"}}>{label}</Text></Pressable>;
  const children=(parent:number,visited:number[]=[]):React.ReactNode=>boards.filter(b=>adminBoardParent(b)===parent && b.is_active!==false && !visited.includes(b.id)).map(b=><View key={b.id}>{choice(b.name,selectedBoardId===b.id,()=>onSelect(adminBoardSection(b),b.id),Math.min(visited.length+1,4))}{children(b.id,[...visited,b.id])}</View>);
  return <View style={{width:210,borderWidth:1,borderColor:"#E1E4E9",borderRadius:8,backgroundColor:"#FFFFFF",padding:12,gap:8,alignSelf:"flex-start"}}>
    <Text style={{fontSize:13,fontWeight:"600",padding:10}}>관리 분류</Text>
    {choice("모든 게시판",selectedSection===null&&selectedBoardId===null,()=>onSelect(null,null))}
    {ADMIN_BOARD_GROUPS.map(group=>{
      const expanded=open.includes(group.key)||sections.some(s=>s.key===selectedSection&&s.scope===group.key);
      return <View key={group.key} style={{gap:3}}>
        <Pressable accessibilityRole="button" accessibilityState={{expanded,disabled}} disabled={disabled} onPress={()=>setOpen(list=>list.includes(group.key)?list.filter(k=>k!==group.key):[...list,group.key])} style={{padding:10}}><Text style={{fontSize:13,fontWeight:"600",color:"#374151"}}>{expanded?"⌄":"›"} {group.label}</Text></Pressable>
        {expanded?sections.filter(s=>s.scope===group.key).map(section=>{
          if(section.key==="notices")return <View key={section.key}>{([['academic','학사공지'],['event','행사공지'],['other','기타공지']] as const).map(([key,label])=>choice(label,selectedSection==="notices"&&noticeCategory===key,()=>onSelect("notices",null,key),1))}<details><summary style={{fontSize:12,color:"#6B7280",padding:10}}>세부 게시판 설정</summary>{boards.filter(b=>section.boardIds.includes(b.id)&&!adminBoardParent(b)&&b.is_active!==false).map(b=><View key={b.id}>{choice(b.name,selectedBoardId===b.id,()=>onSelect("notices",b.id),1)}{children(b.id,[b.id])}</View>)}</details></View>;
          const known=boards.filter(b=>section.boardIds.includes(b.id)&&!b.metadata?.admin_navigation&&b.is_active!==false);
          const custom=boards.filter(b=>section.boardIds.includes(b.id)&&b.metadata?.admin_navigation&&!adminBoardParent(b)&&b.is_active!==false);
          return <View key={section.key}>{choice(section.label,selectedSection===section.key&&selectedBoardId===null,()=>onSelect(section.key,null),1)}{known.map(b=><View key={b.id}>{children(b.id,[b.id])}</View>)}{custom.map(b=><View key={b.id}>{choice(b.name,selectedBoardId===b.id,()=>onSelect(section.key,b.id),2)}{children(b.id,[b.id])}</View>)}</View>;
        }):null}
        {expanded?<details><summary style={{fontSize:12,color:"#6B7280",padding:10}}>추가 관리 항목</summary>{boards.filter(b=>adminScopeForBoard(b)===group.key&&adminBoardSection(b)===null&&b.is_active!==false).map(b=>choice(b.name,selectedBoardId===b.id,()=>onSelect(null,b.id),1))}</details>:null}
      </View>;
    })}
    {boards.some(b=>adminScopeForBoard(b)==="all"&&b.is_active!==false)?<details><summary style={{fontSize:12,color:"#6B7280",padding:10}}>기타 게시판</summary>{boards.filter(b=>adminScopeForBoard(b)==="all"&&b.is_active!==false).map(b=>choice(b.name,selectedBoardId===b.id,()=>onSelect(adminBoardSection(b),b.id),1))}</details>:null}
    <details><summary style={{fontSize:12,color:"#6B7280",padding:10}}>숨긴 게시판</summary>{boards.filter(b=>b.is_active===false).map(b=>choice(b.name,selectedBoardId===b.id,()=>onSelect(adminBoardSection(b),b.id),1))}</details>
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onCreate} style={{borderTopWidth:1,borderColor:"#E1E4E9",padding:12,marginTop:8}}><Text style={{fontSize:13,color:"#374151"}}>＋ 새 게시판</Text></Pressable>
  </View>;
}
