import {createRequire} from 'node:module';
import {wrap} from './route-visual-model.mjs';

const require=createRequire(import.meta.url);
const rad=Math.PI/180;

const routePalette={
  '#67c9ef':'#78cbe8',
  '#bca0ed':'#9eb4dc',
  '#e7b46a':'#c9a46d',
  '#79adc9':'#78adc2',
  '#7bc6a1':'#79b6a0',
  '#72d2cf':'#76bdc0',
  '#c1def1':'#a6c4d4',
  '#bdd0e1':'#94afbf'
};

const safeColor=value=>routePalette[String(value||'').toLowerCase()]||'#82bfd2';

const dense=coords=>{
  const points=[];
  for(let i=1;i<coords.length;i++){
    const a=coords[i-1],b=coords[i],dl=wrap(b[0]-a[0]);
    const count=Math.max(1,Math.ceil(Math.max(Math.abs(dl),Math.abs(b[1]-a[1]))/.55));
    for(let j=0;j<count;j++){
      const t=j/count;
      points.push([a[0]+dl*t,a[1]+(b[1]-a[1])*t]);
    }
  }
  return [...points,coords.at(-1)];
};

const hexMix=(a,b,t)=>{
  const parse=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16));
  const A=parse(a),B=parse(b);
  return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');
};

