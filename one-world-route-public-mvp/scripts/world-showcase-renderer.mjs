import {createRequire} from 'node:module';
import {wrap} from './route-visual-model.mjs';

const require=createRequire(import.meta.url);
const DEG=Math.PI/180;
const CENTRAL_MERIDIAN=12;

const routePalette={
  '#67c9ef':'#75d0e7',
  '#bca0ed':'#9eb4d9',
  '#e7b46a':'#d2aa72',
  '#79adc9':'#7db7c8',
  '#7bc6a1':'#79bca0',
  '#72d2cf':'#75c4c5',
  '#c1def1':'#a9c9d5',
  '#bdd0e1':'#98b6c3'
};

const safeColor=value=>routePalette[String(value||'').toLowerCase()]||'#86c9d8';
const clamp01=v=>Math.max(0,Math.min(1,v));
const smoothstep=(a,b,v)=>{
  const t=clamp01((v-a)/(b-a));
  return t*t*(3-2*t);
};
const fmt=n=>Number(n.toFixed(2));

const mix=(a,b,t)=>{
  const parse=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16));
  const A=parse(a),B=parse(b);
  return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');
};

// Robinson-like compromise projection.
// We intentionally use a compact deterministic approximation instead of claiming
// an exact Robinson/Winkel Tripel implementation. Longitude width contracts toward
// the poles while latitude remains monotonic, which gives a natural world silhouette
// and avoids the technical rectangle of an equirectangular cover.
const latWidth=lat=>{
  const c=Math.max(0,Math.cos(Math.abs(lat)*DEG));
  return .58+.42*Math.pow(c,.48);
};

const projectedY=lat=>{
  const n=lat/90;
  return n*(.92+.08*Math.cos(Math.abs(lat)*DEG));
};

const inverseProjectedY=yNorm=>{
  let lat=Math.max(-90,Math.min(90,yNorm*90));
  for(let i=0;i<5;i++){
    const abs=Math.abs(lat);
    const c=Math.cos(abs*DEG);
    const sign=lat<0?-1:1;
    const f=(lat/90)*(.92+.08*c)-yNorm;
    const deriv=(.92+.08*c)/90-(lat/90)*.08*Math.sin(abs*DEG)*DEG*sign;
    lat-=f/(Math.abs(deriv)<1e-6?1e-6:deriv);
  }
  return Math.max(-90,Math.min(90,lat));
};

const project=(point,layout)=>{
  const lon=wrap(point[0]-CENTRAL_MERIDIAN);
  const lat=Math.max(-90,Math.min(90,point[1]));
  const xNorm=(lon/180)*latWidth(lat);
  const yNorm=projectedY(lat);
  return [
    layout.cx+xNorm*(layout.mapW/2),
    layout.cy-yNorm*(layout.mapH/2),
    {lon,lat,xNorm,yNorm}
  ];
};

const envelopeAlpha=(x,y,layout)=>{
  const yNorm=(layout.cy-y)/(layout.mapH/2);
  if(Math.abs(yNorm)>1)return 0;
  const lat=inverseProjectedY(yNorm);
  const width=latWidth(lat);
  const xNorm=(x-layout.cx)/(layout.mapW/2);
  const edge=Math.abs(xNorm)/width;
  if(edge>=1)return 0;

  const side=1-smoothstep(.91,1,edge);
  const polar=1-smoothstep(.88,1,Math.abs(yNorm));
  const antarctic=lat<-63?1-smoothstep(-63,-86,lat):1;
  return clamp01(side*polar*antarctic);
};

const dense=coords=>{
  const points=[];
  for(let i=1;i<coords.length;i++){
    const a=coords[i-1],b=coords[i],dl=wrap(b[0]-a[0]);
    const count=Math.max(1,Math.ceil(Math.max(Math.abs(dl),Math.abs(b[1]-a[1]))/.42));
    for(let j=0;j<count;j++){
      const t=j/count;
      points.push([a[0]+dl*t,a[1]+(b[1]-a[1])*t]);
    }
  }
  return [...points,coords.at(-1)];
};

