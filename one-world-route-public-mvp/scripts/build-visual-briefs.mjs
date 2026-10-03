import {readFile,writeFile} from 'node:fs/promises';
import {buildVisualBrief} from './visual-brief-model.mjs';
const ROOT=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,ROOT),'utf8'));
const [catalog,route,manifest,coverage,backlog]=await Promise.all(['trips','route-visuals','media-manifest','visual-coverage','graphics-backlog'].map(n=>read('data/platform/'+n+'.json')));
const briefs=[];
for(const meta of catalog.trips){
 const trip=await read(meta.dataset.slice(2));
 const brief=buildVisualBrief(meta,trip,route.journeys.find(j=>j.id===meta.id));
 const cover=manifest.journeys.find(j=>j.id===meta.id)?.journeyCover;
 if(cover)brief.status=cover.status==='published'?'published':'approved';
 briefs.push(brief);
}
briefs.sort((a,b)=>b.priorityScore-a.priorityScore||a.tripId.localeCompare(b.tripId));
briefs.forEach((b,i)=>b.rank=i+1);
const destinationRecommendations=coverage.destinationQueue.filter(d=>['country','place','region'].includes(d.type)&&d.journeys.length&&d.id!=='global').map(d=>{
 const uses=d.journeys.filter(id=>catalog.trips.find(m=>m.id===id)?.kind!=='world');
 const featured=uses.reduce((sum,id)=>sum+(catalog.trips.find(m=>m.id===id)?.visual?.featurePriority||0)/100,0);
 const score=uses.length*10+(d.eligibleJourneys?.filter(id=>uses.includes(id)).length||0)*5+featured;
 return {...d,regionalJourneyUses:uses.length,reuseScore:Number(score.toFixed(2)),reason:'Existing catalog references; country fallback still requires suitability and multi-country anchor review'};
}).filter(d=>d.regionalJourneyUses>0).sort((a,b)=>b.reuseScore-a.reuseScore||a.type.localeCompare(b.type)||a.id.localeCompare(b.id)).slice(0,20);
const report={schemaVersion:1,policyVersion:'journey-visual-experience-v2',summary:{journeys:briefs.length,briefReady:briefs.filter(b=>b.status==='brief-ready').length,imagesGenerated:0},journeys:briefs,destinationRecommendations};
await writeFile(new URL('data/platform/visual-briefs.json',ROOT),JSON.stringify(report,null,2)+'\n');
// Update the existing editorial registry, retaining all collection briefs.
for(const asset of backlog.assets||[]){
 const brief=briefs.find(b=>b.tripId===asset.tripId);if(!brief)continue;
 const hybrid=brief.productionStrategy==='hybrid-space-base-plus-factual-flat-world';
 Object.assign(asset,{visualFamily:brief.visualFamily,motif:brief.motif,prompt:brief.imagePrompt,promptVersion:hybrid?'world-showcase-flat-v5':'journey-visual-experience-v2',priority:brief.priority,coverGenerationStatus:brief.status,strategy:hybrid?brief.productionStrategy:(brief.rank<=8?'bespoke-recommended':'bespoke-optional'),reason:brief.reason,fallbackQuality:brief.fallbackQuality,derivatives:brief.separateVerticalRecommended?['9:16']:[],briefRef:'./data/platform/visual-briefs.json#'+brief.tripId});
}
backlog.policyVersion='journey-visual-experience-v2';
await writeFile(new URL('data/platform/graphics-backlog.json',ROOT),JSON.stringify(backlog,null,2)+'\n');
const briefMarkdown=b=>{const lines=['## '+b.rank+'. '+b.title+' — '+b.priority,'','Family: `'+b.visualFamily+'` · status: `'+b.status+'` · 16:9: '+b.landscapePriority+' · separate 9:16: '+(b.separateVerticalRecommended?'recommended':'optional'),'','Reason: '+b.reason,'','Fallback: '+b.fallbackQuality,''];if(b.productionStrategy==='hybrid-space-base-plus-factual-flat-world'){lines.push('Production strategy: `'+b.productionStrategy+'`','','Factual route layer: `'+b.routeOverlayAssetId+'` · 195 countries / 194 international legs','','Motif: '+b.motif,'','Base-image prompt:','',b.imagePrompt,'','The image model creates only the cinematic atmosphere base. The flat world map and route are rendered from verified ONE WORLD ROUTE geometry; the model must never invent the 195-country route.','');}else{lines.push('Suggested anchor: '+(b.suggestedAnchor?.name||b.suggestedAnchor?.id||'unresolved')+'; '+b.anchorStatus,'','Motif: '+b.motif,'','Prompt:','',b.imagePrompt,'');}return lines;};
const md=['# Journey cover and reusable destination backlog — v2','','Generated from current source data. No images generated. All published journeys retain complete auto route visuals. Covers are asynchronous editorial enrichment, never a publishing gate. Suggested anchors require scene review.','',...briefs.flatMap(briefMarkdown), '## Top 20 reusable destination assets','','Country/place references describe reuse potential, not blanket cover suitability. Global-world references are excluded from the reuse score.','', '| Asset | Regional journeys | Score |','| --- | ---: | ---: |',...destinationRecommendations.map(d=>'| '+d.type+' / '+textName(d.name||d.id)+' | '+d.regionalJourneyUses+' | '+d.reuseScore+' |'),'','## Existing collection briefs','','Optional collection concepts remain in the same graphics queue; no manual batch or collage renderer is required.','',...(backlog.assets||[]).filter(a=>!a.tripId).map(a=>'- '+a.assetId+': '+(a.motif||'editorial concept')),''].join('\n');
function textName(value){return typeof value==='string'?value:value?.en||'';}
await writeFile(new URL('GRAPHICS_NEEDED.md',ROOT),md);
console.log('Visual briefs:',report.summary,'; top covers:',briefs.slice(0,8).map(b=>b.tripId).join(', '));
