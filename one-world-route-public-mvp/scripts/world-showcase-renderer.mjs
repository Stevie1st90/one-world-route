import {createRequire} from 'node:module';
import {wrap} from './route-visual-model.mjs';

const require=createRequire(import.meta.url);

const routePalette={
  '#67c9ef':'#72c7df',
  '#bca0ed':'#93a9d2',
  '#e7b46a':'#c9a16e',
  '#79adc9':'#75a9bd',
  '#7bc6a1':'#74af98',
  '#72d2cf':'#70b6ba',
  '#c1def1':'#a0bdcc',
  '#bdd0e1':'#8ea9b8'
};

const safeColor=value=>routePalette[String(value||'').toLowerCase()]||'#82bfd2';

const dense=coords=>{
  const points=[];
  for(let i=1;i<coords.length;i++){
    const a=coords[i-1],b=coords[i],dl=wrap(b[0]-a[0]);
    const count=Math.max(1,Math.ceil(Math.max(Math.abs(dl),Math.abs(b[1]-a[1]))/.45));
    for(let j=0;j<count;j++){
      const t=j/count;
      points.push([a[0]+dl*t,a[1]+(b[1]-a[1])*t]);
    }
  }
  return [...points,coords.at(-1)];
};

const fmt=n=>Number(n.toFixed(2));
const mix=(a,b,t)=>{
  const parse=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16));
  const A=parse(a),B=parse(b);
  return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');
};

export async function renderPremiumWorldOverlay({sourcePath,route,width,height}){
  const sharp=require('sharp');

  const mapW=Math.round(width*.82);
  const mapH=Math.round(mapW/2);
  const left=Math.round((width-mapW)/2);
  const top=Math.round((height-mapH)/2+height*.015);
  const radius=Math.max(16,Math.round(width*.022));

  const relief=await sharp(sourcePath)
    .resize(mapW,mapH,{fit:'fill'})
    .removeAlpha()
    .modulate({brightness:.70,saturation:.48})
    .linear([.86,.90,.96],[5,10,14])
    .png()
    .toBuffer();

  const alpha=Buffer.alloc(mapW*mapH,Math.round(255*.82));
  const reliefAlpha=await sharp(relief)
    .removeAlpha()
    .joinChannel(alpha,{raw:{width:mapW,height:mapH,channels:1}})
    .composite([{
      input:Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="'+mapW+'" height="'+mapH+'">'+
        '<rect x="0" y="0" width="'+mapW+'" height="'+mapH+'" rx="'+radius+'" ry="'+radius+'" fill="#fff"/>'+
        '</svg>'
      ),
      blend:'dest-in'
    }])
    .png()
    .toBuffer();

  const project=p=>[
    left+((wrap(p[0])+180)/360)*mapW,
    top+((90-p[1])/180)*mapH
  ];

  const defs=[
    '<filter id="routeGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="'+fmt(Math.max(.6,width/2100))+'"/></filter>',
    '<filter id="mapGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="'+fmt(Math.max(2,width/650))+'"/></filter>'
  ];
  const lines=[];
  let routeId=0;
  const core=Math.max(.9,width/1150);
  const glow=Math.max(2.4,width/500);

  const draw=(coords,line)=>{
    if(coords.length<2)return;
    const id='g'+routeId++;
    const d=coords.map((p,i)=>(i?'L':'M')+fmt(p[0])+','+fmt(p[1])).join(' ');
    const c1=mix(safeColor(line.color),'#d6edf2',.10);
    const c2=mix(safeColor(line.endColor),'#d6edf2',.10);
    defs.push('<linearGradient id="'+id+'" gradientUnits="userSpaceOnUse" x1="'+fmt(coords[0][0])+'" y1="'+fmt(coords[0][1])+'" x2="'+fmt(coords.at(-1)[0])+'" y2="'+fmt(coords.at(-1)[1])+'"><stop stop-color="'+c1+'"/><stop offset="1" stop-color="'+c2+'"/></linearGradient>');
    const opacity=line.schematic?.48:.72;
    lines.push(
      '<path d="'+d+'" fill="none" stroke="url(#'+id+')" stroke-opacity=".15" stroke-width="'+fmt(glow)+'" filter="url(#routeGlow)"/>',
      '<path d="'+d+'" fill="none" stroke="url(#'+id+')" stroke-opacity="'+opacity+'" stroke-width="'+fmt(core)+'"/>'
    );
  };

  for(const line of route.lines){
    const points=dense(line.coordinates);
    let run=[];
    let prev=null;
    for(const p of points){
      const q=project(p);
      if(prev&&Math.abs(q[0]-prev[0])>mapW*.48){
        draw(run,line);
        run=[];
      }
      run.push(q);
      prev=q;
    }
    draw(run,line);
  }

  const endpoints=[
    route.lines[0]?.coordinates?.[0],
    route.lines.at(-1)?.coordinates?.at(-1)
  ].filter(Boolean).map(project);

  const endpointSvg=endpoints.map(q=>
    '<circle cx="'+fmt(q[0])+'" cy="'+fmt(q[1])+'" r="'+fmt(Math.max(1.8,width/780))+'" fill="#dff6fb" fill-opacity=".92" stroke="#73bdd0" stroke-opacity=".7" stroke-width="'+fmt(Math.max(.7,width/2200))+'"/>'
  ).join('');

  const frame=Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'">'+
      '<defs>'+defs.join('')+'</defs>'+
      '<rect x="'+left+'" y="'+top+'" width="'+mapW+'" height="'+mapH+'" rx="'+radius+'" ry="'+radius+'" fill="#5cc7ea" fill-opacity=".025" stroke="#89d6e8" stroke-opacity=".18" stroke-width="'+fmt(Math.max(.8,width/1900))+'" filter="url(#mapGlow)"/>'+
      '<rect x="'+left+'" y="'+top+'" width="'+mapW+'" height="'+mapH+'" rx="'+radius+'" ry="'+radius+'" fill="none" stroke="#b6e6ef" stroke-opacity=".13" stroke-width="'+fmt(Math.max(.7,width/2300))+'"/>'+
      '<g stroke-linecap="round" stroke-linejoin="round">'+lines.join('')+endpointSvg+'</g>'+
    '</svg>'
  );

  return sharp({
    create:{width,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}
  })
    .composite([
      {input:reliefAlpha,left,top,blend:'over'},
      {input:frame,blend:'over'}
    ])
    .png()
    .toBuffer();
}
