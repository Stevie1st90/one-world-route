// Authoring-only adapter. No tiles, API keys or network calls in this renderer.
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {RATIOS,cameraFit,project,wrap} from './route-visual-model.mjs';
const require=createRequire(import.meta.url);
const rad=Math.PI/180;
export async function localReliefProvider(sourcePath){
  const sharp=require('sharp');
  const {data,info}=await sharp(sourcePath).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const sample=(lon,lat)=>{
    const fx=(((wrap(lon)+180)/360)*info.width)%info.width,fy=Math.max(0,Math.min(info.height-1,(90-lat)/180*info.height));
    const x=Math.floor(fx),y=Math.floor(fy),dx=fx-x,dy=fy-y;
    const out=[];
    for(let k=0;k<3;k++){
      const pixel=(xx,yy)=>data[(Math.min(info.height-1,yy)*info.width+(xx%info.width))*info.channels+k];
      out.push((pixel(x,y)*(1-dx)+pixel(x+1,y)*dx)*(1-dy)+(pixel(x,y+1)*(1-dx)+pixel(x+1,y+1)*dx)*dy);
    }
    return out;
  };
  const dense=coords=>{
    const points=[];
    for(let i=1;i<coords.length;i++){
      const a=coords[i-1],b=coords[i],dl=wrap(b[0]-a[0]),count=Math.max(1,Math.ceil(Math.max(Math.abs(dl),Math.abs(b[1]-a[1]))/.7));
      for(let j=0;j<count;j++){const t=j/count;points.push([a[0]+dl*t,a[1]+(b[1]-a[1])*t]);}
    }
    return [...points,coords.at(-1)];
  };
  return {
    id:'local-natural-earth',
    async render(route,ratio,target){
      const cam=cameraFit(route,ratio),{width:w,height:h}=cam,global=route.scope==='GLOBAL',pixels=Buffer.alloc(w*h*3);
      const wide=w>h;
      const radius=wide?Math.min(w*.222,h*.35):Math.min(w*.41,h*.13);
      const spheres=wide?[[w*.255,h*.51,route.bounds.west+90],[w*.745,h*.51,route.bounds.west+270]]:[[w*.5,h*.28,route.bounds.west+90],[w*.5,h*.54,route.bounds.west+270]];
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        let rgb;
        if(global){
          let hit=false;
          for(const [cx,cy,lon0] of spheres){
            const xx=(x-cx)/radius,yy=(cy-y)/radius,r2=xx*xx+yy*yy;
            if(r2>1)continue;
            const z=Math.sqrt(1-r2),lat=Math.asin(yy)/rad,lon=lon0+Math.atan2(xx,z)/rad;
            const raw=sample(lon,lat),light=.65+.35*z;
            rgb=raw.map((v,k)=>(v*.86+[15,35,46][k]*.14)*light);hit=true;break;
          }
          if(!hit){const glow=Math.max(...spheres.map(([cx,cy])=>Math.exp(-Math.hypot(x-cx,y-cy)/radius*1.8)));rgb=[8+glow*12,19+glow*25,31+glow*34];}
        }else{
          const lon=cam.centerLng+(x-cam.cx)/(cam.cos*cam.scale),lat=cam.centerLat-(y-cam.cy)/cam.scale;
          const raw=sample(lon,Math.max(-90,Math.min(90,lat)));
          const tint=route.scope==='LOCAL'?.06:route.scope==='CONTINENTAL'?.2:.12;
          rgb=raw.map((v,k)=>v*(1-tint)+[123,164,167][k]*tint);
        }
        const at=(y*w+x)*3;for(let k=0;k<3;k++)pixels[at+k]=Math.round(rgb[k]);
      }
      const paths=[],defs=[];
      const stroke=Math.max(3.6,w/280),fmt=n=>Number(n.toFixed(2));
      const sphereProject=(p,s)=>{
        const [cx,cy,lon0]=s,lat=p[1]*rad,dl=wrap(p[0]-lon0)*rad,z=Math.cos(lat)*Math.cos(dl);
        return z>=-1e-8?[cx+radius*Math.cos(lat)*Math.sin(dl),cy-radius*Math.sin(lat)]:null;
      };
      function draw(coords,line,index){
        if(coords.length<2)return;
        const d=coords.map((p,i)=>(i?'L':'M')+fmt(p[0])+','+fmt(p[1])).join(' '),id='g'+index;
        defs.push('<linearGradient id="'+id+'" gradientUnits="userSpaceOnUse" x1="'+fmt(coords[0][0])+'" y1="'+fmt(coords[0][1])+'" x2="'+fmt(coords.at(-1)[0])+'" y2="'+fmt(coords.at(-1)[1])+'"><stop stop-color="'+line.color+'"/><stop offset="1" stop-color="'+line.endColor+'"/></linearGradient>');
        paths.push('<path d="'+d+'" fill="none" stroke="#102a39" stroke-opacity=".8" stroke-width="'+stroke*2.4+'"/><path d="'+d+'" fill="none" stroke="#edf7f4" stroke-opacity=".85" stroke-width="'+stroke*1.5+'"/><path d="'+d+'" fill="none" stroke="url(#'+id+')" stroke-width="'+stroke+'" '+(line.schematic?'stroke-dasharray="'+stroke*3+' '+stroke*1.5+'"':'')+'/>');
      }
      let pathId=0;
      for(const line of route.lines){
        const coords=dense(line.coordinates);
        if(global){
          for(const sphere of spheres){let visible=[];for(const p of coords){const q=sphereProject(p,sphere);if(q)visible.push(q);else {draw(visible,line,pathId++);visible=[];}}draw(visible,line,pathId++);}
        }else{
          // Split dateline jumps rather than drawing a false line across the map.
          let run=[];for(const p of coords){const q=project(p,route,cam);if(run.length&&Math.abs(q[0]-run.at(-1)[0])>w){draw(run,line,pathId++);run=[];}run.push(q);}draw(run,line,pathId++);
        }
      }
      const unique=[...new Map(route.markers.map(p=>[p.join(','),p])).values()];
      const selected=unique.length>50?unique.filter((_,i)=>i%Math.ceil(unique.length/50)===0||i===unique.length-1):unique;
      for(const p of selected){
        const projected=global?spheres.map(s=>sphereProject(p,s)).filter(Boolean):[project(p,route,cam)];
        for(const q of projected)paths.push('<circle cx="'+fmt(q[0])+'" cy="'+fmt(q[1])+'" r="'+stroke*1.4+'" fill="#f2faf7" stroke="#214452" stroke-width="'+stroke*.65+'"/>');
      }
      const overlay=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'"><defs>'+defs.join('')+'</defs><g stroke-linecap="round" stroke-linejoin="round">'+paths.join('')+'</g></svg>');
      const bytes=await sharp(pixels,{raw:{width:w,height:h,channels:3}}).composite([{input:overlay}]).webp({quality:84,effort:4}).toBuffer();
      await writeFile(target,bytes);
      return {bytes:bytes.length,camera:cam};
    },
    async resize(source,target){return sharp(source).resize(RATIOS.landscape.width/2).webp({quality:82}).toFile(target)}
  };
}
