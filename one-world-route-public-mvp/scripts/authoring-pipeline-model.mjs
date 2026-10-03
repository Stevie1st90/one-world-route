import {validateTripDraft,validatePublicationReadiness} from './trip-draft-contract.mjs';
import {visualFamily} from './visual-system.mjs';

// Workflow stage is derived; the public editorial status remains an independent contract.
export function authoringPipeline({trip,catalogEntry,catalog,media=null,published=false,now=new Date()}={}){
  const locales=catalog?.supportedLocales||['en'];
  const complete=value=>typeof value==='string'&&value.trim()&&!/^TODO\b/i.test(value);
  const missingLocales=locales.filter(lang=>![trip?.title?.[lang],trip?.summary?.[lang],catalogEntry?.subtitle?.[lang]].every(complete));
  const sources=trip?.sources||[],sourceIds=new Set(sources.map(s=>s.id));
  const missingSources=(trip?.segments||[]).filter(s=>!(s.verification?.sourceIds||[]).some(id=>sourceIds.has(id))).length;
  const today=now.toISOString().slice(0,10),reviewDays=trip?.maintenance?.sourceReviewDays||180;
  const staleSources=sources.filter(s=>{
    const checked=new Date(s.checkedAt+'T00:00:00Z');
    return !Number.isFinite(checked.getTime())||s.checkedAt>today||s.validUntil&&s.validUntil<today||checked.getTime()+Number(s.reviewDays||reviewDays)*86400000<now.getTime();
  }).map(s=>s.id);
  const validation=validateTripDraft({trip,catalogEntry,catalog}),publicGate=validatePublicationReadiness({trip,catalogEntry});
  const visualReady=Boolean(media?.journeyCover||media?.autoRouteVisual);
  let stage='draft';
  if((trip?.stops||[]).length>=2)stage=!sources.length||missingSources?'needs-sources':missingLocales.length?'needs-translation':
    !validation.valid?'draft':!visualReady?'needs-visual':!publicGate.valid?'editorial-preview':'ready-for-review';
  if(published)stage=staleSources.length?'needs-reverification':'published';
  return {stage,visualFamily:visualFamily(catalogEntry,trip),coverStatus:media?.journeyCover?'available':'automatic-route-visual',
    missingLocales,missingSources,staleSources,validation,publicGate,
    checks:[{id:'route',ready:(trip?.stops||[]).length>=2},{id:'sources',ready:sources.length>0&&missingSources===0},
      {id:'translation',ready:missingLocales.length===0},{id:'validation',ready:validation.valid},
      {id:'visual',ready:visualReady},{id:'public-status',ready:publicGate.valid}]};
}
