import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import test from "node:test";
import ts from "typescript";

function route(mode: "edit" | "create", boardType: string | undefined, platform = "web", isNotice = false, queryState = "success") {
  const path = resolve(mode === "edit" ? "app/admin/boards/post/[postId]/edit.tsx" : "app/admin/boards/create.tsx");
  const requireNative = createRequire(path);
  let retries=0;
  const load = (file: string): any => {
    const module = {exports: {} as any};
    const compiled = ts.transpileModule(readFileSync(file, "utf8"), {compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    }}).outputText;
    new Function("module", "exports", "require", compiled)(module, module.exports, (id: string) => {
      if (id === "react-native") return {Platform: {OS: platform}, View:"View", Pressable:"Pressable"};
      if (id === "expo-router") return {Redirect: "Redirect", useLocalSearchParams: () => ({postId: "88", boardId: "9"})};
      if (id.endsWith("/hooks/usePosts")) return {usePostDetail: () => ({data: {data: {id: 88, board_id: 9, is_notice: isNotice}}, isLoading: false, refetch:()=>{retries++;}})};
      if (id.endsWith("/hooks/useApi")) return {useBoardsQuery: () => ({data: {data: [{boards: boardType ? [{id: 9, board_type: boardType}] : []}]}, isLoading: queryState==="loading",isError:queryState==="error",refetch:()=>{retries++;}})};
      if (id.endsWith("/AdminWorkspace")) return {useAdminWorkspace:()=>({boards:boardType?[{id:9,board_type:boardType}]:[],boardsQuery:{isPending:queryState==="loading",isError:queryState==="error",isSuccess:queryState==="success",refetch:()=>{retries++;}}})};
      if (id.includes("/(tabs)/(home,notices,community,participation,council)/board/post/")) return {__esModule: true, default: "GenericEditor"};
      if (id.endsWith("/LoadingState")) return {__esModule: true, default: "Loading"};
      if (id.endsWith("/BackButton")) return {__esModule:true,default:"BackButton"};
      if (id.endsWith("/AppTypography")) return {AppText:"Text"};
      if (id.startsWith(".")) return load(resolve(dirname(file), `${id}.tsx`));
      return requireNative(id);
    });
    return module.exports;
  };
  const Component = load(path).default;
  let element=typeof Component === "function" ? Component() : {type: Component, props: {}};
  if(typeof element.type==="function")element=element.type(element.props);
  return {...element,retries:()=>retries};
}

test("legacy administrator notice edit deep links replace the generic composer with the dedicated editor", () => {
  const element = route("edit", "notice");
  assert.equal(element.type, "Redirect");
  assert.deepEqual(element.props.href, {pathname: "/admin/boards", params: {editNoticeId: "88"}});
});
test("an ordinary-board pinned notice still uses the ordinary composer", () => {
  assert.equal(route("edit", "post", "web", true).type, "GenericEditor");
});
test("legacy administrator notice create deep links use the dedicated notice draft", () => {
  const element = route("create", "notice");
  assert.equal(element.type, "Redirect");
  assert.deepEqual(element.props.href, {pathname: "/admin/boards", params: {createNoticeBoardId: "9"}});
});
test("ordinary administrator posts retain the generic create and edit composers", () => {
  assert.equal(route("edit", "post").type, "GenericEditor");
  assert.equal(route("create", "post").type, "GenericEditor");
});
test("notice route adapters introduce no native administrator editor", () => {
  assert.equal(route("edit", "notice", "android").type, "GenericEditor");
  assert.equal(route("create", "notice", "ios").type, "GenericEditor");
});

for(const mode of ["edit","create"] as const){
  test(`${mode} blocks unsafe generic notice editing while the board lookup loads`,()=>{
    const element=route(mode,undefined,"web",true,"loading");
    const children=element.props.children.flat().filter(Boolean);
    assert.ok(children.find((child:any)=>child.type==="Loading"));
    assert.ok(children.find((child:any)=>child.type==="BackButton"));
  });
  test(`${mode} offers retry and Back when the board lookup fails or has no matching board`,()=>{
    for(const state of ["error","success"]){
      const element=route(mode,undefined,"web",true,state);
      const children=element.props.children.flat().filter(Boolean);
      assert.ok(children.find((child:any)=>child.type==="BackButton"));
      children.find((child:any)=>child.type==="Pressable").props.onPress();
      assert.ok(element.retries()>0);
    }
  });
}
