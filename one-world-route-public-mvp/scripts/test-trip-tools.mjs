import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../platform/trip-tools.js',import.meta.url),'utf8');
function load(){const window={ONE_WORLD_PLATFORM_MODULES:{}};const context={window,document:{},Blob:function(){},URL:{},setTimeout,Intl,console};vm.createContext(context);vm.runInContext(source,context);return window.ONE_WORLD_PLATFORM_MODULES.tripTools}
function storage(){const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)}}
test('trip tools keep saved trips and assumptions browser-local',()=>{const tools=load(),s=storage();assert.equal(tools.isSaved(s,'trip-a'),false);assert.equal(tools.toggleSaved(s,'trip-a'),true);assert.equal(tools.isSaved(s,'trip-a'),true);assert.equal(tools.toggleSaved(s,'trip-a'),false);assert.deepEqual(JSON.parse(JSON.stringify(tools.setBudget(s,'trip-a',{lodgingPerNight:100,foodPerPersonDay:30,localPerPersonDay:10,extras:50,contingencyPercent:10,transportMultiplier:null}))),{lodgingPerNight:100,foodPerPersonDay:30,localPerPersonDay:10,extras:50,contingencyPercent:10,transportMultiplier:null})});
test('budget estimate combines published transport minimum with explicit assumptions',()=>{const tools=load();const result=tools.estimate({snapshot:{days:10,nights:9,knownPublishedMinimum:200},profile:{party:{adults:2,children:0}},assumptions:{lodgingPerNight:100,foodPerPersonDay:25,localPerPersonDay:10,extras:100,contingencyPercent:10}});assert.equal(result.transportMultiplier,2);assert.equal(result.transport,400);assert.equal(result.lodging,900);assert.equal(result.food,500);assert.equal(result.local,200);assert.equal(result.subtotal,2100);assert.equal(result.total,2310)});

test('calendar export uses the chosen trip start date without inventing transport facts',()=>{
  const tools=load(),s=storage();
  tools.setStartDate(s,'trip-a','2026-05-10');
  assert.equal(tools.getStartDate(s,'trip-a'),'2026-05-10');
  const trip={
    id:'trip-a',
    title:{en:'Trip A'},
    places:[{id:'p1',name:{en:'Alpha'}},{id:'p2',name:{en:'Beta'}}],
    stops:[
      {id:'s1',placeId:'p1',dayStart:1,dayEnd:2,nights:1},
      {id:'s2',placeId:'p2',dayStart:3,dayEnd:3,nights:0}
    ],
    segments:[{transport:{mode:'rail'}}]
  };
  const local=value=>value?.en||value||'';
  const ics=tools.calendar(trip,{id:'trip-a'},local,value=>value,'2026-05-10');
  assert.match(ics,/DTSTART;VALUE=DATE:20260510/);
  assert.match(ics,/DTEND;VALUE=DATE:20260512/);
  assert.match(ics,/DTSTART;VALUE=DATE:20260512/);
  assert.match(ics,/SUMMARY:Trip A · Beta/);
});


test('season preferences remain local and budget completeness stays explicit',()=>{
  const tools=load(),s=storage();
  assert.equal(tools.getSeason(s,'trip-a'),'');
  assert.equal(tools.setSeason(s,'trip-a','autumn'),'autumn');
  assert.equal(tools.getSeason(s,'trip-a'),'autumn');
  assert.equal(tools.hasBudgetAssumptions(tools.getBudget(s,'trip-a')),false);
  const unknown=tools.estimate({
    snapshot:{days:5,nights:4,knownPublishedMinimum:null},
    profile:{party:{adults:1,children:0}},
    assumptions:{lodgingPerNight:50}
  });
  assert.equal(unknown.transportKnown,false);
  assert.equal(unknown.transport,0);
  assert.equal(unknown.total,200);
});


test('workspace export contains only planning state and no traveller identity fields',()=>{
  const tools=load(),s=storage();
  tools.toggleSaved(s,'trip-a');
  tools.setStartDate(s,'trip-a','2027-05-10');
  tools.setSeason(s,'trip-a','spring');
  tools.setBudget(s,'trip-a',{lodgingPerNight:90});
  const json=tools.workspaceJson(s);
  const parsed=JSON.parse(json);
  assert.equal(parsed.schemaVersion,1);
  assert.deepEqual(parsed.workspace.savedTrips,['trip-a']);
  assert.equal(parsed.workspace.startDates['trip-a'],'2027-05-10');
  assert.equal(parsed.workspace.seasons['trip-a'],'spring');
  assert.equal(parsed.workspace.budgets['trip-a'].lodgingPerNight,90);
  assert.doesNotMatch(json,/passport|residenceCountry|bookingReference|payment/i);
});


