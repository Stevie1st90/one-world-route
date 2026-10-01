// Reuses the v1 Earth renderer unchanged. A rotated source texture supplies a
// region-centered camera; the first orthographic hemisphere becomes the portrait.
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {localReliefProvider} from './route-visual-provider.mjs';
import {hash} from './route-visual-model.mjs';
const ROOT=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,ROOT),'utf8'));
const source=await read('data/visual-sources/source.json'),sourceBytes=await readFile(new URL(source.asset,ROOT));
if(hash(sourceBytes)!==source.sha256||source.rightsStatus!=='approved')throw Error('Invalid region Earth source');
const cameras=[['europe',15,48,'#67c9ef'],['asia',92,27,'#bca0ed'],['africa',20,2,'#e7b46a'],['north-america',-100,36,'#79adc9'],['south-america',-62,-20,'#7bc6a1'],['oceania',150,-22,'#72d2cf']];
const codeHash=hash((await Promise.all(['scripts/build-region-visuals.mjs','scripts/route-visual-provider.mjs'].map(p=>readFile(new URL(p,ROOT),'utf8')))).join('\n'));
const old=await read('data/platform/region-visuals.json').catch(()=>({assets:[]})),assets=[],check=process.argv.includes('--check');
let raster,temp,rendered=0;
try{
for(const [regionId,lon0,lat0,color] of cameras){
 const inputHash=hash({regionId,lon0,lat0,color,source:source.sha256,codeHash,version:1}),asset='./assets/generated/regions/'+regionId+'-'+inputHash.slice(0,16)+'.webp';
 const prior=old.assets.find(a=>a.regionId===regionId);
 if(prior?.inputHash===inputHash&&prior.asset===asset&&hash(await readFile(new URL(asset.slice(2),ROOT)).catch(()=>Buffer.from('missing')))===prior.outputHash){assets.push(prior);continue;}
 if(check)throw Error('Stale region portrait: '+regionId);
 if(!raster){raster=await sharp(sourceBytes).resize(2160,1080).removeAlpha().raw().toBuffer({resolveWithObject:true});temp=await mkdtemp(path.join(tmpdir(),'owr-regions-'));}
 const {data,info}=raster,w=info.width,h=info.height,pixels=Buffer.alloc(w*h*3),rad=Math.PI/180;
 const phi=lat0*rad,lambda=lon0*rad,accent=color.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const lat=(90-(y+.5)/h*180)*rad,lon=((x+.5)/w*360-180)*rad;
  // Rotate the local sphere basis towards the region center (not a map crop).
  const vx=Math.cos(lat)*Math.cos(lon),vy=Math.cos(lat)*Math.sin(lon),vz=Math.sin(lat);
  const rx=Math.cos(phi)*vx-Math.sin(phi)*vz,rz=Math.sin(phi)*vx+Math.cos(phi)*vz;
  const glat=Math.asin(Math.max(-1,Math.min(1,rz))),glon=Math.atan2(vy,rx)+lambda;
  const sx=((glon/rad+180)%360+360)%360/360*w,sy=Math.max(0,Math.min(h-1,(90-glat/rad)/180*h));
  const ix=Math.floor(sx),iy=Math.floor(sy),dx=sx-ix,dy=sy-iy,at=(y*w+x)*3;
  const emphasis=Math.max(0,vx),tint=.08+.1*emphasis,dim=.62+.38*emphasis;
  for(let k=0;k<3;k++){
   const p=(xx,yy)=>data[(Math.min(h-1,yy)*w+(xx%w))*info.channels+k];
   const value=(p(ix,iy)*(1-dx)+p(ix+1,iy)*dx)*(1-dy)+(p(ix,iy+1)*(1-dx)+p(ix+1,iy+1)*dx)*dy;
   pixels[at+k]=Math.round((value*(1-tint)+accent[k]*tint)*dim);
  }
 }
 const rotated=path.join(temp,regionId+'-source.webp'),render=path.join(temp,regionId+'-globe.webp');
 await sharp(pixels,{raw:{width:w,height:h,channels:3}}).webp({quality:92}).toFile(rotated);
 const provider=await localReliefProvider(rotated);
 await provider.render({scope:'GLOBAL',bounds:{west:-90,east:270,south:-90,north:90},lines:[],markers:[]},'landscape',render);
 const target=new URL(asset.slice(2),ROOT);await mkdir(new URL('assets/generated/regions/',ROOT),{recursive:true});
 const mask=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720"><defs><radialGradient id="fade"><stop offset=".84" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient></defs><circle cx="360" cy="360" r="354" fill="url(#fade)"/></svg>');
 await sharp(render).extract({left:20,top:61,width:565,height:565}).resize(720,720).composite([{input:mask,blend:'dest-in'}]).webp({quality:86}).toFile(fileURLToPath(target));
 const bytes=await readFile(target);
 const altPrefixes={en:'Geographic globe portrait: ',de:'Geografisches Globusporträt: ',it:'Ritratto geografico del globo: ',es:'Retrato geográfico del globo: ',fr:'Portrait géographique du globe : ',pt:'Retrato geográfico do globo: '};
 const names={europe:['Europe','Europa','Europa','Europa','Europe','Europa'],asia:['Asia','Asien','Asia','Asia','Asie','Ásia'],africa:['Africa','Afrika','Africa','África','Afrique','África'],'north-america':['North America','Nordamerika','Nord America','América del Norte','Amérique du Nord','América do Norte'],'south-america':['South America','Südamerika','Sud America','América del Sur','Amérique du Sud','América do Sul'],oceania:['Oceania','Ozeanien','Oceania','Oceanía','Océanie','Oceania']};
 assets.push({assetId:'region-globe-'+regionId,regionId,type:'image',sourceType:'route-render',mediaKind:'region-visual',status:'published',rightsStatus:'approved',asset,aspectRatio:'1:1',width:720,height:720,focalPoint:{x:.5,y:.5},alt:Object.fromEntries(Object.entries(altPrefixes).map(([l,p],i)=>[l,p+names[regionId][i]])),attribution:'Made with Natural Earth · ONE WORLD ROUTE',attributionRequired:false,license:'Natural Earth public domain; original globe presentation',sourceLicenseUrl:source.licenseUrl,inputHash,outputHash:hash(bytes),bytes:bytes.length,camera:{longitude:lon0,latitude:lat0},accent:color});rendered++;
}
}finally{if(temp)await rm(temp,{recursive:true,force:true});}
const report={schemaVersion:1,provider:'local-natural-earth',sourceHash:source.sha256,assets};
const text=JSON.stringify(report,null,2)+'\n',target=new URL('data/platform/region-visuals.json',ROOT);
if(check){if(await readFile(target,'utf8')!==text)throw Error('Stale region manifest');}else await writeFile(target,text);
console.log(JSON.stringify({regionPortraits:assets.length,rendered,reused:assets.length-rendered,bytes:assets.reduce((s,a)=>s+a.bytes,0),check}));
