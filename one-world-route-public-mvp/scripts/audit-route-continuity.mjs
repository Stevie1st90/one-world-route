import {readFile} from 'node:fs/promises';
const route=JSON.parse(await readFile(new URL('../data/public-route.json',import.meta.url),'utf8'));
const waypoints=JSON.parse(await readFile(new URL('../data/route-waypoints.json',import.meta.url),'utf8'));
const centroids=JSON.parse(await readFile(new URL('../data/country-centroids.json',import.meta.url),'utf8'));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const cm=new Map(centroids.map(c=>[norm(c.name),c]));
const end=(seg,last)=>{const w=waypoints[String(seg.id)];if(Array.isArray(w)&&w.length>=2)return last?w[w.length-1]:w[0];const c=cm.get(norm(last?seg.to:seg.from));return c?[Number(c.lng),Number(c.lat)]:null};
const km=(a,b)=>{if(!a||!b)return null;const r=Math.PI/180,R=6371,la1=a[1]*r,la2=b[1]*r,dla=(b[1]-a[1])*r,dlo=(b[0]-a[0])*r;const h=Math.sin(dla/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dlo/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
const gaps=[];for(let i=0;i<route.segments.length-1;i++){const a=route.segments[i],b=route.segments[i+1];if(norm(a.to)!==norm(b.from))continue;const d=km(end(a,true),end(b,false));if(d!==null&&d>3)gaps.push({after:a.id,before:b.id,country:a.to,gapKm:Math.round(d),visualConnector:true})}
console.log(JSON.stringify({officialLegs:route.segments.length,visualTransferConnectors:gaps.length,continuousWithConnectors:true,gaps},null,2));