export async function renderPremiumWorldOverlay({sourcePath,route,width,height}){
  const sharp=require('sharp');
  const {data,info}=await sharp(sourcePath).removeAlpha().raw().toBuffer({resolveWithObject:true});

  const sample=(lon,lat)=>{
    const fx=(((wrap(lon)+180)/360)*info.width)%info.width;
    const fy=Math.max(0,Math.min(info.height-1,(90-lat)/180*info.height));
    const x=Math.floor(fx),y=Math.floor(fy),dx=fx-x,dy=fy-y;
    const out=[];
    for(let k=0;k<3;k++){
      const pixel=(xx,yy)=>data[(Math.min(info.height-1,yy)*info.width+(xx%info.width))*info.channels+k];
      out.push((pixel(x,y)*(1-dx)+pixel(x+1,y)*dx)*(1-dy)+(pixel(x,y+1)*(1-dx)+pixel(x+1,y+1)*dx)*dy);
    }
    return out;
  };

  const spheres=[
    {cx:width*.31,cy:height*.57,r:Math.min(width*.18,height*.34),lon0:route.bounds.west+90,alpha:.88},
    {cx:width*.72,cy:height*.50,r:Math.min(width*.16,height*.30),lon0:route.bounds.west+270,alpha:.80}
  ];

  const pixels=Buffer.alloc(width*height*4);
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const at=(y*width+x)*4;
      for(const s of spheres){
        const xx=(x-s.cx)/s.r,yy=(s.cy-y)/s.r,r2=xx*xx+yy*yy;
        if(r2>1)continue;
        const z=Math.sqrt(Math.max(0,1-r2));
        const lat=Math.asin(yy)/rad;
        const lon=s.lon0+Math.atan2(xx,z)/rad;
        const raw=sample(lon,lat);

        // Premium cover treatment: preserve factual land/ocean texture but keep it
        // subordinate to the journey route and atmospheric background.
        const lum=.2126*raw[0]+.7152*raw[1]+.0722*raw[2];
        const desat=raw.map(v=>lum+(v-lum)*.58);
        const light=.66+.34*z;
        const cool=[
          desat[0]*.68+25,
          desat[1]*.72+43,
          desat[2]*.78+58
        ].map(v=>v*light);
        const edge=Math.max(0,Math.min(1,(1-r2)/.08));
        const alpha=Math.round(255*s.alpha*(.76+.24*z)*edge);

        pixels[at]=Math.round(cool[0]);
        pixels[at+1]=Math.round(cool[1]);
        pixels[at+2]=Math.round(cool[2]);
        pixels[at+3]=alpha;
        break;
      }
    }
  }

  const sphereProject=(p,s)=>{
    const lat=p[1]*rad,dl=wrap(p[0]-s.lon0)*rad,z=Math.cos(lat)*Math.cos(dl);
    return z>=-1e-8
      ?[s.cx+s.r*Math.cos(lat)*Math.sin(dl),s.cy-s.r*Math.sin(lat)]
      :null;
  };
  const fmt=n=>Number(n.toFixed(2));
  const defs=[];
  const paths=[];
  const core=Math.max(1.25,width/920);
  const glow=Math.max(3.2,width/350);
  let pathId=0;

  const draw=(coords,line)=>{
    if(coords.length<2)return;
    const id='route'+pathId++;
    const d=coords.map((p,i)=>(i?'L':'M')+fmt(p[0])+','+fmt(p[1])).join(' ');
    const start=safeColor(line.color);
    const end=safeColor(line.endColor);
    const mutedStart=hexMix(start,'#b8d7df',.12);
    const mutedEnd=hexMix(end,'#b8d7df',.12);
    defs.push('<linearGradient id="'+id+'" gradientUnits="userSpaceOnUse" x1="'+fmt(coords[0][0])+'" y1="'+fmt(coords[0][1])+'" x2="'+fmt(coords.at(-1)[0])+'" y2="'+fmt(coords.at(-1)[1])+'"><stop stop-color="'+mutedStart+'"/><stop offset="1" stop-color="'+mutedEnd+'"/></linearGradient>');
    const opacity=line.schematic?.56:.78;
    paths.push(
      '<path d="'+d+'" fill="none" stroke="url(#'+id+')" stroke-opacity=".16" stroke-width="'+fmt(glow)+'" filter="url(#softGlow)"/>',
      '<path d="'+d+'" fill="none" stroke="url(#'+id+')" stroke-opacity="'+opacity+'" stroke-width="'+fmt(core)+'"/>'
    );
  };

  for(const line of route.lines){
    const coords=dense(line.coordinates);
    for(const sphere of spheres){
      let visible=[];
      for(const p of coords){
        const q=sphereProject(p,sphere);
        if(q)visible.push(q);
        else{
          draw(visible,line);
          visible=[];
        }
      }
      draw(visible,line);
    }
  }

  const atmosphere=spheres.map((s,i)=>
    '<circle cx="'+fmt(s.cx)+'" cy="'+fmt(s.cy)+'" r="'+fmt(s.r+1)+'" fill="none" stroke="#83d6f1" stroke-opacity="'+(i===0?'.28':'.22')+'" stroke-width="'+fmt(Math.max(1.4,width/1100))+'" filter="url(#rimGlow)"/>'
  ).join('');

  // Only start/end anchors survive on the cover. Intermediate route nodes are
  // intentionally removed to prevent dense regions from becoming visual noise.
  const endpoints=[
    route.lines[0]?.coordinates?.[0],
    route.lines.at(-1)?.coordinates?.at(-1)
  ].filter(Boolean);
  const endpointSvg=[];
  for(const p of endpoints){
    for(const s of spheres){
      const q=sphereProject(p,s);
      if(!q)continue;
      endpointSvg.push(
        '<circle cx="'+fmt(q[0])+'" cy="'+fmt(q[1])+'" r="'+fmt(Math.max(2,width/620))+'" fill="#dff6fb" fill-opacity=".92" stroke="#6cc5df" stroke-opacity=".75" stroke-width="'+fmt(Math.max(.8,width/1800))+'"/>'
      );
    }
  }

  const overlay=Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'">'+
      '<defs>'+
        '<filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="'+fmt(Math.max(.8,width/1500))+'"/></filter>'+
        '<filter id="rimGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="'+fmt(Math.max(1.2,width/900))+'"/></filter>'+
        defs.join('')+
      '</defs>'+
      atmosphere+
      '<g stroke-linecap="round" stroke-linejoin="round">'+paths.join('')+endpointSvg.join('')+'</g>'+
    '</svg>'
  );

  return sharp(pixels,{raw:{width,height,channels:4}})
    .composite([{input:overlay}])
    .png()
    .toBuffer();
}
