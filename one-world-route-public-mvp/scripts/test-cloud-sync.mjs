import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../platform/cloud-sync.js',import.meta.url),'utf8');

function storage(){
  const map=new Map();
  return {
    getItem:key=>map.get(key)||null,
    setItem:(key,value)=>map.set(key,String(value)),
    removeItem:key=>map.delete(key)
  };
}
function response(payload,{ok=true,status=200}={}){
  const text=payload===null||payload===undefined?'':JSON.stringify(payload);
  return {ok,status,text:async()=>text,json:async()=>payload};
}
function load(nativeFetch=null){
  const window={ONE_WORLD_PLATFORM_MODULES:{}};
  const context={window,console,Date,setTimeout,clearTimeout};
  if(nativeFetch)context.fetch=function(...args){assert.equal(this,window,'Browser fetch requires its Window receiver');return nativeFetch(...args)};
  vm.createContext(context);
  vm.runInContext(source,context);
  return window.ONE_WORLD_PLATFORM_MODULES.cloudSync;
}

test('default browser fetch reads deployment config with the Window receiver',async()=>{
  let calls=0;
  const sync=load(async url=>{calls++;assert.equal(url,'./data/platform/sync-config.json');return response({schemaVersion:1,provider:'supabase',enabled:false})});
  const state=await sync.init({storage:storage(),TripTools:{},catalog:{trips:[]}});
  assert.equal(calls,1);assert.equal(state.available,false);
});

test('cloud sync stays unavailable when deployment config is disabled',async()=>{
  const sync=load(),s=storage();
  const TripTools={workspacePayload:()=>({schemaVersion:1,updatedAt:new Date(0).toISOString(),workspace:{}})};
  const fetcher=async url=>{
    assert.equal(url,'./data/platform/sync-config.json');
    return response({schemaVersion:1,provider:'supabase',enabled:false,projectUrl:null,publishableKey:null});
  };
  const state=await sync.init({storage:s,TripTools,catalog:{trips:[]},fetcher});
  assert.equal(state.available,false);
  assert.equal(state.signedIn,false);
  const unavailable=await sync.requestCode('person@example.com');
  assert.equal(unavailable.ok,false);
  assert.equal(unavailable.reason,'unavailable');
});

test('cloud sync uploads newer local workspace and restores newer remote workspace',async()=>{
  const sync=load(),s=storage(),now=Math.floor(Date.now()/1000);
  let local={
    schemaVersion:1,
    updatedAt:'2026-09-30T08:00:00.000Z',
    workspace:{savedTrips:['trip-a'],recentTrips:[],budgets:{},startDates:{},seasons:{},routeStarts:{},variants:{},planningChecks:{}}
  };
  let imported=null,remoteRows=[];
  const TripTools={
    workspacePayload:()=>local,
    importWorkspace:(storageArg,payload,allowed,updatedAt)=>{
      imported={payload,allowed,updatedAt};
      local={schemaVersion:1,updatedAt,workspace:payload.workspace};
      return {ok:true,workspace:payload.workspace,updatedAt};
    }
  };
  const fetcher=async(url,options={})=>{
    if(url==='./data/platform/sync-config.json')return response({
      schemaVersion:1,provider:'supabase',enabled:true,
      projectUrl:'https://example.supabase.co',publishableKey:'sb_publishable_test'
    });
    if(url.endsWith('/auth/v1/otp')){
      const body=JSON.parse(options.body);
      assert.equal(body.email,'person@example.com');
      return response({});
    }
    if(url.endsWith('/auth/v1/verify')){
      return response({
        access_token:'access-token',refresh_token:'refresh-token',expires_at:now+3600,
        user:{id:'user-1',email:'person@example.com'}
      });
    }
    if(url.includes('/rest/v1/planning_workspaces?')){
      return response(remoteRows);
    }
    if(url.endsWith('/rest/v1/planning_workspaces')&&options.method==='POST'){
      const row=JSON.parse(options.body);
      remoteRows=[{workspace:row.workspace,client_updated_at:row.client_updated_at,updated_at:row.client_updated_at}];
      return response([{...row,updated_at:row.client_updated_at}]);
    }
    throw new Error('Unexpected URL '+url);
  };

  await sync.init({storage:s,TripTools,catalog:{trips:[{id:'trip-a'},{id:'trip-b'}]},fetcher});
  assert.equal((await sync.requestCode('person@example.com')).ok,true);
  assert.equal((await sync.verifyCode('person@example.com','123456')).ok,true);
  assert.equal(sync.status().signedIn,true);

  const uploaded=await sync.sync();
  assert.equal(uploaded.ok,true);
  assert.equal(uploaded.direction,'uploaded');
  assert.equal(remoteRows[0].workspace.savedTrips[0],'trip-a');

  remoteRows=[{
    workspace:{savedTrips:['trip-b'],recentTrips:[],budgets:{},startDates:{},seasons:{},routeStarts:{},variants:{},planningChecks:{}},
    client_updated_at:'2026-09-30T09:00:00.000Z',
    updated_at:'2026-09-30T09:00:00.000Z'
  }];
  local={...local,updatedAt:'2026-09-30T08:30:00.000Z'};
  const downloaded=await sync.sync();
  assert.equal(downloaded.ok,true);
  assert.equal(downloaded.direction,'downloaded');
  assert.equal(imported.updatedAt,'2026-09-30T09:00:00.000Z');
  assert.deepEqual(Array.from(imported.allowed),['trip-a','trip-b']);
  assert.deepEqual(Array.from(imported.payload.workspace.savedTrips),['trip-b']);

  await sync.signOut();
  assert.equal(sync.status().signedIn,false);
});
