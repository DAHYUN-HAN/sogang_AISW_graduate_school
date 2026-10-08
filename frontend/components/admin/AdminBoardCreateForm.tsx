import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { View } from "react-native";
import { AppText as Text } from "../AppTypography";
import { boardApi } from "../../services/api";
import type { Board } from "../../types";
import { ADMIN_BOARD_GROUPS, ADMIN_BOARD_SECTION_DEFINITIONS, adminBoardCreationType, adminBoardSection, type AdminBoardSectionKey } from "../../utils/adminBoardTree";
import { ActionButton, BOARD_TYPE_LABELS, Field } from "./AdminControls";
import { useAdminAlert } from "../../utils/adminAlert";
import { setWriteLeaveGuard } from "../../stores/writeLeaveGuard";

const selectStyle = {fontFamily:"inherit", fontSize:14, color:"#374151", background:"white", border:"1px solid #E1E4E9", borderRadius:6, padding:10, width:"100%"};
const labelStyle = {display:"flex", flexDirection:"column", gap:8, fontFamily:"inherit", fontSize:13, color:"#374151", fontWeight:500} as const;
export default function AdminBoardCreateForm({boards, initialSection, initialParent, onCreated, onBusy}: {
  boards:Board[]; initialSection:AdminBoardSectionKey; initialParent:number|null; onCreated:(board:Board)=>void; onBusy:(busy:boolean)=>void;
}) {
  const adminAlert = useAdminAlert();
  const queryClient=useQueryClient();
  const [section,setSection]=useState(initialSection);
  const [parent,setParent]=useState<number|null>(initialParent);
  const [name,setName]=useState("");
  const [description,setDescription]=useState("");
  const [slug,setSlug]=useState("");
  const [type,setType]=useState<string>(adminBoardCreationType(initialSection,boards.find(b=>b.id===initialParent)));
  const [read,setRead]=useState("user");
  const [write,setWrite]=useState(initialSection==="notices" || ["club","networking"].includes(initialSection)?"admin":"user");
  const [anonymous,setAnonymous]=useState(false);
  const [active,setActive]=useState(true);
  const [saving,setSaving]=useState(false);
  const definition=ADMIN_BOARD_SECTION_DEFINITIONS.find(s=>s.key===section)!;
  const parents=boards.filter(b=>adminBoardSection(b)===section && b.is_active!==false);
  const changeSection=(key:AdminBoardSectionKey)=>{setSection(key);setParent(null);setType(adminBoardCreationType(key));};
  const dirty=Boolean(name||description||slug);
  useEffect(()=>{
    if(!dirty)return;
    setWriteLeaveGuard(proceed=>adminAlert.alert("작성 내용 확인","게시판 등록 내용을 닫을까요?",[{text:"계속 작성",style:"cancel"},{text:"닫기",onPress:()=>{setWriteLeaveGuard(null);proceed();}}]));
    const beforeUnload=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};window.addEventListener("beforeunload",beforeUnload);
    return()=>{setWriteLeaveGuard(null);window.removeEventListener("beforeunload",beforeUnload);};
  },[dirty,adminAlert]);
  const save=async()=>{
    if(saving)return;
    if(!name.trim()){adminAlert.alert("게시판 등록", "게시판 이름을 입력하세요.");return;}
    const targetParent=boards.find(b=>b.id===parent);
    const address=slug.trim()||`board-${Date.now()}`;
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(address)){adminAlert.alert("게시판 등록", "주소에는 영문 소문자, 숫자와 하이픈을 사용하세요.");return;}
    setSaving(true);
    onBusy(true);
    try {
      const result=await boardApi.createAdminBoard({name:name.trim(),slug:address,category:targetParent?.category??definition.category,
        board_type:type,description:description.trim()||undefined,sort_order:Math.max(0,...boards.map(b=>b.sort_order))+1,
        allow_anonymous:anonymous,read_permission:read,write_permission:write,is_active:active,
        metadata:{admin_navigation:{section,parent_board_id:parent}}});
      await Promise.all([queryClient.invalidateQueries({queryKey:["admin-boards"]}),queryClient.invalidateQueries({queryKey:["boards"]}),queryClient.invalidateQueries({queryKey:["admin-audit-logs"]}),queryClient.invalidateQueries({queryKey:["admin-main"]})]);
      onCreated(result.data);
    } catch {adminAlert.alert("등록 실패", "게시판 주소 중복이나 상위 게시판 상태를 확인해 주세요.");}
    finally{setSaving(false);onBusy(false);}
  };
  return <View style={{gap:18}}>
    <Text style={{fontSize:13,color:"#6B7280"}}>분류와 위치를 선택해 세부 게시판을 만듭니다.</Text>
    <label style={labelStyle}>상위 분류<select disabled={saving} style={selectStyle} aria-label="상위 분류" value={definition.scope} onChange={e=>{const next=ADMIN_BOARD_SECTION_DEFINITIONS.find(s=>s.scope===e.target.value)!;changeSection(next.key);}}>{ADMIN_BOARD_GROUPS.map(g=><option key={g.key} value={g.key}>{g.label}</option>)}</select></label>
    <label style={labelStyle}>세부 위치<select disabled={saving} style={selectStyle} aria-label="세부 위치" value={section} onChange={e=>changeSection(e.target.value as AdminBoardSectionKey)}>{ADMIN_BOARD_SECTION_DEFINITIONS.filter(s=>s.scope===definition.scope).map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
    <label style={labelStyle}>상위 게시판<select disabled={saving} style={selectStyle} aria-label="상위 게시판" value={parent??""} onChange={e=>setParent(e.target.value?Number(e.target.value):null)}><option value="">{definition.label} 바로 아래</option>{parents.map(b=><option key={b.id} value={b.id}>{b.name} 안에 만들기</option>)}</select></label>
    <Field value={name} onChangeText={setName} placeholder="게시판 이름" editable={!saving} />
    <Field value={description} onChangeText={setDescription} placeholder="게시판 설명 (선택)" multiline editable={!saving} />
    <details><summary style={{color:"#6B7280"}}>추가 설정</summary><View style={{gap:14,marginTop:14}}>
      <Field value={slug} onChangeText={setSlug} placeholder="게시판 주소 (자동 생성)" editable={!saving} />
      <label style={labelStyle}>게시판 유형<select disabled={saving} style={selectStyle} value={type} onChange={e=>setType(e.target.value)}>{Object.entries(BOARD_TYPE_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label style={labelStyle}>읽기 권한<select disabled={saving} style={selectStyle} value={read} onChange={e=>setRead(e.target.value)}><option value="user">회원</option><option value="admin">관리자</option><option value="guest">공개</option></select></label>
      <label style={labelStyle}>작성 권한<select disabled={saving} style={selectStyle} value={write} onChange={e=>setWrite(e.target.value)}><option value="user">회원</option><option value="admin">관리자</option></select></label>
      <label style={{...labelStyle,flexDirection:"row",alignItems:"center"}}><input type="checkbox" checked={anonymous} disabled={saving} onChange={e=>setAnonymous(e.target.checked)} /> 익명 작성 허용</label>
      <label style={{...labelStyle,flexDirection:"row",alignItems:"center"}}><input type="checkbox" checked={active} disabled={saving} onChange={e=>setActive(e.target.checked)} /> 즉시 표시</label>
    </View></details>
    <ActionButton label={saving?"등록 중":"게시판 등록"} onPress={()=>void save()} disabled={saving} />
  </View>;
}
