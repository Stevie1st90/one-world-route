import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../platform/story.js',import.meta.url),'utf8');

function loadStory(){
  const classes=new Set();
  const window={ONE_WORLD_PLATFORM_MODULES:{}};
  const document={
    body:{classList:{contains:value=>classes.has(value),add:value=>classes.add(value),remove:value=>classes.delete(value)}},
    querySelector(){return null},
    createElement(){throw new Error('createElement should not run in controller state test')}
  };
  const context={window,document,console,setInterval(){return 1},clearInterval(){}};
  vm.createContext(context);
  vm.runInContext(source,context);
  return {story:window.ONE_WORLD_PLATFORM_MODULES.story,classes};
}

test('story controller exposes generic lifecycle without trip-kind branches',()=>{
  const {story}=loadStory();
  for(const method of ['configure','ensureUi','update','step','start','stop','play','pause','togglePlayback','isActive','isPlaying']){
    assert.equal(typeof story[method],'function');
  }
  assert.doesNotMatch(source,/trip\.kind|road-trip|cruise|italy-grand-tour|world-195/);
});

test('story controller drives selected segment through injected callbacks',async()=>{
  const {story,classes}=loadStory();
  let selected=0,stoppedPlayback=0,rendered=0;
  const trip={
    title:'Test route',
    segments:[
      {fromStopId:'s1',toStopId:'s2',transport:{mode:'road'}},
      {fromStopId:'s2',toStopId:'s3',transport:{mode:'rail'}}
    ]
  };
  const stops=new Map([
    ['s1',{placeId:'p1'}],
    ['s2',{placeId:'p2'}],
    ['s3',{placeId:'p3'}]
  ]);
  const places=new Map([
    ['p1',{name:'A'}],
    ['p2',{name:'B'}],
    ['p3',{name:'C'}]
  ]);
  story.configure({
    getTrip:()=>trip,
    getTripMeta:()=>({capabilities:['story']}),
    getSelectedIndex:()=>selected,
    placeMap:()=>places,
    stopMap:()=>stops,
    chapterForSegment:()=>null,
    hasCapability:()=>true,
    t:key=>key,
    local:value=>typeof value==='string'?value:value?.en||'',
    esc:value=>String(value??''),
    facetLabel:value=>String(value||''),
    selectSegment:index=>{selected=index},
    setTerrain:async()=>{},
    stopRoutePlayback:()=>{stoppedPlayback++},
    renderRoute:()=>{rendered++}
  });

  await story.start();
  assert.equal(story.isActive(),true);
  assert.equal(story.isPlaying(),true);
  assert.equal(stoppedPlayback,1);
  assert.equal(classes.has('platform-story-mode'),true);

  story.pause();
  story.step(1);
  assert.equal(selected,1);

  story.stop();
  assert.equal(story.isActive(),false);
  assert.equal(story.isPlaying(),false);
  assert.equal(classes.has('platform-story-mode'),false);
  assert.equal(rendered,1);
});
