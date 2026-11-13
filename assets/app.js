(() => {
  'use strict';
  const plans = window.WEEKEND_CATALOG || [];
  const labels = window.WEEKEND_LABELS;
  const $ = id => document.getElementById(id);
  const form = $('booking-form');
  const button = $('submit-btn');
  const feedback = $('form-feedback');
  const dialog = $('trip-dialog');
  const companyNames = {discuss:'都可以，先商量',together:'我们两个人',friends:'想带朋友一起'};
  const responseNames = {interested:'愿意一起出门，安排再确认',discuss:'先聊聊，再决定'};
  let category = 'all', selectedPlan = null, step = 0, submitting = false, attempt = null, submitted = null, toastTimer;
  let favorites = new Set();
  try { favorites = new Set(JSON.parse(localStorage.getItem('weekend-inspiration-favorites') || '[]').filter(id => plans.some(p => p.id === id))); } catch { /* Private mode/storage restrictions must not block the invitation. */ }
  const cfg = window.SITE_CONFIG || {};
  const db = cfg.supabaseUrl && cfg.supabasePublishableKey && window.supabase
    ? window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}) : null;
  $('config-alert').hidden = Boolean(db);
  $('year').textContent = new Date().getFullYear();
  const chinaDate = date => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(date);
  const today = chinaDate(new Date());
  const lastDay = chinaDate(new Date(Date.now()+365*86400000));
  form.elements.outing_date.min = today; form.elements.outing_date.max = lastDay;
  function el(tag,cls,text) { const node=document.createElement(tag); if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node; }
  function toast(text) { clearTimeout(toastTimer);$('club-toast').textContent=text;$('club-toast').hidden=false;toastTimer=setTimeout(()=>$('club-toast').hidden=true,2600); }
  function setFeedback(message,error=false) { feedback.textContent=message;feedback.className='form-feedback '+(error?'is-error':'is-success'); }
  function saveFavorites() { try {localStorage.setItem('weekend-inspiration-favorites',JSON.stringify([...favorites]));}catch{} $('saved-count').textContent=favorites.size; }
  function matchingPlans() {return plans.filter(p=>(category==='all'||(category==='saved'?favorites.has(p.id):p.category===category))&&($('duration-filter').value==='any'||$('duration-filter').value===p.duration)&&($('budget-filter').value==='any'||$('budget-filter').value===p.budget));}
  function renderPlans() {
    const filtered=matchingPlans();$('plan-grid').replaceChildren();$('plan-empty').hidden=filtered.length>0;
    $('plan-count').textContent=filtered.length+' 个小计划';
    for(const p of filtered){
      const card=el('article','plan-card');
      const art=el('div','plan-art');const open=el('button');open.type='button';open.setAttribute('aria-label','查看'+p.title+'的参考安排');
      const image=el('img');image.src='assets/illustrations/'+p.art+'.svg';image.alt=p.title+'主题插画';image.width=600;image.height=400;image.loading='lazy';open.append(image);open.addEventListener('click',()=>openPlan(p));
      const badge=el('span','plan-badge',p.tag);
      const heart=el('button','heart-button',favorites.has(p.id)?'♥':'♡');heart.type='button';heart.setAttribute('aria-label',(favorites.has(p.id)?'取消收藏：':'收藏：')+p.title);heart.setAttribute('aria-pressed',String(favorites.has(p.id)));
      heart.addEventListener('click',()=>{const saving=!favorites.has(p.id);saving?favorites.add(p.id):favorites.delete(p.id);saveFavorites();renderPlans();toast(saving?'放进口袋啦，只有你自己能看到。':'已经从心愿口袋取出。');});art.append(open,badge,heart);
      const body=el('div','plan-body'),meta=el('div','plan-meta');meta.append(el('span','',p.categoryName),el('i'),el('span','',p.durationText));
      const bottom=el('div','plan-bottom'),cost=el('span','plan-cost','参考 ');cost.append(el('b','','¥'+p.cost),document.createTextNode(' / 人'));
      const details=el('button','plan-detail-link','看看小计划 ↗');details.type='button';details.addEventListener('click',()=>openPlan(p));bottom.append(cost,details);
      body.append(meta,el('h3','',p.title),el('p','',p.subtitle),bottom);card.append(art,body);$('plan-grid').append(card);
    }
    for(const chip of document.querySelectorAll('[data-category]')){const active=chip.dataset.category===category;chip.classList.toggle('active',active);chip.setAttribute('aria-pressed',String(active));}
  }
  function closeDialog(){dialog.close();}
  function openPlan(plan){
    const content=$('trip-dialog-content');content.replaceChildren();
    const header=el('div','trip-detail-header'),image=el('img','trip-detail-art');image.src='assets/illustrations/'+plan.art+'.svg';image.width=600;image.height=400;image.alt=plan.title+'主题插画';
    const copy=el('div','trip-detail-copy');copy.append(el('p','section-kicker','A LITTLE IDEA / '+plan.categoryName));const title=el('h2','',plan.title);title.id='trip-dialog-title';copy.append(title,el('p','',plan.intro));
    const tags=el('div','detail-tags');[plan.durationText,'参考 ¥'+plan.cost+' / 人',plan.tag].forEach(t=>tags.append(el('span','',t)));copy.append(tags);header.append(image,copy);
    const body=el('div','detail-body');body.append(el('h3','','一个可以参考的小安排'));
    const route=el('ol','route-timeline');for(const [time,title,description] of plan.route){const li=el('li');li.append(el('time','',time),el('h4','',title),el('p','',description));route.append(li);}body.append(route,el('h3','','带上这些，就差不多啦'));
    const packing=el('div','packing-row');plan.packing.forEach(t=>packing.append(el('span','','✓ '+t)));body.append(packing);
    const weather=el('div','detail-weather');weather.append(el('strong','','☁ 如果天气换了心情'),el('p','',plan.rain));body.append(weather);
    const footer=el('div','detail-footer');footer.append(el('p','','参考灵感，并非已确定的活动。具体地点、营业和费用会再沟通；时间也可以按你的节奏调整。'));
    const choose=el('button','pill-button','这个想法不错，带入心愿单 ↗');choose.type='button';choose.addEventListener('click',()=>{choosePlan(plan);closeDialog();$('book').scrollIntoView({behavior:'smooth',block:'start'});});footer.append(choose);body.append(footer);content.append(header,body);
    if(!dialog.open)dialog.showModal();document.body.classList.add('dialog-open');
  }
  function choosePlan(plan){
    selectedPlan=plan;form.elements.destination.value=plan.destination;form.elements.time_slot.value=plan.slot;form.elements.budget_preference.value=plan.budget;
    const mood=[...form.querySelectorAll('input[name=mood]')].find(e=>e.value===plan.mood);if(mood)mood.checked=true;
    $('chosen-title').textContent=plan.title;$('clear-plan').hidden=false;
    $('success-panel').hidden=true;form.hidden=false;attempt=null;showStep(0,false);toast('已带入心愿单，你还可以改成更喜欢的安排。');
  }
  function clearPlan(){selectedPlan=null;$('chosen-title').textContent='我有自己的出游想法';$('clear-plan').hidden=true;}
  function filterCategory(value){category=value;renderPlans();}
  document.querySelectorAll('[data-category]').forEach(chip=>chip.addEventListener('click',()=>filterCategory(chip.dataset.category)));
  for(const id of ['duration-filter','budget-filter'])$(id).addEventListener('change',renderPlans);
  $('reset-filters').addEventListener('click',()=>{category='all';$('duration-filter').value='any';$('budget-filter').value='any';renderPlans();});
  $('show-saved').addEventListener('click',()=>{category='saved';$('duration-filter').value='any';$('budget-filter').value='any';renderPlans();$('inspiration').scrollIntoView({behavior:'smooth'});});
  $('surprise-me').addEventListener('click',()=>{const candidates=matchingPlans();if(!candidates.length)return toast('这些条件下还没有小计划，先试试其他选项吧。');openPlan(candidates[Math.floor(Math.random()*candidates.length)]);});
  $('close-trip-dialog').addEventListener('click',closeDialog);
  dialog.addEventListener('close',()=>document.body.classList.remove('dialog-open'));
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog();}});
  $('clear-plan').addEventListener('click',()=>{clearPlan();toast('可以直接写下你自己的想法。');});
  $('not-now').addEventListener('click',()=>{$('no-pressure-feedback').hidden=false;$('not-now').textContent='好好休息，周末愉快 ☀';});
  $('talk-first').addEventListener('click',()=>{
    clearPlan();form.hidden=false;$('success-panel').hidden=true;form.elements.destination.value='还没想好，想先聊聊';form.elements.outing_date.value='';form.elements.time_slot.value='discuss';
    form.querySelector('input[name=invitation_response][value=discuss]').checked=true;showStep(0,false);$('book').scrollIntoView({behavior:'smooth'});toast('好呀，先说一点想法，不急着决定。');
  });
  function quickDates(){const base=new Date(today+'T00:00:00Z'),day=base.getUTCDay(),saturday=new Date(base);saturday.setUTCDate(base.getUTCDate()+(6-day+7)%7);const sunday=new Date(base);sunday.setUTCDate(base.getUTCDate()+(7-day)%7);const next=new Date(saturday);next.setUTCDate(saturday.getUTCDate()+7);return {saturday:saturday.toISOString().slice(0,10),sunday:sunday.toISOString().slice(0,10),next:next.toISOString().slice(0,10),discuss:''};}
  const dates=quickDates();
  document.querySelectorAll('[data-date]').forEach(btn=>{if(btn.dataset.date!=='discuss')btn.title=dates[btn.dataset.date];btn.addEventListener('click',()=>{form.elements.outing_date.value=dates[btn.dataset.date];updateDateChips();});});
  function updateDateChips(){document.querySelectorAll('[data-date]').forEach(b=>b.classList.toggle('active',form.elements.outing_date.value===dates[b.dataset.date]));}
  form.elements.outing_date.addEventListener('change',updateDateChips);
  form.elements.company_preference.addEventListener('change',()=>{if(form.elements.company_preference.value==='friends'&&Number(form.elements.guest_count.value)<3)form.elements.guest_count.value='3';else if(form.elements.company_preference.value==='together')form.elements.guest_count.value='2';});
  form.elements.message.addEventListener('input',()=>{$('message-count').textContent=form.elements.message.value.length+' / 500';});
  function payload(){const d=new FormData(form);return {
    nickname:String(d.get('nickname')||'').trim(),contact_method:String(d.get('contact_method')),contact:String(d.get('contact')||'').trim(),
    destination:String(d.get('destination')||'').trim(),outing_date:String(d.get('outing_date')||'')||null,time_slot:String(d.get('time_slot')||'discuss'),
    guest_count:Number(d.get('guest_count')),mood:String(d.get('mood')||'随性漫游'),message:String(d.get('message')||'').trim(),consent:d.get('consent')==='on',website:String(d.get('website')||''),
    plan_id:selectedPlan?.id||'custom',plan_title:selectedPlan?.title||'自定义出游',budget_preference:String(d.get('budget_preference')),transport:String(d.get('transport')),
    company_preference:String(d.get('company_preference')),invitation_response:String(d.get('invitation_response'))
  };}
  function validatePanel(index){
    const panel=form.querySelector('[data-step="'+index+'"]');for(const field of panel.querySelectorAll('input,select,textarea')){field.removeAttribute('aria-invalid');if(!field.checkValidity()){field.setAttribute('aria-invalid','true');setFeedback('还有一小处没填好，检查一下就可以继续啦。',true);if(index===step)field.reportValidity();return false;}}
    const p=payload();
    if(index===0){if(!p.destination)return setFeedback('可以写一个想去的地方，或者直接写「先聊聊」。',true),false;if(p.outing_date&&(p.outing_date<chinaDate(new Date())||p.outing_date>lastDay))return setFeedback('请选择今天起一年内的日期，也可以先留空。',true),false;}
    if(index===1){if(!p.nickname||!p.contact)return setFeedback('称呼和联系方式不能只填空格哦。',true),false;if(p.contact_method==='phone'&&!/^\+?[0-9 -]{6,20}$/.test(p.contact))return setFeedback('手机号格式似乎不太对，再检查一下吧。',true),false;if(p.website.trim())return setFeedback('提交未通过校验，请刷新后手动填写。',true),false;}
    return true;
  }
  function review(){const p=payload();const items=[['灵感方案',p.plan_title],['想去 / 想做',p.destination],['方便的时间',(p.outing_date||'日期再商量')+' · '+labels.slots[p.time_slot]],['预算偏好',labels.budgets[p.budget_preference]],['交通方式',labels.transport[p.transport]],['相处方式',companyNames[p.company_preference]+' · '+p.guest_count+' 人'],['怎么称呼你',p.nickname],['联系方式',({wechat:'微信',phone:'手机',other:'其他'})[p.contact_method]+'：'+p.contact],['出游节奏',p.mood],['现在的想法',responseNames[p.invitation_response]],['想说的话',p.message||'暂时没有其他想补充的']];const list=$('review-summary');list.replaceChildren();items.forEach(([k,v])=>list.append(el('dt','',k),el('dd','',v)));}
  function showStep(value,scroll=true){
    step=value;setFeedback('');form.querySelectorAll('[data-step]').forEach(p=>p.hidden=Number(p.dataset.step)!==step);
    document.querySelectorAll('.wizard-steps li').forEach((li,i)=>{if(i===step)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');li.classList.toggle('completed',i<step);});
    $('previous-step').hidden=step===0;button.disabled=submitting||(!db&&step===2);button.textContent=step===0?'下一步：说两句话 →':step===1?'下一步：确认一下 →':'悄悄送出我的想法 ↗';if(step===2)review();
    if(scroll)document.querySelector('.booking-wizard').scrollIntoView({behavior:'smooth',block:'start'});
  }
  $('previous-step').addEventListener('click',()=>{if(!submitting)showStep(Math.max(0,step-1));});
  document.querySelectorAll('[data-edit-step]').forEach(b=>b.addEventListener('click',()=>{if(!submitting)showStep(Number(b.dataset.editStep));}));
  function finish(p,duplicate){
    submitted=duplicate?null:p;form.hidden=true;$('success-panel').hidden=false;
    $('success-title').textContent=duplicate?'这份小想法，已经收到啦。':p.invitation_response==='discuss'?'好呀，我们先慢慢聊。':'你的想法，已悄悄送达。';
    $('success-description').textContent=duplicate?'相同联系方式和行程已有记录，不用重复发送。如需调整，可以直接联系发起人。':'接下来会先与你确认安排。提交并不代表必须赴约，你仍然可以调整想法。';
    $('receipt-plan').textContent=p.destination;$('receipt-date').textContent=(p.outing_date||'日期再商量')+' · '+labels.slots[p.time_slot];$('receipt-reference').textContent=duplicate?'相同行程已记录':'提交参考号：WK-'+p.request_id.slice(0,8).toUpperCase();
    $('calendar-download').hidden=duplicate||!p.outing_date||p.time_slot==='discuss';$('success-panel').focus({preventScroll:true});$('success-panel').scrollIntoView({behavior:'smooth',block:'center'});
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(submitting)return;
    if(step<2){if(validatePanel(step))showStep(step+1);return;}
    for(const index of [0,1]){if(!validatePanel(index)){const message=feedback.textContent;showStep(index);setFeedback(message,true);return;}}
    if(!db)return setFeedback('暂时连接不上预约服务，稍后再试试吧。',true);
    const p=payload(),signature=JSON.stringify(p);if(!attempt||attempt.signature!==signature)attempt={signature,id:crypto.randomUUID()};p.request_id=attempt.id;
    submitting=true;button.disabled=true;$('previous-step').disabled=true;button.textContent='正在悄悄送出…';form.setAttribute('aria-busy','true');setFeedback('');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    try{const {error}=await db.from('outing_reservations').insert(p).abortSignal(controller.signal);if(error?.code==='23505')return finish(p,true);if(error)throw error;finish(p,false);}
    catch(error){if(error.message?.includes('RATE_LIMITED'))setFeedback('发送得有点频繁，同一联系方式每小时最多 3 份。先歇一会儿吧。',true);else if(error.code==='23514')setFeedback('有一项内容未通过校验，请检查日期、联系方式和字数。',true);else setFeedback('暂时无法确认发送结果，请检查网络后再试。同一份内容重试不会重复保存。',true);}
    finally{clearTimeout(timeout);submitting=false;button.disabled=false;$('previous-step').disabled=false;button.textContent='悄悄送出我的想法 ↗';form.removeAttribute('aria-busy');}
  });
  $('another-booking').addEventListener('click',()=>{form.reset();clearPlan();attempt=null;submitted=null;form.hidden=false;$('success-panel').hidden=true;$('message-count').textContent='0 / 500';updateDateChips();showStep(0);});
  function icsEscape(s){return String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');}
  $('calendar-download').addEventListener('click',()=>{
    if(!submitted?.outing_date||submitted.time_slot==='discuss')return;const p=submitted,lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Weekend Booking//Private Invitation//ZH','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+p.request_id+'@weekend-booking','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')];
    if(p.time_slot==='all_day'){const start=p.outing_date.replace(/-/g,''),end=new Date(p.outing_date+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+1);lines.push('DTSTART;VALUE=DATE:'+start,'DTEND;VALUE=DATE:'+end.toISOString().slice(0,10).replace(/-/g,''));}
    else{const hours={morning:[8,12],afternoon:[12,18],evening:[18,22]}[p.time_slot];for(let i=0;i<2;i++){const date=new Date(p.outing_date+'T'+String(hours[i]).padStart(2,'0')+':00:00+08:00');lines.push((i===0?'DTSTART:':'DTEND:')+date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''));}}
    lines.push('SUMMARY:'+icsEscape('待确认 · '+p.destination),'DESCRIPTION:'+icsEscape('这是一份待双方确认的出游意向。具体时间地点请先沟通，随时可以调整。'),'STATUS:TENTATIVE','TRANSP:TRANSPARENT','END:VEVENT','END:VCALENDAR');
    // RFC 5545 folding at a UTF-8-safe boundary (maximum 75 octets per line).
    const folded=lines.map(line=>{let result='',length=0;for(const c of line){const bytes=new TextEncoder().encode(c).length;if(length+bytes>74){result+='\r\n ';length=1;}result+=c;length+=bytes;}return result;}).join('\r\n')+'\r\n';
    const url=URL.createObjectURL(new Blob([folded],{type:'text/calendar;charset=utf-8'})),a=el('a');a.href=url;a.download='周末小计划_待确认.ics';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{for(const entry of entries)$('mobile-bookbar').hidden=entry.isIntersecting;},{threshold:0});observer.observe($('book'));}
  // Invitation content lives only in the URL fragment and page memory, never in storage or a tracking API.
  function readPersonalInvite() {
    if(!location.hash.startsWith('#invite='))return;
    try {
      const encoded=location.hash.slice(8).replace(/-/g,'+').replace(/_/g,'/');
      if(encoded.length>2000)return;
      const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
      const data=JSON.parse(new TextDecoder().decode(bytes));
      const safe=value=>typeof value==='string'?value.trim():'';
      const sender=safe(data.sender).slice(0,20),recipient=safe(data.recipient).slice(0,20),message=safe(data.message).slice(0,120);
      if(!sender||!recipient)return;
      document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{
        const target=document.getElementById(link.getAttribute('href').slice(1));if(target){event.preventDefault();target.scrollIntoView({behavior:'smooth'});}
      }));
      $('personal-greeting').textContent='给 '+recipient+' 的一个小小邀请 · FROM '+sender;$('personal-greeting').hidden=false;
      if(message)$('invitation-message').textContent=message;
      const suggestion=plans.find(p=>p.id===data.plan);
      if(suggestion){const button=$('personal-suggestion');button.textContent=sender+' 先想到：'+suggestion.title+' ↗';button.hidden=false;button.addEventListener('click',()=>openPlan(suggestion));}
    } catch { /* An edited or invalid invitation never prevents access to the public page. */ }
  }
  readPersonalInvite();
  saveFavorites();renderPlans();showStep(0,false);
})();
