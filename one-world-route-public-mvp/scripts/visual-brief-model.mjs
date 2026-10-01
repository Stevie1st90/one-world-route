const text=v=>typeof v==='string'?v:v?.en||'';
const families=['rail-cinematic','road-cinematic','nature-atmospheric','coastal-editorial','culture-editorial','planetary'];
export function visualFamily(meta,trip={}){
 const override=meta.visual?.visualFamily||trip.visual?.visualFamily;
 if(families.includes(override))return override;
 const kind=meta.kind||trip.kind||'',modes=meta.discovery?.modes||[],themes=meta.discovery?.themes||[];
 if(kind==='world')return 'planetary';
 if(/rail/.test(kind)||modes.includes('rail')&&!modes.includes('road'))return 'rail-cinematic';
 if(/cruise|island/.test(kind))return 'coastal-editorial';
 if(/road|camper|motorcycle/.test(kind))return 'road-cinematic';
 if(themes.some(t=>/nature|wildlife|mountain/.test(t)))return 'nature-atmospheric';
 return 'culture-editorial';
}
export function buildVisualBrief(meta,trip,visual){
 const family=visualFamily(meta,trip),places=new Map((trip.places||[]).map(p=>[p.id,p]));
 const explicit=meta.visualAnchor||meta.visual?.visualAnchor||trip.visualAnchor;
 const stays=(trip.stops||[]).filter(s=>places.has(s.placeId)).sort((a,b)=>(b.nights||0)-(a.nights||0)||a.sequence-b.sequence);
 const prominent=stays.find(s=>places.get(s.placeId)?.experienceRef);
 const selected=explicit?.type==='place'?[...places.values()].find(p=>p.id===explicit.id||p.experienceRef===explicit.id):places.get((prominent||stays[0])?.placeId);
 const region=meta.visual?.primaryRegion||(meta.discovery?.regions||[]).find(r=>!['global'].includes(r))||'global';
 const anchor=explicit?{...explicit,basis:'explicit',reviewRequired:false}:selected?{type:'place',id:selected.experienceRef||selected.id,name:text(selected.name),countryCode:selected.countryCode,basis:prominent?'existing-place-experience':'longest-listed-stay',reviewRequired:true}:null;
 const scene={
  'rail-cinematic':'a single unbranded rail-travel scene with geographically credible surroundings',
  'road-cinematic':'a single scenic road-travel scene with locally credible terrain and no invented route alignment',
  'nature-atmospheric':'a single atmospheric natural landscape grounded in the listed destination',
  'coastal-editorial':'a single coherent coastal travel scene; no collage of ports or islands',
  'culture-editorial':'a single street-level cultural travel scene; no collage of landmarks',
  'planetary':'a single atmospheric view of Earth with recognizable continents and no invented route overlay'
 }[family];
 const motif=scene+(anchor?.name?' inspired by '+anchor.name+' ('+anchor.countryCode+'); confirm specific scene details before generation':anchor?.type==='country'?' inspired by '+anchor.id:' inspired by '+region);
 const span=visual?.bounds?.longitudeSpan||0,weak=visual?.scope==='LOCAL'||span>0&&span<6;
 const busy=visual?.scope==='GLOBAL';
 const socialPriority=['rail-cinematic','road-cinematic','coastal-editorial','planetary'].includes(family)?'high':'medium';
 const score=Math.round((meta.visual?.featurePriority||55)/2)+(weak?30:0)+(busy?25:0)+(socialPriority==='high'?15:8)+(meta.metrics?.countries>1&&meta.metrics?.countries<10?8:0);
 const avoid=['text','numbers','labels','logos','brand livery','copied photographs','copied posters','named living artist imitation','invented route facts','landmark collage','documentary-photo claims'];
 const prompt='Create an original cinematic editorial travel illustration for “'+text(meta.title)+'”. Visual family: '+family+'. Show '+motif+'. Geography context: '+(visual?.countries||[]).join(', ')+'. One coherent real-world inspired scene, not a literal depiction of all route stops. Restrained natural palette, atmospheric directional light, credible depth, medium detail readable at thumbnail size. Landscape 16:9 master; principal subject in central 55%, top 15% and bottom 20% quiet for HTML overlays. No text, numbers, labels, logos, copied photo, brand livery or named living artist imitation. Do not invent route facts; do not imply documentary photography. Anchor is a proposal: validate the scene against source data before generation.';
 return {tripId:meta.id,title:text(meta.title),visualFamily:family,countries:visual?.countries||[],primaryRegion:region,modes:meta.discovery?.modes||[],themes:meta.discovery?.themes||[],routeCharacter:text(trip.summary)||text(meta.subtitle),highlights:(trip.highlights||[]).map(text).filter(Boolean),suggestedAnchor:anchor,anchorStatus:anchor?'manual-review':'unresolved',motif,mood:'restrained cinematic travel editorial',lighting:'atmospheric directional light; season only if verified',safeZones:{principalSubject:'central 55%',quietTop:'15%',quietBottom:'20%'},avoid,imagePrompt:prompt,priorityScore:score,priority:score>=70?'P1':score>=50?'P2':'P3',landscapePriority:score>=70?'first-batch':'later',separateVerticalRecommended:socialPriority==='high',socialPriority,fallbackQuality:weak?'Complete geographic route; coarse source limits local recognition':busy?'Complete global geography; route density limits emotional thumbnail identity':'Complete recognizable regional geography; orientation rather than cinematic inspiration',status:'brief-ready',reason:[weak?'Improve thumbnail recognition at small geographic scale':busy?'Differentiate a dense planetary route':'Strengthen distinct journey character',socialPriority==='high'?'Strong travel-mode social identity':'Reusable destination character'].join('; ')};
}
