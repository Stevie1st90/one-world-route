import {readFile,writeFile} from 'node:fs/promises';
const groups=[
  {out:'core.bundle.js',files:['locale-en.js','iteration4.js','app.js','iteration2.js','iteration5.js'],prefix:'/* ONE WORLD ROUTE core runtime bundle. */\n'},
  {out:'features.bundle.js',files:['operational-movements.js','iteration6.js','iteration7.js','iteration8.js','platform/runtime.js','platform/map-style.js','iteration9.js','iteration10.js','release2.js','platform/i18n.js','platform/formatters.js','platform/legacy-localization.js','platform/model.js','platform/traveller.js','platform/traveller-ui.js','platform/ui.js','platform/navigation.js','platform/discovery.js','platform/home.js','platform/route-library.js','platform/regional-shell.js','platform/regional-detail.js','platform/regional-globe.js','platform/regional-timeline.js','platform/regional-controls.js','platform/regional-selection.js','platform/story.js','platform/terrain.js','platform/extensions.js','platform/extensions/cruise.js','platform/extensions/road.js','platform/extensions/border.js','platform.js'],prefix:'/* ONE WORLD ROUTE feature runtime bundle. */\n'},
  {out:'core.bundle.css',files:['styles.css','iteration2.css','iteration5.css','story.css'],prefix:'/* ONE WORLD ROUTE core styles bundle. */\n'},
  {out:'features.bundle.css',files:['iteration6.css','iteration7.css','release2.css','platform.css'],prefix:'/* ONE WORLD ROUTE feature styles bundle. */\n'}
];
for(const g of groups){
  let out=g.prefix;
  for(const f of g.files)out+='\n/* ===== '+f+' ===== */\n'+await readFile(new URL('../'+f,import.meta.url),'utf8')+'\n';
  await writeFile(new URL('../'+g.out,import.meta.url),out);
  console.log('Built',g.out);
}