import {readFileSync} from 'node:fs';

const countries=JSON.parse(readFileSync(new URL('../data/country-centroids.json',import.meta.url),'utf8'));
const byCode=new Map(countries.map(country=>[String(country.cca2||'').toUpperCase(),country]));

const primaryByRegion={
  Europe:'europe',
  Asia:'asia',
  Africa:'africa',
  Oceania:'oceania'
};
const subregionAliases={
  'Northern Europe':'northern-europe',
  'Southern Europe':'southern-europe',
  'Eastern Europe':'eastern-europe',
  'Western Europe':'western-europe',
  'Eastern Asia':'east-asia',
  'South-Eastern Asia':'south-east-asia',
  'Southern Asia':'south-asia',
  'Western Asia':'west-asia',
  'Central Asia':'central-asia',
  'Northern Africa':'north-africa',
  'Southern Africa':'southern-africa',
  'Eastern Africa':'east-africa',
  'Western Africa':'west-africa',
  'Middle Africa':'central-africa',
  'Northern America':'north-america',
  'Central America':'central-america',
  Caribbean:'caribbean',
  'South America':'south-america',
  'Australia and New Zealand':'australia-new-zealand',
  Melanesia:'melanesia',
  Micronesia:'micronesia',
  Polynesia:'polynesia'
};
const primaryRegions=new Set(['europe','asia','africa','north-america','south-america','oceania']);

function tagsForCountry(country){
  if(!country)return [];
  let primary=primaryByRegion[country.region]||null;
  if(country.region==='Americas')primary=country.subregion==='South America'?'south-america':'north-america';
  const subregion=subregionAliases[country.subregion]||null;
  return [...new Set([primary,subregion].filter(Boolean))];
}

export function deriveDiscoveryRegions(countryCodes=[]){
  const tags=[];
  for(const code of countryCodes){
    for(const tag of tagsForCountry(byCode.get(String(code||'').toUpperCase())))if(!tags.includes(tag))tags.push(tag);
  }
  return tags;
}

export function derivePrimaryRegion(countryCodes=[]){
  return deriveDiscoveryRegions(countryCodes).find(tag=>primaryRegions.has(tag))||null;
}

export function countryRegionRecord(code){
  const country=byCode.get(String(code||'').toUpperCase());
  return country?{cca2:country.cca2,region:country.region,subregion:country.subregion,tags:tagsForCountry(country)}:null;
}
