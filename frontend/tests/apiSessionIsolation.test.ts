import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

type CapturedRequest={url:string;authorization:string;retry:boolean;headers:Record<string,unknown>};
function deferred(){let finish!:()=>void;const promise=new Promise<void>(resolve=>{finish=resolve;});return {promise,finish};}

function harness(adapter:(config:any,helpers:{success:(config:any,data?:unknown)=>unknown;unauthorized:(config:any)=>Error})=>Promise<unknown>){
  const nativeRequire=createRequire(resolve("services/api.ts")),axios=nativeRequire("axios");
  let store:any;
  const calls:CapturedRequest[]=[];
  const success=(config:any,data:unknown={})=>({status:200,statusText:"OK",headers:{},config,data:{status:"success",data}});
  const unauthorized=(config:any)=>new axios.AxiosError("expired","ERR_BAD_REQUEST",config,undefined,{...success(config),status:401});
  const load=(path:string)=>{
    const module={exports:{} as any};
    const compiled=ts.transpileModule(readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function("module","exports","require","__DEV__",compiled)(module,module.exports,(id:string)=>{
      if(id==="react-native")return {Platform:{OS:"web"}};
      if(id==="expo-secure-store")return {};
      if(id==="expo-constants")return {__esModule:true,default:{expoConfig:{}}};
      if(id==="../stores/userStore")return {useUserStore:store};
      if(id==="axios")return {...axios,create:(options:unknown)=>{
        const client=axios.create(options);
        client.defaults.adapter=async(config:any)=>{
          calls.push({url:config.url,authorization:config.headers.Authorization,retry:Boolean(config._retry),headers:config.headers.toJSON()});
          return adapter(config,{success,unauthorized});
        };
        return client;
      }};
      return nativeRequire(id);
    },true);
    return module.exports;
  };
  store=load(resolve("stores/userStore.ts")).useUserStore;
  const login=(id=1,access="access-A",refresh="refresh-A")=>store.getState().setSession({user:{id,role:"admin",email:`admin${id}@example.test`,nickname:`Admin ${id}`},access_token:access,refresh_token:refresh});
  login();
  return {store,api:load(resolve("services/api.ts")).api,calls,login};
}

for(const [label,id,access,refresh] of [["different principal",2,"access-B","refresh-B"],["same principal and identical tokens",1,"access-A","refresh-A"]] as const){
  test(`held administrator mutation never replays after login changes to ${label}`,async()=>{
    const started=deferred(),release=deferred();
    let first=true;
    const view=harness(async(config,{success,unauthorized})=>{
      if(config.url==="/auth/refresh")return success(config,{access_token:"rotated",refresh_token:"rotated-refresh"});
      if(first){first=false;started.finish();await release.promise;throw unauthorized(config);}
      return success(config);
    });
    const outcome=view.api.delete("/boards/admin/88").catch((error:unknown)=>error);
    await started.promise;view.login(id,access,refresh);
    const generation=view.store.getState().sessionGeneration;
    release.finish();await outcome;
    assert.deepEqual(view.calls.map(call=>[call.url,call.authorization]),[["/boards/admin/88","Bearer access-A"]],"no request may replay with replacement-session credentials");
    assert.equal(view.store.getState().isAuthenticated,true);
    assert.equal(view.store.getState().sessionGeneration,generation);
    assert.equal(view.store.getState().accessToken,access);
  });
}

test("a retried mutation's late 401 cannot clear the replacement login",async()=>{
  const retryStarted=deferred(),release=deferred();
  const view=harness(async(config,{success,unauthorized})=>{
    if(config.url==="/auth/refresh")return success(config,{access_token:"rotated-A",refresh_token:"rotated-refresh-A"});
    if(config.headers.Authorization==="Bearer access-A")throw unauthorized(config);
    retryStarted.finish();await release.promise;throw unauthorized(config);
  });
  const outcome=view.api.delete("/boards/admin/88").catch((error:unknown)=>error);
  await retryStarted.promise;view.login(2,"access-B","refresh-B");
  const generation=view.store.getState().sessionGeneration;
  release.finish();await outcome;
  assert.equal(view.store.getState().isAuthenticated,true,"the old retry cannot sign out B");
  assert.equal(view.store.getState().sessionGeneration,generation);
  assert.equal(view.store.getState().accessToken,"access-B");
  assert.deepEqual(view.calls.filter(call=>call.url==="/boards/admin/88").map(call=>call.authorization),["Bearer access-A","Bearer rotated-A"]);
});

test("login replacement after refresh resolves blocks the retry before adapter dispatch",async()=>{
  const view=harness(async(config,{success,unauthorized})=>{
    if(config.url==="/auth/refresh")return success(config,{access_token:"rotated-A",refresh_token:"rotated-refresh-A"});
    if(config.headers.Authorization==="Bearer access-A")throw unauthorized(config);
    return success(config);
  });
  const unsubscribe=view.store.subscribe((state:any)=>{
    if(state.accessToken==="rotated-A")queueMicrotask(()=>view.login(2,"access-B","refresh-B"));
  });
  await view.api.delete("/boards/admin/88").catch((error:unknown)=>error);unsubscribe();
  assert.deepEqual(view.calls.map(call=>[call.url,call.authorization]),[["/boards/admin/88","Bearer access-A"],["/auth/refresh",undefined]]);
  assert.equal(view.store.getState().accessToken,"access-B");
  assert.equal(view.store.getState().isAuthenticated,true);
});

test("concurrent expired requests retain one refresh and retry within the same login generation",async()=>{
  const started=deferred(),release=deferred();
  const view=harness(async(config,{success,unauthorized})=>{
    if(config.url==="/auth/refresh"){started.finish();await release.promise;return success(config,{access_token:"rotated-A",refresh_token:"rotated-refresh-A"});}
    if(config.headers.Authorization==="Bearer access-A")throw unauthorized(config);
    return success(config);
  });
  const generation=view.store.getState().sessionGeneration;
  const requests=[88,89,90].map(id=>view.api.delete(`/boards/admin/${id}`));
  await started.promise;await new Promise(resolve=>setImmediate(resolve));
  assert.equal(view.calls.filter(call=>call.url==="/auth/refresh").length,1);
  release.finish();await Promise.all(requests);
  assert.equal(view.store.getState().sessionGeneration,generation);
  assert.equal(view.calls.filter(call=>call.url==="/auth/refresh").length,1);
  assert.equal(view.calls.filter(call=>call.authorization==="Bearer rotated-A").length,3);
  assert.ok(view.calls.every(call=>!("sessionGeneration" in call.headers)&&!("_sessionGeneration" in call.headers)),"session metadata stays in memory and never becomes a request header");
});

test("same-token replacement login owns a new refresh flight and cannot inherit the previous login's failure",async()=>{
  const oldRefreshStarted=deferred(),releaseOldRefresh=deferred();
  let refreshes=0;
  const view=harness(async(config,{success,unauthorized})=>{
    if(config.url==="/auth/refresh"){
      refreshes++;
      if(refreshes===1){oldRefreshStarted.finish();await releaseOldRefresh.promise;return success(config,{access_token:"late-A",refresh_token:"late-refresh-A"});}
      return success(config,{access_token:"rotated-B",refresh_token:"rotated-refresh-B"});
    }
    if(config.headers.Authorization==="Bearer rotated-B")return success(config);
    throw unauthorized(config);
  });
  const oldRequest=view.api.delete("/boards/admin/88").catch((error:unknown)=>error);
  await oldRefreshStarted.promise;
  view.login();
  const generation=view.store.getState().sessionGeneration;
  const newRequest=view.api.delete("/boards/admin/89").catch((error:unknown)=>error);
  try {
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(refreshes,2,"a new login must not reuse an older generation's refresh flight");
  } finally {
    releaseOldRefresh.finish();await oldRequest;await newRequest;
  }
  assert.equal((await newRequest).status,200);
  assert.equal(view.store.getState().isAuthenticated,true);
  assert.equal(view.store.getState().sessionGeneration,generation);
  assert.equal(view.store.getState().accessToken,"rotated-B");
});
