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
