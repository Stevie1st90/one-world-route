(() => {
  'use strict';
  const root=window.ONE_WORLD_PLATFORM_MODULES=window.ONE_WORLD_PLATFORM_MODULES||{};
  const CONFIG_URL='./data/platform/sync-config.json';
  const SESSION_KEY='one-world-route:cloud-session:v1';
  const STATE_KEY='one-world-route:cloud-sync-state:v1';
  let deps=null;
  let config={schemaVersion:1,provider:'supabase',enabled:false,projectUrl:null,publishableKey:null};
  const listeners=new Set();

  function cleanUrl(value){return String(value||'').trim().replace(/\/+$/,'')}
  function parseJson(storage,key,fallback=null){
    try{return JSON.parse(storage.getItem(key)||'null')??fallback}catch{return fallback}
  }
  function emit(){
    const current=status();
    for(const listener of listeners){
      try{listener(current)}catch(error){console.warn('Cloud sync listener failed',error)}
    }
  }
  function subscribe(listener){
    if(typeof listener!=='function')return ()=>{};
    listeners.add(listener);
    listener(status());
    return ()=>listeners.delete(listener);
  }
  function available(){
    return Boolean(config?.enabled&&config?.provider==='supabase'&&cleanUrl(config.projectUrl)&&String(config.publishableKey||'').trim());
  }
  function storedSession(){
    if(!deps?.storage)return null;
    const session=parseJson(deps.storage,SESSION_KEY,null);
    return session&&typeof session==='object'&&session.access_token&&session.user?.id?session:null;
  }
  function state(){
    return deps?.storage?parseJson(deps.storage,STATE_KEY,{lastSyncedAt:'',lastDirection:''}):{lastSyncedAt:'',lastDirection:''};
  }
  function status(){
    const session=storedSession(),syncState=state();
    return {
      available:available(),
      signedIn:Boolean(session),
      email:session?.user?.email||'',
      userId:session?.user?.id||'',
      lastSyncedAt:syncState.lastSyncedAt||'',
      lastDirection:syncState.lastDirection||''
    };
  }
  function baseHeaders(accessToken=null){
    const headers={'Content-Type':'application/json','apikey':String(config.publishableKey||'')};
    if(accessToken)headers.Authorization='Bearer '+accessToken;
    return headers;
  }
  async function jsonRequest(url,options={}){
    const response=await (deps?.fetcher||fetch)(url,options);
    const text=await response.text();
    let payload=null;
    try{payload=text?JSON.parse(text):null}catch{payload=text||null}
    if(!response.ok){
      const message=payload?.msg||payload?.message||payload?.error_description||payload?.error||('HTTP '+response.status);
      const error=new Error(String(message));
      error.status=response.status;
      throw error;
    }
    return payload;
  }
  function persistSession(session){
    if(!deps?.storage)return null;
    if(!session){deps.storage.removeItem(SESSION_KEY);emit();return null}
    const normalized={
      access_token:String(session.access_token||''),
      refresh_token:String(session.refresh_token||''),
      expires_at:Number(session.expires_at||0),
      user:{id:String(session.user?.id||''),email:String(session.user?.email||'')}
    };
    deps.storage.setItem(SESSION_KEY,JSON.stringify(normalized));
    emit();
    return normalized;
  }
  async function refreshSession(session){
    if(!available()||!session?.refresh_token)return null;
    const payload=await jsonRequest(cleanUrl(config.projectUrl)+'/auth/v1/token?grant_type=refresh_token',{
      method:'POST',headers:baseHeaders(),body:JSON.stringify({refresh_token:session.refresh_token})
    });
    return persistSession(payload);
  }
  async function ensureSession(){
    let session=storedSession();
    if(!session)return null;
    const expiresAt=Number(session.expires_at||0);
    if(expiresAt&&expiresAt*1000>Date.now()+60000)return session;
    try{return await refreshSession(session)}
    catch(error){
      console.warn('Cloud session refresh failed',error);
      persistSession(null);
      return null;
    }
  }
  async function init(next={}){
    deps={
      storage:next.storage||localStorage,
      TripTools:next.TripTools,
      catalog:next.catalog,
      fetcher:next.fetcher||fetch
    };
    try{
      const response=await deps.fetcher(CONFIG_URL,{cache:'no-cache'});
      if(response.ok){
        const loaded=await response.json();
        config={
          schemaVersion:Number(loaded?.schemaVersion||1),
          provider:String(loaded?.provider||'supabase'),
          enabled:Boolean(loaded?.enabled),
          projectUrl:cleanUrl(loaded?.projectUrl),
          publishableKey:String(loaded?.publishableKey||'').trim()
        };
      }
    }catch(error){console.warn('Cloud sync config unavailable',error)}
    if(available())await ensureSession();
    emit();
    return status();
  }
  async function requestCode(email){
    if(!available())return {ok:false,reason:'unavailable'};
    const normalized=String(email||'').trim().toLowerCase();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized))return {ok:false,reason:'invalid-email'};
    try{
      await jsonRequest(cleanUrl(config.projectUrl)+'/auth/v1/otp',{
        method:'POST',headers:baseHeaders(),body:JSON.stringify({email:normalized,create_user:true})
      });
      return {ok:true,email:normalized};
    }catch(error){return {ok:false,reason:'request-failed',message:error.message}}
  }
  async function verifyCode(email,token){
    if(!available())return {ok:false,reason:'unavailable'};
    const normalized=String(email||'').trim().toLowerCase();
    const code=String(token||'').trim();
    if(!normalized||!code)return {ok:false,reason:'missing-code'};
    try{
      const payload=await jsonRequest(cleanUrl(config.projectUrl)+'/auth/v1/verify',{
        method:'POST',headers:baseHeaders(),body:JSON.stringify({email:normalized,token:code,type:'email'})
      });
      const session=persistSession(payload);
      return {ok:Boolean(session),session};
    }catch(error){return {ok:false,reason:'verify-failed',message:error.message}}
  }
  async function signOut(){
    const session=await ensureSession();
    if(session){
      try{
        await jsonRequest(cleanUrl(config.projectUrl)+'/auth/v1/logout',{method:'POST',headers:baseHeaders(session.access_token)});
      }catch(error){console.warn('Cloud sign out request failed',error)}
    }
    persistSession(null);
    return {ok:true};
  }
  async function remoteWorkspace(session){
    const uid=encodeURIComponent(session.user.id);
    const url=cleanUrl(config.projectUrl)+'/rest/v1/planning_workspaces?select=workspace,client_updated_at,updated_at&user_id=eq.'+uid+'&limit=1';
    const payload=await jsonRequest(url,{headers:baseHeaders(session.access_token)});
    return Array.isArray(payload)&&payload.length?payload[0]:null;
  }
  async function uploadWorkspace(session,payload){
    const row={
      user_id:session.user.id,
      workspace:payload.workspace,
      client_updated_at:payload.updatedAt
    };
    const result=await jsonRequest(cleanUrl(config.projectUrl)+'/rest/v1/planning_workspaces',{
      method:'POST',
      headers:{...baseHeaders(session.access_token),Prefer:'resolution=merge-duplicates,return=representation'},
      body:JSON.stringify(row)
    });
    return Array.isArray(result)&&result.length?result[0]:row;
  }
  function remember(direction,stamp){
    if(!deps?.storage)return;
    deps.storage.setItem(STATE_KEY,JSON.stringify({lastSyncedAt:stamp||new Date().toISOString(),lastDirection:direction||''}));
    emit();
  }
  function allowedTripIds(){return (deps?.catalog?.trips||[]).map(item=>item.id)}
  async function sync(){
    if(!available()||!deps?.TripTools)return {ok:false,reason:'unavailable'};
    const session=await ensureSession();
    if(!session)return {ok:false,reason:'signed-out'};
    try{
      const local=deps.TripTools.workspacePayload(deps.storage);
      const remote=await remoteWorkspace(session);
      if(!remote){
        await uploadWorkspace(session,local);
        remember('uploaded',new Date().toISOString());
        return {ok:true,direction:'uploaded',updatedAt:local.updatedAt};
      }
      const localTime=new Date(local.updatedAt||0).getTime()||0;
      const remoteStamp=String(remote.client_updated_at||remote.updated_at||'');
      const remoteTime=new Date(remoteStamp||0).getTime()||0;
      if(remoteTime>localTime){
        const imported=deps.TripTools.importWorkspace(
          deps.storage,
          {schemaVersion:1,updatedAt:remoteStamp,workspace:remote.workspace},
          allowedTripIds(),
          remoteStamp
        );
        if(!imported.ok)return {ok:false,reason:'invalid-remote'};
        remember('downloaded',new Date().toISOString());
        return {ok:true,direction:'downloaded',updatedAt:remoteStamp};
      }
      if(localTime>remoteTime){
        await uploadWorkspace(session,local);
        remember('uploaded',new Date().toISOString());
        return {ok:true,direction:'uploaded',updatedAt:local.updatedAt};
      }
      remember('current',new Date().toISOString());
      return {ok:true,direction:'current',updatedAt:local.updatedAt};
    }catch(error){
      console.warn('Cloud workspace sync failed',error);
      return {ok:false,reason:'sync-failed',message:error.message};
    }
  }

  root.cloudSync={init,status,subscribe,requestCode,verifyCode,signOut,sync};
})();
