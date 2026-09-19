import {readFile} from 'node:fs/promises';
const data=JSON.parse(await readFile(new URL('../data/public-route.json',import.meta.url),'utf8'));
const excelDate=v=>{const n=Number(v);return Number.isFinite(n)&&n>0?new Date(Date.UTC(1899,11,30)+n*86400000):null};
const today=new Date();today.setUTCHours(0,0,0,0);
const rows=(data.segments||[]).map(s=>{const d=excelDate(s.lastVerified);const age=d?Math.max(0,Math.round((today-d)/86400000)):null;const state=age===null?'unknown':age<=7?'fresh':age<=30?'watch':'stale';return{id:Number(s.id),route:(s.from||'?')+' → '+(s.to||'?'),ageDays:age,state}});
const summary={fresh:0,watch:0,stale:0,unknown:0};rows.forEach(r=>summary[r.state]++);
console.log(JSON.stringify({checkedAt:today.toISOString().slice(0,10),summary,needsReview:rows.filter(r=>r.state==='stale'||r.state==='unknown')},null,2));