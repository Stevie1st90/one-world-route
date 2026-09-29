import {readFileSync} from 'node:fs';

const registryUrl=new URL('./config/journey-archetypes.config',import.meta.url);
const raw=JSON.parse(readFileSync(registryUrl,'utf8'));
const clone=value=>JSON.parse(JSON.stringify(value));

function assert(condition,message){if(!condition)throw new Error('Journey archetype registry: '+message)}

export function validateJourneyArchetypeRegistry(registry=raw){
  assert(Number(registry?.schemaVersion)===1,'schemaVersion must be 1');
  assert(Array.isArray(registry?.baseCapabilities)&&registry.baseCapabilities.length>0,'baseCapabilities must be a non-empty array');
  assert(registry?.archetypes&&typeof registry.archetypes==='object'&&!Array.isArray(registry.archetypes),'archetypes must be an object');
  for(const [id,item] of Object.entries(registry.archetypes)){
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id),'invalid archetype id '+id);
    assert(typeof item?.mode==='string'&&item.mode,'archetype '+id+' requires mode');
    assert(Array.isArray(item?.themes)&&item.themes.length>0,'archetype '+id+' requires themes');
    assert(Array.isArray(item?.capabilities),'archetype '+id+' capabilities must be an array');
    assert(Number.isInteger(Number(item?.reviewDays))&&Number(item.reviewDays)>0,'archetype '+id+' requires positive reviewDays');
    assert(typeof item?.maintenanceTier==='string'&&item.maintenanceTier,'archetype '+id+' requires maintenanceTier');
    assert(typeof item?.accessibility==='string'&&item.accessibility,'archetype '+id+' requires accessibility');
    assert(item?.routePolicy&&typeof item.routePolicy==='object','archetype '+id+' requires routePolicy');
    assert(typeof item?.visualTheme==='string'&&item.visualTheme,'archetype '+id+' requires visualTheme');
  }
  return true;
}

validateJourneyArchetypeRegistry(raw);

export function journeyArchetypeRegistry(){return clone(raw)}
export function journeyArchetypes(){return Object.keys(raw.archetypes)}
export function journeyArchetype(kind){
  const key=String(kind||'').trim();
  const source=raw.archetypes[key];
  if(!source)throw new Error('Unknown journey archetype: '+key);
  return clone({...source,capabilities:[...new Set([...raw.baseCapabilities,...source.capabilities])]});
}
