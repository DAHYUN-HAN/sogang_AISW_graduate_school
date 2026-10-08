import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createAdminDialogQueue } from "../utils/adminDialogQueue";
import { adminMemberPasswordError } from "../utils/adminMemberEditing";

function harness() {
  const path = resolve("utils/adminAlert.ts"), nativeRequire = createRequire(path);
  let store: any;
  const load = (file: string, additions: Record<string, unknown> = {}) => {
    const module = {exports: {} as any};
    const compiled = ts.transpileModule(readFileSync(file, "utf8"), {compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
    }}).outputText;
    new Function("module", "exports", "require", "__DEV__", compiled)(module, module.exports, (id: string) => {
      if (id in additions) return additions[id];
      if (id === "react-native") return {Platform: {OS: "web"}, Modal: "Modal", View: "View", Pressable: "Pressable"};
      if (id === "./adminDialogQueue") return {createAdminDialogQueue};
      if (id === "expo-secure-store") return {};
      if (id.endsWith("/userStore")) return {useUserStore: store};
      if (id === "react") return {useMemo: (fn: () => unknown) => fn(), useSyncExternalStore: (_: unknown, snapshot: () => unknown) => snapshot()};
      return nativeRequire(id);
    }, true);
    return module.exports;
  };
  store=load(resolve("stores/userStore.ts")).useUserStore;
  const user=(id:number)=>({id,role:"admin",email:`admin${id}@example.test`,nickname:`Admin ${id}`});
  store.getState().setSession({user:user(1),access_token:"dummy-A",refresh_token:"session-A"});
  const alerts = load(path);
  const currentAlert = () => alerts.useAdminAlert?.() ?? alerts.adminAlert;
  return {queue: alerts.adminDialogQueue, currentAlert, load, store, switchSession: (token: string, id = 1, authenticated = true) => {
    if(authenticated)store.getState().setSession({user:user(id),access_token:`dummy-${id}`,refresh_token:token});
    else store.getState().clearSession();
  }};
}

for (const [name, token, id, authenticated] of [
  ["principal change", "session-B", 2, true],
  ["same-account new authentication session", "session-B", 1, true],
  ["logout", "", 1, false],
] as const) {
  test(`${name} discards queued administrator callbacks without executing or dismissing them`, () => {
    const view = harness(), effects: string[] = [];
    view.currentAlert().alert("게시판 숨김", "", [{text: "취소", style: "cancel", onPress: () => effects.push("cancel")}, {text: "숨김", onPress: () => effects.push("delete")}], {onDismiss: () => effects.push("dismiss")});
    view.currentAlert().alert("두 번째", "", [{onPress: () => effects.push("second")}]);
    view.switchSession(token, id, authenticated);
    assert.equal(view.queue.current(), null);
    view.queue.choose(1); view.queue.cancel();
    assert.deepEqual(effects, []);
  });
}

test("late async alerts from A cannot enqueue confirmations in session B", async () => {
  const view = harness(), origin = view.currentAlert();
  let finish!: () => void;
  const pending = new Promise<void>(resolve => {finish = resolve;});
  const operation = (async () => {await pending; origin.alert("오래된 복구", "", [{text: "다시 실행", onPress: () => assert.fail("old callback ran")}]);})();
  view.switchSession("session-B", 2);
  view.currentAlert().alert("새 작업");
  finish(); await operation;
  assert.equal(view.queue.current()?.title, "새 작업");
  view.queue.choose(0);
  assert.equal(view.queue.current(), null);
});

