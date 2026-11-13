(() => {
  'use strict';
  const config = window.SITE_CONFIG || {};
  const form = document.getElementById('booking-form');
  const button = document.getElementById('submit-btn');
  const feedback = document.getElementById('form-feedback');
  const success = document.getElementById('success-panel');
  let submitting = false;
  let attempt = null;
  document.getElementById('year').textContent = new Date().getFullYear();
  // Match the database's booking calendar, even when a visitor is abroad.
  const chinaDate = date => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Shanghai'}).format(date);
  const today = chinaDate(new Date());
  const lastDay = chinaDate(new Date(Date.now() + 365 * 86400000));
  form.elements.outing_date.min = today;
  form.elements.outing_date.max = lastDay;
  if (!config.supabaseUrl || !config.supabasePublishableKey || !window.supabase) {
    document.getElementById('config-alert').hidden = false;
    button.disabled = true;
    return;
  }
  const db = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {persistSession:false, autoRefreshToken:false, detectSessionInUrl:false}
  });
  function setFeedback(message, error = false) {
    feedback.textContent = message;
    feedback.className = 'form-feedback ' + (error ? 'is-error' : 'is-success');
  }
  function finish(duplicate) {
    form.hidden = true;
    success.querySelector('h3').textContent = duplicate ? '这份行程已收到' : '预约已送达！';
    success.querySelector('p').textContent = duplicate
      ? '相同的联系方式、目的地、日期和时间段已有预约，请勿重复提交。如需调整，请联系发起人。'
      : '你的出游心愿已保存到数据库，发起人会通过填写的联系方式与你沟通。';
    success.hidden = false;
    success.scrollIntoView({behavior:'smooth',block:'center'});
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    setFeedback('');
    for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
    if (!form.checkValidity()) {
      const invalid = form.querySelector(':invalid');
      invalid?.setAttribute('aria-invalid','true');
      setFeedback('请检查必填项，并勾选信息使用说明。',true);
      form.reportValidity();
      return;
    }
    const data = new FormData(form);
    if (String(data.get('website') || '').trim()) return setFeedback('提交未通过校验，请刷新后手动填写。',true);
    const payload = {
      nickname:String(data.get('nickname') || '').trim(),
      contact_method:String(data.get('contact_method')),
      contact:String(data.get('contact') || '').trim(),
      destination:String(data.get('destination') || '').trim(),
      outing_date:String(data.get('outing_date') || ''),
      time_slot:String(data.get('time_slot') || ''),
      guest_count:Number(data.get('guest_count')),
      mood:String(data.get('mood') || '随性漫游'),
      message:String(data.get('message') || '').trim(),
      consent:data.get('consent') === 'on',
      website:''
    };
    if (!payload.nickname || !payload.contact || !payload.destination) return setFeedback('昵称、联系方式和目的地不能只填写空格。',true);
    if (payload.outing_date < chinaDate(new Date()) || payload.outing_date > lastDay) return setFeedback('请选择今天起一年内的预约日期。',true);
    if (payload.contact_method === 'phone' && !/^\+?[0-9 -]{6,20}$/.test(payload.contact)) return setFeedback('请检查手机号格式，可包含国家区号、空格或短横线。',true);
    const signature = JSON.stringify(payload);
    if (!attempt || attempt.signature !== signature) attempt = {signature,id:crypto.randomUUID()};
    payload.request_id = attempt.id;
    submitting = true;
    button.disabled = true;
    button.textContent = '正在发送…';
    form.setAttribute('aria-busy','true');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(),20000);
    try {
      // Minimal return is intentional: visitors must never SELECT booking rows.
      const {error} = await db.from('outing_reservations').insert(payload).abortSignal(controller.signal);
      if (error?.code === '23505') return finish(true);
      if (error) throw error;
      finish(false);
    } catch (error) {
      if (error.message?.includes('RATE_LIMITED')) setFeedback('提交太频繁，同一联系方式每小时最多 3 份，请稍后再试。',true);
      else if (error.code === '23514') setFeedback('资料未通过校验，请检查日期、联系方式和字数。',true);
      else setFeedback('暂时无法确认提交结果，请检查网络后重试。重复重试不会生成相同预约。',true);
    } finally {
      clearTimeout(timeout);
      submitting = false;
      button.disabled = false;
      button.innerHTML = '发送我的出游邀请 <span aria-hidden="true">↗</span>';
      form.removeAttribute('aria-busy');
    }
  });
  document.getElementById('another-booking').addEventListener('click', () => {
    form.reset(); attempt = null;
    form.hidden = false; success.hidden = true;
    setFeedback('');
    form.scrollIntoView({behavior:'smooth',block:'start'});
  });
})();