export async function renderPremiumWorldOverlay({sourcePath,route,width,height}){
  const sharp=require('sharp');
  const layout={
    cx:width*.5,
    cy:height*.515,
    mapW:width*.92,
    mapH:height*.69
  };

  const {data:source,info}=await sharp(sourcePath)
    .removeAlpha()
    .raw()
    .toBuffer({resolveWithObject:true});

  const sample=(lon,lat)=>{
    const sx=((wrap(lon)+180)/360)*(info.width-1);
    const sy=((90-lat)/180)*(info.height-1);
    const x0=Math.max(0,Math.min(info.width-1,Math.floor(sx)));
    const y0=Math.max(0,Math.min(info.height-1,Math.floor(sy)));
    const x1=Math.min(info.width-1,x0+1);
    const y1=Math.min(info.height-1,y0+1);
    const dx=sx-x0,dy=sy-y0;
    const out=[0,0,0];
    for(let k=0;k<3;k++){
      const p=(x,y)=>source[(y*info.width+x)*info.channels+k];
      const top=p(x0,y0)*(1-dx)+p(x1,y0)*dx;
      const bottom=p(x0,y1)*(1-dx)+p(x1,y1)*dx;
      out[k]=top*(1-dy)+bottom*dy;
    }
    return out;
  };

  const pixels=Buffer.alloc(width*height*4);
  const mask=Buffer.alloc(width*height*4);
  for(let y=0;y<height;y++){
    const yNorm=(layout.cy-y)/(layout.mapH/2);
    if(Math.abs(yNorm)>1)continue;
    const lat=inverseProjectedY(yNorm);
    const widthFactor=latWidth(lat);
    const xHalf=(layout.mapW/2)*widthFactor;
    const x0=Math.max(0,Math.floor(layout.cx-xHalf));
    const x1=Math.min(width-1,Math.ceil(layout.cx+xHalf));

    for(let x=x0;x<=x1;x++){
      const at=(y*width+x)*4;
      const alpha=envelopeAlpha(x,y,layout);
      if(alpha<=0)continue;

      const xNorm=(x-layout.cx)/(layout.mapW/2);
      const lon=CENTRAL_MERIDIAN+(xNorm/widthFactor)*180;
      const raw=sample(lon,lat);
      const lum=.2126*raw[0]+.7152*raw[1]+.0722*raw[2];
      const desat=raw.map(v=>lum+(v-lum)*.50);
      const polarShade=.93-.12*smoothstep(.62,1,Math.abs(yNorm));

      pixels[at]=Math.round((desat[0]*.72+15)*polarShade);
      pixels[at+1]=Math.round((desat[1]*.77+27)*polarShade);
      pixels[at+2]=Math.round((desat[2]*.83+38)*polarShade);
      pixels[at+3]=Math.round(255*.77*alpha);

      mask[at]=255;
      mask[at+1]=255;
      mask[at+2]=255;
      mask[at+3]=Math.round(255*alpha);
    }
  }

  const defs=[
    '<filter id="routeGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="'+fmt(Math.max(.75,width/1900))+'"/></filter>'
  ];
  const paths=[];
  let id=0;
  const core=Math.max(1.15,width/900);
  const glow=Math.max(2.6,width/470);

  const draw=(coords,line)=>{
    if(coords.length<2)return;
    const gid='r'+id++;
    const d=coords.map((p,i)=>(i?'L':'M')+fmt(p[0])+','+fmt(p[1])).join(' ');
    const c1=mix(safeColor(line.color),'#d7eef2',.09);
    const c2=mix(safeColor(line.endColor),'#d7eef2',.09);
    defs.push('<linearGradient id="'+gid+'" gradientUnits="userSpaceOnUse" x1="'+fmt(coords[0][0])+'" y1="'+fmt(coords[0][1])+'" x2="'+fmt(coords.at(-1)[0])+'" y2="'+fmt(coords.at(-1)[1])+'"><stop stop-color="'+c1+'"/><stop offset="1" stop-color="'+c2+'"/></linearGradient>');
    const opacity=line.schematic?.57:.82;
    paths.push(
      '<path d="'+d+'" fill="none" stroke="url(#'+gid+')" stroke-opacity=".17" stroke-width="'+fmt(glow)+'" filter="url(#routeGlow)"/>',
      '<path d="'+d+'" fill="none" stroke="url(#'+gid+')" stroke-opacity="'+opacity+'" stroke-width="'+fmt(core)+'"/>'
    );
  };

  for(const line of route.lines){
    const points=dense(line.coordinates);
    let run=[];
    let previous=null;
    for(const p of points){
      const q=project(p,layout);
      const xy=[q[0],q[1]];
      if(previous&&Math.abs(xy[0]-previous[0])>layout.mapW*.42){
        draw(run,line);
        run=[];
      }
      run.push(xy);
      previous=xy;
    }
    draw(run,line);
  }

  const endpoints=[
    route.lines[0]?.coordinates?.[0],
    route.lines.at(-1)?.coordinates?.at(-1)
  ].filter(Boolean).map(p=>project(p,layout));

  const endpointSvg=endpoints.map(q=>
    '<circle cx="'+fmt(q[0])+'" cy="'+fmt(q[1])+'" r="'+fmt(Math.max(1.7,width/790))+'" fill="#e4f8fb" fill-opacity=".90" stroke="#79c6d7" stroke-opacity=".68" stroke-width="'+fmt(Math.max(.7,width/2200))+'"/>'
  ).join('');

  const routeSvg=Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'">'+
      '<defs>'+defs.join('')+'</defs>'+
      '<g stroke-linecap="round" stroke-linejoin="round">'+paths.join('')+endpointSvg+'</g>'+
    '</svg>'
  );

  const routeLayer=await sharp(routeSvg)
    .ensureAlpha()
    .composite([{
      input:mask,
      raw:{width,height,channels:4},
      blend:'dest-in'
    }])
    .png()
    .toBuffer();

  const atmosphere=Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'">'+
      '<defs><radialGradient id="a" cx=".5" cy=".52" r=".56"><stop offset=".45" stop-color="#79d7ea" stop-opacity=".045"/><stop offset=".82" stop-color="#4ba2bc" stop-opacity=".018"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>'+
      '<ellipse cx="'+fmt(layout.cx)+'" cy="'+fmt(layout.cy)+'" rx="'+fmt(layout.mapW*.49)+'" ry="'+fmt(layout.mapH*.54)+'" fill="url(#a)"/>'+
    '</svg>'
  );

  return sharp(pixels,{raw:{width,height,channels:4}})
    .composite([
      {input:atmosphere,blend:'over'},
      {input:routeLayer,blend:'over'}
    ])
    .png()
    .toBuffer();
}
