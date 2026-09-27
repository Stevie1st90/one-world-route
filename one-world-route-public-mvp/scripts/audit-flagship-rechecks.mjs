import {readFile} from 'node:fs/promises';
import {evaluateFlagshipRechecks} from './flagship-recheck-model.mjs';

const plan=JSON.parse(await readFile(new URL('../data/flagship-recheck-plan.json',import.meta.url),'utf8'));
const dateArg=process.argv.find(arg=>arg.startsWith('--date='));
const asOf=dateArg?dateArg.slice('--date='.length):new Date().toISOString().slice(0,10);
const report=evaluateFlagshipRechecks(plan,{asOf});

if(process.argv.includes('--markdown')){
  console.log('# Flagship recheck watch');
  console.log('');
  console.log('- Check date: **'+report.asOf+'**');
  console.log('- Due: **'+report.summary.due+'**');
  console.log('- Overdue: **'+report.summary.overdue+'**');
  console.log('- Upcoming within 7 days: **'+report.summary.upcoming+'**');
  console.log('- Condition-watch only: **'+report.summary.conditionWatchOnly+'**');
  if(report.due.length){
    console.log('');
    console.log('| Task | Decision | Milestone | Due | Target |');
    console.log('| --- | --- | --- | --- | --- |');
    for(const row of report.due)console.log('| '+row.taskId+' · '+row.title+' | '+row.decision.toUpperCase()+' | '+row.milestone+' | '+row.dueOn+' | '+(row.targetDate||'—')+' |');
  }
}else{
  console.log(JSON.stringify(report,null,2));
}

if(process.argv.includes('--strict')&&report.summary.requiresAction>0){
  console.error('FLAGSHIP RECHECK WATCH: '+report.summary.requiresAction+' scheduled recheck milestone(s) require action.');
  process.exitCode=1;
}