test("actual board archive confirmation cannot emit an Axios deletion under a replacement administrator", async () => {
  const view = harness();
  const api = view.load(resolve("services/api.ts"), {"expo-constants": {__esModule: true, default: {expoConfig: {}}}});
  const requests: unknown[] = [];
  api.api.defaults.adapter = async (config: unknown) => {requests.push(config); return {data: {status: "success", data: {}}, status: 200, statusText: "OK", headers: {}, config};};
  const source = ts.createSourceFile("boards.tsx", readFileSync("components/admin/pages/AdminBoardsWebPage.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let archive: ts.Expression | undefined;
  function visit(node: ts.Node) {if (ts.isVariableDeclaration(node) && node.name.getText(source) === "archive") archive = node.initializer; ts.forEachChild(node, visit);}
  visit(source); assert.ok(archive);
  const code = ts.transpileModule(`(${archive.getText(source)})({id:88,name:"A target"})`, {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText;
  runInNewContext(code, {adminAlert: view.currentAlert(), boardApi: api.boardApi, setBusy: () => {}, refresh: async () => {}, setPanel: () => {}});
  view.switchSession("session-B", 2);
  view.queue.choose(1);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, []);
  assert.equal(view.queue.current(), null);
});

test("administrator host unmount drops pending and late callbacks without invoking cancellation", () => {
  const view = harness(), origin = view.currentAlert();
  let cleanup: (() => void) | undefined;
  const host = view.load(resolve("components/admin/AdminAlertHost.tsx"), {
    "react": {useEffect: (fn: () => (() => void)) => {cleanup = fn();}, useSyncExternalStore: (_: unknown, snapshot: () => unknown) => snapshot()},
    "../../utils/adminAlert": {adminDialogQueue: view.queue}, "../AppTypography": {AppText: "Text"},
  });
  origin.alert("삭제", "", [{onPress: () => assert.fail("unmounted callback ran")}]);
  host.default(); cleanup?.();
  assert.equal(view.queue.current(), null);
  origin.alert("늦은 응답");
  assert.equal(view.queue.current(), null);
  view.currentAlert().alert("재진입");
  assert.equal(view.queue.current()?.title, "재진입");
});

function controllerCallback(path:string,name:string){
  const source=ts.createSourceFile(path,readFileSync(path,"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let expression:ts.Expression|undefined;
  const visit=(node:ts.Node)=>{if(ts.isVariableDeclaration(node)&&node.name.getText(source)===name)expression=node.initializer;ts.forEachChild(node,visit);};
  visit(source);assert.ok(expression);
  return ts.transpileModule(`(${expression.getText(source)})()`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
}

test("actual API token rotation preserves password confirmation and its originating recovery facade",async()=>{
  const view=harness(),origin=view.currentAlert(),passwordConfirming={current:false};
  const code=controllerCallback("components/admin/AdminMemberEditor.tsx","confirmPasswordReset");
  runInNewContext(code,{
    savingRef:{current:false},passwordConfirming,adminMemberPasswordError,newPassword:"NewPassword123!",confirmation:"NewPassword123!",
    currentUserId:1,item:{id:2,email:"admin2@example.test"},baseline:{nickname:"Admin 2"},profileDirty:false,
    setPasswordNotice:()=>{},adminAlert:origin,resetPassword:()=>assert.fail("must not reset without choosing confirm"),
  });
  assert.equal(passwordConfirming.current,true);
  const axios=createRequire(resolve("services/api.ts"))("axios");
  const calls:string[]=[];
  const api=view.load(resolve("services/api.ts"),{
    "expo-constants":{__esModule:true,default:{expoConfig:{}}},
    axios:{...axios,create:(config:unknown)=>{
      const client=axios.create(config);
      client.defaults.adapter=async(request:any)=>{
        calls.push(request.url);
        const response={status:200,statusText:"OK",headers:{},config:request,data:{status:"success",data:{}}};
        if(request.url==="/auth/refresh")return {...response,data:{status:"success",data:{access_token:"rotated-access",refresh_token:"rotated-refresh"}}};
        if(request.headers.Authorization==="Bearer dummy-A")throw new axios.AxiosError("expired","ERR_BAD_REQUEST",request,undefined,{...response,status:401});
        return response;
      };
      return client;
    }},
  });
  const generation=view.store.getState().sessionGeneration;
  await api.api.get("/admin/protected-test");
  assert.equal(view.store.getState().accessToken,"rotated-access");
  assert.equal(view.store.getState().sessionGeneration,generation);
  assert.deepEqual(calls,["/admin/protected-test","/auth/refresh","/admin/protected-test"]);
  assert.equal(view.queue.current()?.title,"비밀번호 재설정");
  view.queue.cancel();
  assert.equal(passwordConfirming.current,false,"refresh must not strand the editor's confirmation lock");
  origin.alert("저장 복구", "",[{text:"불러오기"}]);
  assert.equal(view.queue.current()?.title,"저장 복구","originating async facade remains usable after refresh");
});

test("replacing a login for the same principal invalidates old intent even when tokens are unchanged",()=>{
  const view=harness(),origin=view.currentAlert();
  origin.alert("old", "",[{onPress:()=>assert.fail("old login callback ran")}]);
  const session=view.store.getState();
  session.setSession({user:session.user,access_token:session.accessToken,refresh_token:session.refreshToken});
  assert.equal(view.queue.current(),null);
  origin.alert("late old login");
  assert.equal(view.queue.current(),null);
});

test("logout and relogin to the same principal reject late recovery from the earlier login",()=>{
  const view=harness(),origin=view.currentAlert();
  origin.alert("old login");
  view.store.getState().clearSession();
  view.switchSession("session-A",1);
  origin.alert("late recovery");
  assert.equal(view.queue.current(),null);
  view.currentAlert().alert("new login");
  assert.equal(view.queue.current()?.title,"new login");
});

test("actual self-profile save preserves pending confirmations and login generation",async()=>{
  const view=harness(),origin=view.currentAlert();
  origin.alert("pending profile-session confirmation");
  const session=view.store.getState(),generation=session.sessionGeneration;
  const item={...session.user,is_active:true,enrollment_status:"active",major:"AI",created_at:"2026-10-08T00:00:00Z"};
  const draft={...item,nickname:"New name",cohort:"9"};
  await runInNewContext(controllerCallback("components/admin/AdminMemberEditor.tsx","save"),{
    baseline:item,item,draft,profileDirty:true,savingRef:{current:false},activeMajors:[{name:"AI"}],
    memberUpdatePayload:(before:unknown,after:unknown)=>({nickname:"New name",cohort:"9"}),memberDraft:(value:unknown)=>value,
    setSaving:()=>{},setNotice:()=>{},setBaseline:()=>{},setDraft:()=>{},
    adminApi:{updateUser:async()=>{}},useUserStore:view.store,client:{invalidateQueries:async()=>{}},
  });
  assert.equal(view.store.getState().user.nickname,"New name");
  assert.equal(view.store.getState().sessionGeneration,generation);
  assert.equal(view.queue.current()?.title,"pending profile-session confirmation");
  view.queue.choose(0);origin.alert("profile recovery");
  assert.equal(view.queue.current()?.title,"profile recovery");
});