test('route start preferences stay local per journey',()=>{
  const tools=load(),s=storage();
  assert.equal(tools.getRouteStart(s,'trip-a'),'');
  assert.equal(tools.setRouteStart(s,'trip-a','stop-b'),'stop-b');
  assert.equal(tools.getRouteStart(s,'trip-a'),'stop-b');
  const parsed=JSON.parse(tools.workspaceJson(s));
  assert.equal(parsed.workspace.routeStarts['trip-a'],'stop-b');
});


test('planning status exposes the next incomplete step and records manual access checks locally',()=>{
  const tools=load(),s=storage(),profile={origin:'Seoul / ICN',originCountry:'KR'};
  let status=tools.planningStatus({storage:s,tripId:'trip-a',profile,hasPlanning:true,routeStartRequired:true});
  assert.equal(status.completed,1);
  assert.equal(status.total,5);
  assert.equal(status.next,'routeStart');

  tools.setRouteStart(s,'trip-a','stop-b');
  tools.setStartDate(s,'trip-a','2027-04-10');
  tools.setBudget(s,'trip-a',{lodgingPerNight:90});
  status=tools.planningStatus({storage:s,tripId:'trip-a',profile,hasPlanning:true,routeStartRequired:true});
  assert.equal(status.completed,4);
  assert.equal(status.next,'access');
  assert.equal(status.complete,false);

  const checks=tools.setAccessChecked(s,'trip-a',true,'2026-09-28T10:00:00Z');
  assert.equal(checks.accessCheckedAt,'2026-09-28T10:00:00.000Z');
  status=tools.planningStatus({storage:s,tripId:'trip-a',profile,hasPlanning:true,routeStartRequired:true});
  assert.equal(status.completed,5);
  assert.equal(status.next,null);
  assert.equal(status.complete,true);

  const workspace=JSON.parse(tools.workspaceJson(s));
  assert.equal(workspace.workspace.planningChecks['trip-a'].accessCheckedAt,'2026-09-28T10:00:00.000Z');
  tools.setAccessChecked(s,'trip-a',false);
  assert.equal(tools.getPlanningChecks(s,'trip-a').accessCheckedAt,'');
});


test('detail planning status can include saved-journey state without changing My Trips semantics',()=>{
  const tools=load(),s=storage(),profile={origin:'Berlin',originCountry:'DE'};
  let status=tools.planningStatus({storage:s,tripId:'trip-a',profile,hasPlanning:false,routeStartRequired:false,includeSaved:true});
  assert.deepEqual(JSON.parse(JSON.stringify(status.items.map(item=>item.id))),['saved','origin','startDate','access']);
  assert.equal(status.next,'saved');
  assert.equal(status.completed,1);

  tools.toggleSaved(s,'trip-a');
  status=tools.planningStatus({storage:s,tripId:'trip-a',profile,hasPlanning:false,routeStartRequired:false,includeSaved:true});
  assert.equal(status.next,'startDate');
  assert.equal(status.completed,2);

  const myTripsStatus=tools.planningStatus({storage:s,tripId:'trip-a',profile,hasPlanning:false,routeStartRequired:false});
  assert.deepEqual(JSON.parse(JSON.stringify(myTripsStatus.items.map(item=>item.id))),['origin','startDate','access']);
});


test('trip pack carries portable planning workspace state without private identity data',()=>{
  const tools=load();
  const trip={
    id:'trip-a',title:{en:'Trip A'},summary:{en:'Summary'},planning:{days:3,currency:'EUR'},
    places:[{id:'p1',name:{en:'Alpha'}},{id:'p2',name:{en:'Beta'}}],
    stops:[{id:'s1',placeId:'p1',dayStart:1,dayEnd:1,nights:1},{id:'s2',placeId:'p2',dayStart:2,dayEnd:3,nights:1}],
    segments:[{transport:{mode:'rail'}}],sources:[]
  };
  const json=tools.jsonPack({
    trip,meta:{id:'trip-a'},local:value=>value?.en||value||'',facetLabel:value=>value,
    snapshot:{days:3,nights:2,currency:'EUR',knownPublishedMinimum:null},
    assumptions:{lodgingPerNight:80},profile:{party:{adults:1,children:0}},
    startDate:'2027-05-10',season:'spring',
    journeyPlan:{type:'origin-access-core-return'},
    planningWorkspace:{
      saved:true,routeStartId:'s2',accessCheckedAt:'2026-09-28T10:00:00.000Z',
      status:{completed:6,total:6,complete:true,next:null,items:[]}
    }
  });
  const parsed=JSON.parse(json);
  assert.equal(parsed.planningWorkspace.saved,true);
  assert.equal(parsed.planningWorkspace.routeStartId,'s2');
  assert.equal(parsed.planningWorkspace.accessCheckedAt,'2026-09-28T10:00:00.000Z');
  assert.equal(parsed.planningWorkspace.status.complete,true);
  assert.doesNotMatch(json,/passport|residenceCountry|bookingReference|payment/i);
});


