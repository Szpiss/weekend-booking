const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const selection=require('../assets/plan-selection.js');
const scope={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../assets/catalog.js'),'utf8'),scope);
const plans=JSON.parse(JSON.stringify(scope.window.WEEKEND_CATALOG));
const cafe=plans.find(p=>p.id==='cafe'),sunset=plans.find(p=>p.id==='sunset');
test('all eight choices serialize complete title snapshots without unrelated fields',()=>{
 const snapshots=selection.snapshots(plans);assert.equal(snapshots.length,8);
 for(let i=0;i<8;i++)assert.deepEqual(snapshots[i],{id:plans[i].id,title:plans[i].title});
});
test('duplicate selections are collapsed and invalid shapes are ignored',()=>{
 assert.deepEqual(selection.snapshots([cafe,cafe,null,{id:'../x',title:'X'},{id:'p',title:'  '}]),[{id:cafe.id,title:cafe.title}]);
});
test('new record retains every selected inspiration for display and filtering',()=>{
 const record={plan_id:'cafe',plan_title:cafe.title,selected_plans:selection.snapshots([cafe,sunset])};
 assert.equal(selection.recordPlans(record).length,2);assert.equal(selection.title(record),cafe.title+'、'+sunset.title);
 assert.equal(selection.hasPlan(record,'sunset'),true);assert.equal(selection.hasPlan(record,'custom'),false);
});
test('old single-plan records work with a missing or defaulted new column',()=>{
 for(const selected_plans of [undefined,[]]){
  const row={plan_id:'cafe',plan_title:'旧标题快照',selected_plans};
  assert.equal(selection.title(row),'旧标题快照');assert.equal(selection.hasPlan(row,'cafe'),true);
 }
});
test('historical titles remain independent of later catalogue changes',()=>{
 assert.equal(selection.title({selected_plans:[{id:'retired-plan',title:'已归档灵感标题'}]}),'已归档灵感标题');
});
test('custom outings remain custom with no fabricated selections',()=>{
 const row={plan_id:'custom',plan_title:'自定义出游',selected_plans:[]};
 assert.deepEqual(selection.recordPlans(row),[]);assert.equal(selection.hasPlan(row,'custom'),true);
});
test('a single plan provides its own suggestions',()=>{
 const defaults=selection.defaults([cafe]);assert.equal(defaults.destination,cafe.destination);assert.equal(defaults.time_slot,cafe.slot);assert.equal(defaults.mood,cafe.mood);
});
test('mixed plans leave conflicting time, budget and pace open for discussion',()=>{
 const defaults=selection.defaults([cafe,sunset]);
 assert.equal(defaults.time_slot,'discuss');assert.equal(defaults.budget_preference,'undecided');assert.equal(defaults.mood,'都可以');
 assert.ok(defaults.destination.includes(cafe.title)&&defaults.destination.includes(sunset.title));
});
test('selecting eight never exceeds the existing destination limit',()=>{
 assert.ok(selection.defaults(plans).destination.length<=100);
 assert.ok(selection.defaults(plans.map(p=>({...p,title:'字'.repeat(80)}))).destination.length<=100);
});
test('clearing selections produces empty/default suggestions',()=>{
 assert.deepEqual(selection.defaults([]),{destination:'',time_slot:'discuss',budget_preference:'undecided',mood:'随性漫游'});
});
