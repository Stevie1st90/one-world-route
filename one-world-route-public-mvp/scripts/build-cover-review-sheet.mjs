import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import sharp from 'sharp';
const argv=Object.fromEntries(process.argv.slice(2).map(arg=>{const m=arg.match(/^--([^=]+)(?:=(.*))?$/);return m?[m[1],m[2]??true]:[arg,true]}));
if(!argv.spec)throw Error('Usage: node scripts/build-cover-review-sheet.mjs --spec=/path/batch.json --source-dir=/path/images [--out=/path/review-sheet.jpg]');
const specPath=resolve(String(argv.spec)),sourceDir=resolve(String(argv['source-dir']||dirname(specPath)));
const spec=JSON.parse(await readFile(specPath,'utf8')),items=spec.items||[];
const cellW=420,cellH=285,cols=Math.min(4,Math.max(1,Number(argv.cols||4))),rows=Math.ceil(items.length/cols),composites=[],checks=[];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
for(let i=0;i<items.length;i++){
 const item=items[i],p=resolve(sourceDir,item.sourceFilename);
 try{
  const img=sharp(p),m=await img.metadata(),ratio=m.width/m.height,ok=Math.abs(ratio-16/9)<.03&&m.width>=1200;
  checks.push({tripId:item.tripId,file:item.sourceFilename,width:m.width,height:m.height,aspect:Number(ratio.toFixed(4)),technicalPass:ok});
  const thumb=await img.rotate().resize(cellW,236,{fit:'cover'}).jpeg({quality:82}).toBuffer();
  const label=Buffer.from(`<svg width="${cellW}" height="49"><rect width="100%" height="100%" fill="#08111b"/><text x="14" y="21" fill="white" font-size="15" font-family="Arial,sans-serif">${esc(item.tripId)}</text><text x="14" y="40" fill="#8ea5b8" font-size="12" font-family="Arial,sans-serif">${m.width}×${m.height} · ${ok?'TECH PASS':'CHECK'}</text></svg>`);
  const cell=await sharp({create:{width:cellW,height:cellH,channels:3,background:'#08111b'}}).composite([{input:thumb,top:0,left:0},{input:label,top:236,left:0}]).jpeg({quality:86}).toBuffer();
  composites.push({input:cell,left:(i%cols)*cellW,top:Math.floor(i/cols)*cellH});
 }catch(e){checks.push({tripId:item.tripId,file:item.sourceFilename,technicalPass:false,error:String(e.message||e)});}
}
const out=resolve(String(argv.out||resolve(dirname(specPath),'cover-review-sheet.jpg')));
await mkdir(dirname(out),{recursive:true});
await sharp({create:{width:cellW*cols,height:cellH*rows,channels:3,background:'#050a11'}}).composite(composites).jpeg({quality:88}).toFile(out);
await writeFile(out.replace(/\.[^.]+$/,'.json'),JSON.stringify({schemaVersion:1,items:checks},null,2)+'\n');
console.log('Review sheet:',out);
