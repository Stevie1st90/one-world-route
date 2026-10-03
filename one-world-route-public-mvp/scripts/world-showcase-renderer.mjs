import {createRequire} from 'node:module';
import {wrap} from './route-visual-model.mjs';

const require=createRequire(import.meta.url);

export const WORLD_SHOWCASE_STYLE=Object.freeze({
  version:'premium-full-bleed-world-v1',
  projection:'equirectangular-full-bleed',
  fullBleed:true,
  spaceBackground:false,
  visibleContainer:false,
  basemapBrightness:.84,
  basemapSaturation:.68,
  routeDetailedOpacity:.84,
  routeSchematicOpacity:.58,
  routeDenseRegionMultiplier:.72,
  routeGlowOpacity:.05,
  seamPixelJumpFraction:.42,
  seamLongitudeJumpDegrees:170,
  antarcticShadeOpacity:.22
});

const routePalette={
  '#67c9ef':'#72cfe5',
  '#bca0ed':'#9fb6d8',
  '#e7b46a':'#d5ac70',
  '#79adc9':'#7eb9ca',
  '#7bc6a1':'#7bc0a2',
  '#72d2cf':'#76c7c7',
  '#c1def1':'#abcbd7',
  '#bdd0e1':'#9ab8c4'
};

const safeColor=value=>routePalette[String(value||'').toLowerCase()]||'#86cad9';
const fmt=n=>Number(n.toFixed(2));
const mix=(a,b,t)=>{
  const parse=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16));
  const A=parse(a),B=parse(b);
  return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');
};

const project=(point,width,height)=>{
  const lon=wrap(point[0]);
  const lat=Math.max(-90,Math.min(90,point[1]));
  return [
    ((lon+180)/360)*width,
    ((90-lat)/180)*height,
    {lon,lat}
  ];
};

const dense=coords=>{
  const points=[];
  for(let i=1;i<coords.length;i++){
    const a=coords[i-1],b=coords[i],dl=wrap(b[0]-a[0]);
    const count=Math.max(1,Math.ceil(Math.max(Math.abs(dl),Math.abs(b[1]-a[1]))/.40));
    for(let j=0;j<count;j++){
      const t=j/count;
      points.push([a[0]+dl*t,a[1]+(b[1]-a[1])*t]);
    }
  }
  return [...points,coords.at(-1)];
};

const denseRegionFactor=line=>{
  const coords=line.coordinates||[];
  if(!coords.length)return 1;
  const mid=coords[Math.floor(coords.length/2)];
  const lon=wrap(mid[0]),lat=mid[1];
  return lon>=-15&&lon<=70&&lat>=30&&lat<=65
    ?WORLD_SHOWCASE_STYLE.routeDenseRegionMultiplier
    :1;
};

export async function renderPremiumWorldOverlay({sourcePath,route,width,height}){
  const sharp=require('sharp');

  const basemap=await sharp(sourcePath)
    .resize(width,height,{fit:'fill'})
    .removeAlpha()
    .modulate({
      brightness:WORLD_SHOWCASE_STYLE.basemapBrightness,
      saturation:WORLD_SHOWCASE_STYLE.basemapSaturation
    })
    .linear([.93,.96,1.02],[2,4,7])
    .png()
    .toBuffer();

  const defs=[
    '<filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="'+fmt(Math.max(.45,width/2800))+'"/></filter>'
  ];
  const paths=[];
  let id=0;
  const core=Math.max(.9,width/1180);
  const glow=Math.max(1.7,width/820);

  const draw=(coords,line)=>{
    if(coords.length<2)return;
    const gid='r'+id++;
    const d=coords.map((p,i)=>(i?'L':'M')+fmt(p[0])+','+fmt(p[1])).join(' ');
    const c1=mix(safeColor(line.color),'#dceff3',.08);
    const c2=mix(safeColor(line.endColor),'#dceff3',.08);
    defs.push('<linearGradient id="'+gid+'" gradientUnits="userSpaceOnUse" x1="'+fmt(coords[0][0])+'" y1="'+fmt(coords[0][1])+'" x2="'+fmt(coords.at(-1)[0])+'" y2="'+fmt(coords.at(-1)[1])+'"><stop stop-color="'+c1+'"/><stop offset="1" stop-color="'+c2+'"/></linearGradient>');
    const density=denseRegionFactor(line);
    const baseOpacity=line.schematic?WORLD_SHOWCASE_STYLE.routeSchematicOpacity:WORLD_SHOWCASE_STYLE.routeDetailedOpacity;
    const opacity=baseOpacity*density;
    paths.push(
      '<path d="'+d+'" fill="none" stroke="url(#'+gid+')" stroke-opacity="'+fmt(WORLD_SHOWCASE_STYLE.routeGlowOpacity*density)+'" stroke-width="'+fmt(glow)+'" filter="url(#routeGlow)"/>',
      '<path d="'+d+'" fill="none" stroke="url(#'+gid+')" stroke-opacity="'+fmt(opacity)+'" stroke-width="'+fmt(core)+'"/>'
    );
  };

  for(const line of route.lines){
    const points=dense(line.coordinates);
    let run=[];
    let previous=null;
    let previousLon=null;
    for(const p of points){
      const q=project(p,width,height);
      const xy=[q[0],q[1]];
      const seamJump=previous&&(
        Math.abs(xy[0]-previous[0])>width*WORLD_SHOWCASE_STYLE.seamPixelJumpFraction||
        (previousLon!==null&&Math.abs(q[2].lon-previousLon)>WORLD_SHOWCASE_STYLE.seamLongitudeJumpDegrees)
      );
      if(seamJump){
        draw(run,line);
        run=[];
      }
      run.push(xy);
      previous=xy;
      previousLon=q[2].lon;
    }
    draw(run,line);
  }

  const routeSvg=Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'">'+
      '<defs>'+defs.join('')+'</defs>'+
      '<g stroke-linecap="round" stroke-linejoin="round">'+paths.join('')+'</g>'+
    '</svg>'
  );

  const finish=Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'">'+
      '<defs>'+
        '<linearGradient id="south" x1="0" y1="0" x2="0" y2="1">'+
          '<stop offset="0" stop-color="#0b3148" stop-opacity="0"/>'+
          '<stop offset=".78" stop-color="#0b3148" stop-opacity="0"/>'+
          '<stop offset="1" stop-color="#0b3148" stop-opacity="'+WORLD_SHOWCASE_STYLE.antarcticShadeOpacity+'"/>'+
        '</linearGradient>'+
        '<radialGradient id="v" cx=".5" cy=".48" r=".78">'+
          '<stop offset=".62" stop-color="#001018" stop-opacity="0"/>'+
          '<stop offset="1" stop-color="#001018" stop-opacity=".13"/>'+
        '</radialGradient>'+
      '</defs>'+
      '<rect width="100%" height="100%" fill="url(#south)"/>'+
      '<rect width="100%" height="100%" fill="url(#v)"/>'+
    '</svg>'
  );

  return sharp(basemap)
    .composite([
      {input:routeSvg,blend:'over'},
      {input:finish,blend:'over'}
    ])
    .png()
    .toBuffer();
}
