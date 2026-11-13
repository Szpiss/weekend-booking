/* Shared selection snapshots for the booking form, administrator table and CSV. */
(() => {
  const MAX_PLANS=8;
  function snapshots(values) {
    if(!Array.isArray(values))return [];
    const result=[],seen=new Set();
    for(const value of values){
      if(!value || typeof value!=='object' || typeof value.id!=='string' || typeof value.title!=='string')continue;
      const title=value.title.trim();
      if(!/^[a-z][a-z0-9-]{0,39}$/.test(value.id)||!title||title.length>80||seen.has(value.id))continue;
      result.push({id:value.id,title});seen.add(value.id);if(result.length===MAX_PLANS)break;
    }
    return result;
  }
  function recordPlans(record) {
    const selected=snapshots(record?.selected_plans);
    if(selected.length)return selected;
    if(record?.plan_id && record.plan_id!=='custom')return snapshots([{id:record.plan_id,title:record.plan_title}]);
    return [];
  }
  function title(record) {const selected=recordPlans(record);return selected.length?selected.map(p=>p.title).join('、'):(record?.plan_title || '自定义出游');}
  function hasPlan(record,id) {const selected=recordPlans(record);return id==='custom'?selected.length===0:selected.some(p=>p.id===id);}
  function defaults(selected) {
    const same=key=>selected.every(p=>p[key]===selected[0]?.[key]);
    let destination=selected.length===1?selected[0].destination:selected.map(p=>p.title).join(' + ');
    if(destination.length>100)destination=`喜欢的 ${selected.length} 个灵感，具体地点一起商量`;
    return {destination,time_slot:selected.length&&same('slot')?selected[0].slot:'discuss',budget_preference:selected.length&&same('budget')?selected[0].budget:'undecided',mood:selected.length?(same('mood')?selected[0].mood:'都可以'):'随性漫游'};
  }
  const api={MAX_PLANS,snapshots,recordPlans,title,hasPlan,defaults};
  if(typeof window!=='undefined')window.WeekendPlanSelection=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
