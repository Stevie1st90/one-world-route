import {readFile} from 'node:fs/promises';

const plan=JSON.parse(await readFile(new URL('../data/flagship-recheck-plan.json',import.meta.url),'utf8'));
const arg=process.argv.find(value=>value.startsWith('--as-of='));
const asOf=arg?arg.slice('--as-of='.length):new Date().toISOString().slice(0,10);

if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf)){
  console.error('FLAGSHIP RECHECK AUDIT: --as-of must be YYYY-MM-DD');
  process.exit(1);
}

const checkpointRows=plan.items.flatMap(item=>[
  {item,checkpoint:'T-7d',date:item.schedule?.tMinus7?.date||null},
  {item,checkpoint:'T-48h',date:item.schedule?.tMinus48h?.date||null},
]).filter(row=>row.date);

const stateFor=row=>{
  if(row.item.reviewedAt&&row.item.reviewedAt>=row.date)return 'satisfied';
  if(asOf>=row.date)return 'due';
  return 'scheduled';
};

const due=checkpointRows
  .filter(row=>stateFor(row)==='due')
  .sort((a,b)=>a.date.localeCompare(b.date)||a.item.id.localeCompare(b.item.id));
const next=checkpointRows
  .filter(row=>stateFor(row)==='scheduled')
  .sort((a,b)=>a.date.localeCompare(b.date)||a.item.id.localeCompare(b.item.id))
  .slice(0,12)
  .map(row=>({
    date:row.date,
    checkpoint:row.checkpoint,
    id:row.item.id,
    decision:row.item.currentDecision,
    title:row.item.title,
  }));
const eventDrivenOnly=plan.items
  .filter(item=>!item.travelDate)
  .map(item=>({
    id:item.id,
    decision:item.currentDecision,
    title:item.title,
    triggerOn:item.triggerOn,
  }));

const report={
  asOf,
  planDataAsOf:plan.dataAsOf,
  dueCount:new Set(due.map(row=>row.item.id)).size,
  due:due.map(row=>({
    date:row.date,
    checkpoint:row.checkpoint,
    id:row.item.id,
    decision:row.item.currentDecision,
    title:row.item.title,
  })),
  next,
  eventDrivenOnly,
};

console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--strict-due')&&report.dueCount>0)process.exitCode=1;
