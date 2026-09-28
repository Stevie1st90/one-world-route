import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../platform/i18n.js',import.meta.url),'utf8');
const legacySource=await readFile(new URL('../platform/legacy-localization.js',import.meta.url),'utf8');

function loadI18n(){
  const window={ONE_WORLD_PLATFORM_MODULES:{}};
  const context={window,Intl};
  vm.createContext(context);
  vm.runInContext(source,context);
  return window.ONE_WORLD_PLATFORM_MODULES.i18n;
}

test('platform locale data exposes localized close labels',()=>{
  const i18n=loadI18n();
  const expected={en:'Close',de:'Schließen',it:'Chiudi',es:'Cerrar',fr:'Fermer',pt:'Fechar'};
  for(const [locale,label] of Object.entries(expected)){
    assert.equal(i18n.messages[locale].close,label);
  }
});

test('plural formatter delegates cardinal rules to Intl.PluralRules',()=>{
  const i18n=loadI18n();
  const forms={one:'Route gefunden',other:'Routen gefunden'};
  assert.equal(i18n.plural('de',1,forms),'Route gefunden');
  assert.equal(i18n.plural('de',2,forms),'Routen gefunden');
  assert.equal(i18n.plural('en',0,{one:'route',other:'routes'}),'routes');
});

test('country formatter localizes ISO region codes without a manual country map',()=>{
  const i18n=loadI18n();
  assert.equal(i18n.regionName('de','IT'),'Italien');
  assert.equal(i18n.regionName('en','DE'),'Germany');
  assert.equal(i18n.regionName('de',null),'—');
  assert.doesNotMatch(source,/const\s+COUNTR(?:Y|IES)|countryNames\s*=/i);
});


test('legacy world translator is isolated and reuses platform locale data',()=>{
  const window={ONE_WORLD_PLATFORM_MODULES:{}};
  const context={window,Intl};
  vm.createContext(context);
  vm.runInContext(source,context);
  vm.runInContext(legacySource,context);
  const i18n=window.ONE_WORLD_PLATFORM_MODULES.i18n;
  const legacy=window.ONE_WORLD_PLATFORM_MODULES.legacyLocalization;
  legacy.configure({
    getLocale:()=> 'de',
    t:key=>i18n.messages.de[key]||i18n.messages.en[key]||key
  });
  assert.equal(legacy.translate('Country 3 / 195'),'Land 3/195');
  assert.equal(legacy.translate('Day 5'),'Tag 5');
  assert.equal(legacy.translate('CHAPTER 2 / 12'),'KAPITEL 2 / 12');
});


test('global discovery facets are localized across supported locales',()=>{
  const i18n=loadI18n();
  assert.equal(i18n.messages.de.facet_south_america,'Südamerika');
  assert.equal(i18n.messages.de.facet_island_hopping,'Inselhopping');
  assert.equal(i18n.messages.es.facet_japan,'Japón');
  assert.equal(i18n.messages.fr.facet_new_zealand,'Nouvelle-Zélande');
  assert.equal(i18n.messages.it.facet_nature,'Natura');
  assert.equal(i18n.messages.pt.status_editorial_preview,'Prévia editorial');
  assert.equal(i18n.messages.de.exploreByRegion,'Nach Region entdecken');
  assert.equal(i18n.messages.de.filters,'Filter');
  assert.equal(i18n.messages.fr.hideFilters,'Masquer les filtres');
  assert.equal(i18n.messages.de.personalizeJourneyTitle,'Passe die Reise an dich an');
  assert.equal(i18n.messages.en.journeyUpdates,'Journey updates');
  assert.equal(i18n.messages.de.originRegion,'Startregion (abgeleitet)');
  assert.equal(i18n.messages.en.originCountry,'Starting country');
  assert.equal(i18n.messages.de.originCountry,'Startland');
  assert.equal(i18n.messages.fr.originCountry,'Pays de départ');
  assert.equal(i18n.messages.en.curatedCollections,'Curated collections');
  assert.equal(i18n.messages.de.loadMoreJourneys,'{count} weitere Reisen anzeigen');
  assert.match(i18n.messages.en.showingJourneys,/\{shown\}.*\{total\}/);
  assert.equal(i18n.messages.de.routeAccess,'Anreise zur Route');
});
