export const COVER_SYSTEM_VERSION='journey-cover-system-v1';
export const COVER_BATCH_POLICY='batch-cover-generation-v4';
export const SPECIAL_JOURNEY_IDS=Object.freeze(['world-195']);

export const LIGHTING_PROFILES=Object.freeze([
  'soft morning light',
  'clear daylight',
  'diffuse overcast light',
  'late directional light',
  'blue-hour transition',
  'misty directional light'
]);

export const GLOBAL_COVER_QA=Object.freeze([
  'one coherent scene',
  'journey mode/character readable at thumbnail size',
  'no visible text or logos',
  'no invented map or route overlay',
  'geography plausible for approved anchor',
  'not visually repetitive with adjacent batch items'
]);

export const VISUAL_FAMILIES=Object.freeze({
  'road-cinematic':Object.freeze({
    archetype:'road',
    generation:'image',
    scene:'a single scenic road-travel scene with locally credible terrain and no invented route alignment',
    socialPriority:'high',
    compositions:Object.freeze([
      'wide environmental journey',
      'elevated route overview',
      'three-quarter travel-mode scene',
      'low-horizon landscape',
      'journey element small in a large landscape'
    ])
  }),
  'rail-cinematic':Object.freeze({
    archetype:'rail',
    generation:'image',
    scene:'a single unbranded rail-travel scene with geographically credible surroundings',
    socialPriority:'high',
    compositions:Object.freeze([
      'wide rail-in-landscape',
      'three-quarter train passage',
      'elevated rail corridor',
      'train small in a large landscape',
      'layered environmental rail scene'
    ])
  }),
  'nature-atmospheric':Object.freeze({
    archetype:'scenic-adventure',
    generation:'image',
    scene:'a single atmospheric natural landscape grounded in the listed destination',
    socialPriority:'medium',
    compositions:Object.freeze([
      'immersive environmental overlook',
      'trail-led landscape',
      'layered atmospheric landscape',
      'wide natural panorama',
      'foreground nature framing'
    ])
  }),
  'coastal-editorial':Object.freeze({
    archetype:'cruise-coastal',
    generation:'image',
    scene:'a single coherent coastal travel scene; no collage of ports or islands',
    socialPriority:'high',
    compositions:Object.freeze([
      'island-chain passage',
      'ferry-in-open-water',
      'elevated coastal overview',
      'harbor-to-horizon passage',
      'wide sea-and-islands scene'
    ])
  }),
  'culture-editorial':Object.freeze({
    archetype:'urban-culture',
    generation:'image',
    scene:'a single street-level cultural travel scene; no collage of landmarks',
    socialPriority:'medium',
    compositions:Object.freeze([
      'human-scale street scene',
      'architectural arrival',
      'layered neighborhood view',
      'public-space travel scene',
      'city-and-landscape relationship'
    ])
  }),
  'planetary':Object.freeze({
    archetype:'global',
    generation:'deterministic',
    scene:'a premium full-bleed Natural Earth world map with the verified 195-country route rendered directly from platform geometry',
    socialPriority:'high',
    productionStrategy:'deterministic-full-bleed-world-route',
    compositions:Object.freeze(['full-bleed verified world route'])
  })
});

export function familyProfile(id){
  return VISUAL_FAMILIES[id]||VISUAL_FAMILIES['culture-editorial'];
}

export function visualFamily(meta={},trip={}){
  const override=meta.visual?.visualFamily||trip.visual?.visualFamily;
  if(override&&VISUAL_FAMILIES[override])return override;
  const kind=String(meta.kind||trip.kind||'');
  const modes=meta.discovery?.modes||[];
  const themes=meta.discovery?.themes||[];
  if(kind==='world')return 'planetary';
  if(/rail/.test(kind)||(modes.includes('rail')&&!modes.includes('road')))return 'rail-cinematic';
  if(/cruise|island/.test(kind))return 'coastal-editorial';
  if(/road|camper|motorcycle/.test(kind))return 'road-cinematic';
  if(themes.some(t=>/nature|wildlife|mountain/.test(String(t))))return 'nature-atmospheric';
  return 'culture-editorial';
}

export function productionStrategyFor(family){
  return familyProfile(family).productionStrategy||'single-generated-cover';
}

export function visualArchetype(family){
  return familyProfile(family).archetype;
}

export function visualSystemContract(){
  return {
    schemaVersion:1,
    policyVersion:COVER_SYSTEM_VERSION,
    objective:'Scale Journey visuals to 1000+ Journeys without per-Journey workflow design.',
    normalCoverStrategy:'one generated 16:9 master per Journey; responsive WebPs are deterministic derivatives',
    batch:{
      maxJourneys:10,
      operatorPromptsPerBatch:1,
      imageCallsPerJourney:1,
      imagesPerToolCall:1,
      singleCallMultiJourneyForbidden:true,
      promptTransport:'explicit-per-call',
      carryoverPolicy:'shared house style only; subject, geography, transport and composition must reset for every Journey',
      reviewMode:'review whole batch once; regenerate only outliers',
      releaseMode:'approved masters -> deterministic responsive derivatives -> registry/hero IDs -> validation'
    },
    specialJourneys:SPECIAL_JOURNEY_IDS.map(id=>({tripId:id,strategy:'deterministic-full-bleed-world-route'})),
    families:Object.fromEntries(Object.entries(VISUAL_FAMILIES).map(([id,p])=>[id,{
      archetype:p.archetype,
      generation:p.generation,
      scene:p.scene,
      socialPriority:p.socialPriority,
      productionStrategy:p.productionStrategy||'single-generated-cover',
      compositions:[...p.compositions]
    }])),
    lightingProfiles:[...LIGHTING_PROFILES],
    qa:[...GLOBAL_COVER_QA]
  };
}