test('journey variant choice stays local per source journey',()=>{
  const tools=load(),s=storage();
  assert.equal(tools.getVariant(s,'trip-a'),'base');
  assert.equal(tools.setVariant(s,'trip-a','northern-italy-tuscany'),'northern-italy-tuscany');
  assert.equal(tools.getVariant(s,'trip-a'),'northern-italy-tuscany');
  let parsed=JSON.parse(tools.workspaceJson(s));
  assert.equal(parsed.workspace.variants['trip-a'],'northern-italy-tuscany');
  assert.equal(tools.setVariant(s,'trip-a','base'),'base');
  parsed=JSON.parse(tools.workspaceJson(s));
  assert.equal(parsed.workspace.variants['trip-a'],undefined);
});


test('recent journeys are deduplicated, newest first and bounded locally',()=>{
  const tools=load(),s=storage();
  for(let i=0;i<14;i++)tools.markViewed(s,'trip-'+i);
  tools.markViewed(s,'trip-5');
  const recent=tools.getRecent(s);
  assert.equal(recent[0],'trip-5');
  assert.equal(recent.length,12);
  assert.equal(new Set(recent).size,recent.length);
  const workspace=JSON.parse(tools.workspaceJson(s));
  assert.deepEqual(workspace.workspace.recentTrips,Array.from(recent));
});

test('planning workspace import validates schema and filters unknown trips',()=>{
  const tools=load();
  const s=storage();
  const payload=JSON.stringify({
    schemaVersion:1,
    workspace:{
      savedTrips:['italy-grand-tour','unknown-trip'],
      recentTrips:['unknown-trip','italy-grand-tour'],
      budgets:{'italy-grand-tour':{lodgingPerNight:120},'unknown-trip':{lodgingPerNight:999}},
      startDates:{'italy-grand-tour':'2027-05-04','unknown-trip':'bad'},
      seasons:{'italy-grand-tour':'spring'},
      routeStarts:{'italy-grand-tour':'it-stop-03'},
      variants:{'italy-grand-tour':'southern-highlights'},
      planningChecks:{'italy-grand-tour':{accessCheckedAt:'2026-09-29T12:00:00.000Z'}}
    }
  });
  const result=tools.importWorkspace(s,payload,['italy-grand-tour']);
  assert.equal(result.ok,true);
  const state=tools.load(s);
  assert.deepEqual(Array.from(state.savedTrips),['italy-grand-tour']);
  assert.deepEqual(Array.from(state.recentTrips),['italy-grand-tour']);
  assert.equal(state.budgets['italy-grand-tour'].lodgingPerNight,120);
  assert.equal(state.startDates['italy-grand-tour'],'2027-05-04');
  assert.equal(state.routeStarts['italy-grand-tour'],'it-stop-03');
  assert.equal(state.variants['italy-grand-tour'],'southern-highlights');
  assert.equal(Object.hasOwn(state.budgets,'unknown-trip'),false);
});

test('planning workspace import rejects invalid payloads without replacing state',()=>{
  const tools=load();
  const s=storage();
  tools.toggleSaved(s,'italy-grand-tour');
  assert.equal(tools.importWorkspace(s,'not json',['italy-grand-tour']).ok,false);
  assert.equal(tools.importWorkspace(s,JSON.stringify({schemaVersion:2,workspace:{}}),['italy-grand-tour']).ok,false);
  assert.deepEqual(Array.from(tools.load(s).savedTrips),['italy-grand-tour']);
});



test('planning workspace tracks a revision timestamp for deterministic sync',()=>{
  const tools=load(),s=storage();
  assert.equal(tools.workspaceUpdatedAt(s),'');
  tools.toggleSaved(s,'italy-grand-tour');
  const first=tools.workspaceUpdatedAt(s);
  assert.match(first,/^\d{4}-\d{2}-\d{2}T/);
  const payload=tools.workspacePayload(s);
  assert.equal(payload.schemaVersion,1);
  assert.equal(payload.updatedAt,first);
  assert.deepEqual(Array.from(payload.workspace.savedTrips),['italy-grand-tour']);
});

test('cloud restore can preserve the remote workspace revision timestamp',()=>{
  const tools=load(),s=storage(),stamp='2026-09-30T08:30:00.000Z';
  const result=tools.importWorkspace(s,{
    schemaVersion:1,
    updatedAt:stamp,
    workspace:{savedTrips:['italy-grand-tour']}
  },['italy-grand-tour'],stamp);
  assert.equal(result.ok,true);
  assert.equal(result.updatedAt,stamp);
  assert.equal(tools.workspaceUpdatedAt(s),stamp);
  assert.deepEqual(Array.from(tools.load(s).savedTrips),['italy-grand-tour']);
});
