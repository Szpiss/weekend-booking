(() => {
  const cfg = window.SITE_CONFIG || {};
  const loginSection = document.getElementById('login-section');
  const dashboard = document.getElementById('dashboard');
  const loginForm = document.getElementById('login-form');
  const loginBtn = document.getElementById('login-btn');
  const loginFeedback = document.getElementById('login-feedback');
  const dataFeedback = document.getElementById('dashboard-feedback');
  const logoutBtn = document.getElementById('logout');
  const tbody = document.getElementById('bookings-body');
  const searchInput = document.getElementById('search-input');
  const statusFilter = document.getElementById('status-filter');
  const dateFilter = document.getElementById('date-filter');
  const planFilter = document.getElementById('plan-filter');
  const sortInput = document.getElementById('sort-input');
  const labels = window.WEEKEND_LABELS;
  const selection=window.WeekendPlanSelection;
  const detailDialog = document.getElementById('admin-detail-dialog');
  let detailContact = '';
  const displayDate = value => value || '日期待商量';
  const slotNames = {discuss:'时间段再商量',morning:'上午 08:00–12:00', afternoon:'下午 12:00–18:00', evening:'晚上 18:00–22:00', all_day:'全天'};
  let generation = 0;
  let loading = false;
  let rows = [];
  let activeUser = null;
  document.getElementById('year').textContent = String(new Date().getFullYear());
  const configured = Boolean(cfg.supabaseUrl && cfg.supabasePublishableKey && window.supabase);
  if (!configured) {
    document.getElementById('admin-config-alert').hidden = false;
    loginBtn.disabled = true;
    return;
  }
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: {storage:window.sessionStorage, storageKey:'weekend-admin-auth', detectSessionInUrl:false}
  });
  const statusNames = { pending: '待处理', confirmed: '已确认', cancelled: '已取消' };
  function showFeedback(el, msg, isError) {
    el.textContent = msg;
    el.className = 'form-feedback ' + (isError ? 'is-error' : 'is-success');
  }
  async function checkAdmin() {
    const { data: userData, error: userError } = await db.auth.getUser();
    if (userError || !userData.user) return false;
    const { data, error } = await db.from('site_admins').select('user_id').eq('user_id', userData.user.id).maybeSingle();
    if (error || !data) return false;
    activeUser = userData.user;
    return true;
  }
  async function openDashboard() {
    const ok = await checkAdmin();
    if (!ok) {
      await db.auth.signOut();
      loginSection.hidden = false;
      dashboard.hidden = true;
      logoutBtn.hidden = true;
      showFeedback(loginFeedback, '账号没有管理员权限，请联系站点所有者授权。', true);
      return;
    }
    loginSection.hidden = true;
    dashboard.hidden = false;
    logoutBtn.hidden = false;
    await loadBookings();
  }
  async function loadBookings() {
    if (loading || !activeUser) return;
    loading = true;
    const current = generation;
    document.getElementById('export-btn').disabled = true;
    showFeedback(dataFeedback, '正在同步预约数据…', false);
    try {
      const result = [];
      const PAGE = 500;
      for (let start = 0; ; start += PAGE) {
        const { data, error } = await db.from('outing_reservations').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).range(start, start + PAGE - 1);
        if (error) throw error;
        result.push(...(data || []));
        if (!data || data.length < PAGE) break;
      }
      if (current !== generation || !activeUser) return;
      rows = result;
      const selected = planFilter.value; planFilter.replaceChildren();
      const all = document.createElement('option'); all.value='all'; all.textContent='全部灵感方案'; planFilter.append(all);
      const choices=new Map();
      for(const row of rows){const plans=selection.recordPlans(row);for(const p of plans.length?plans:[{id:'custom',title:'自定义出游'}])if(!choices.has(p.id))choices.set(p.id,p.title);}
      for (const [id,title] of choices) {
        const option=document.createElement('option');option.value=id;option.textContent=title;planFilter.append(option);
      }
      planFilter.value=[...planFilter.options].some(o=>o.value===selected)?selected:'all';
      document.getElementById('stat-all').textContent = rows.length;
      document.getElementById('stat-pending').textContent = rows.filter(x => x.status === 'pending').length;
      document.getElementById('stat-confirmed').textContent = rows.filter(x => x.status === 'confirmed').length;
      document.getElementById('stat-cancelled').textContent = rows.filter(x => x.status === 'cancelled').length;
      showFeedback(dataFeedback, '最近更新：' + new Date().toLocaleString('zh-CN'), false);
      renderRows();
    } catch (error) {
      if (current !== generation) return;
      rows = []; renderRows();
      for (const id of ['stat-all','stat-pending','stat-confirmed','stat-cancelled']) document.getElementById(id).textContent = '—';
      showFeedback(dataFeedback, '数据读取失败，请检查管理员权限、数据库配置或网络连接。', true);
    } finally { loading = false; document.getElementById('export-btn').disabled = !activeUser; }
  }
  function td(text, className) {
    const el = document.createElement('td');
    if (className) el.className = className;
    el.textContent = String(text ?? '');
    return el;
  }
  function filtered() {
    const query = searchInput.value.toLocaleLowerCase().trim();
    return rows.filter(r => (!dateFilter.value || r.outing_date === dateFilter.value) &&
      (statusFilter.value === 'all' || statusFilter.value === r.status) &&
      (planFilter.value === 'all' || selection.hasPlan(r,planFilter.value)) &&
      (!query || [r.nickname,r.contact,r.destination,r.message,selection.title(r),labels.responses[r.invitation_response]].some(v => String(v || '').toLocaleLowerCase().includes(query))))
      .sort((a,b)=>sortInput.value==='outing' ? String(a.outing_date || '9999-12-31').localeCompare(String(b.outing_date || '9999-12-31')) || b.created_at.localeCompare(a.created_at) : b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  }
  function renderRows() {
    const items = filtered();
    document.querySelectorAll('[data-quick-status]').forEach(b=>{const active=b.dataset.quickStatus===statusFilter.value;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    document.getElementById('visible-count').textContent = items.length;
    document.getElementById('empty-state').hidden = items.length !== 0;
    tbody.replaceChildren();
    items.forEach(r => {
      const tr = document.createElement('tr');
      const person = document.createElement('td');
      const name = document.createElement('strong'); name.textContent = r.nickname;
      const contact = document.createElement('small'); contact.textContent = `${({ wechat:'微信', phone:'手机', other:'其他' })[r.contact_method] || '联系方式'}：${r.contact}`;
      person.append(name, contact); tr.append(person);
      const trip = document.createElement('td');
      const plan = document.createElement('strong'); plan.textContent=selection.title(r);
      const destination=document.createElement('small');destination.textContent=r.destination;
      const intention=document.createElement('small');intention.className='intention-tag';intention.textContent=labels.responses[r.invitation_response] || '愿意一起出门';
      trip.append(plan,destination,intention);tr.append(trip);
      const date = document.createElement('td'); date.textContent = `${displayDate(r.outing_date)} · ${slotNames[r.time_slot] || r.time_slot} · ${r.guest_count} 人`; tr.append(date);
      const msg = document.createElement('td');
      const mood = document.createElement('strong'); mood.textContent = r.mood;
      const note = document.createElement('small'); note.className = 'message'; note.textContent = r.message || '无备注';
      msg.append(mood, note); tr.append(msg);
      tr.append(td(new Date(r.created_at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})));
      const state = document.createElement('td');
      const select = document.createElement('select'); select.className = 'status-select'; select.setAttribute('aria-label', `修改 ${r.nickname} 的预约状态`);
      for (const [value, name] of Object.entries(statusNames)) {
        const opt = document.createElement('option'); opt.value = value; opt.textContent = name; select.append(opt);
      }
      select.value = r.status;
      select.addEventListener('change', async () => {
        const previous = r.status;
        select.disabled = true;
        try {
          const current = generation;
          const { data, error } = await db.from('outing_reservations').update({status: select.value}).eq('id', r.id).select('id,status').single();
          if (error || !data) throw error || new Error('No row updated');
          if (current !== generation) return;
          r.status = select.value;
          document.getElementById('stat-pending').textContent = rows.filter(x => x.status === 'pending').length;
          document.getElementById('stat-confirmed').textContent = rows.filter(x => x.status === 'confirmed').length;
          document.getElementById('stat-cancelled').textContent = rows.filter(x => x.status === 'cancelled').length;
          showFeedback(dataFeedback, '状态更新成功。', false);
          if (statusFilter.value !== 'all') renderRows();
        } catch (err) {
          select.value = previous;
          showFeedback(dataFeedback, '状态更新失败，请稍后重试。', true);
        } finally { select.disabled = false; }
      });
      state.append(select); tr.append(state);
      const detail= document.createElement('td'); const detailButton=document.createElement('button');detailButton.type='button';detailButton.className='detail-row-button';detailButton.textContent='查看 ↗';detailButton.setAttribute('aria-label',`查看 ${r.nickname} 的完整预约`);detailButton.addEventListener('click',()=>openDetails(r));detail.append(detailButton);tr.append(detail);
      tbody.append(tr);
    });
  }
  function escapeCsv(value) {
    let v = String(value ?? '');
    // 防止 Excel/表格软件公式注入；导出 CSV 仅在管理员本地生成。
    if (/^[\s]*[=+\-@\t\r]/.test(v)) v = "'" + v;
    return '"' + v.replace(/"/g, '""') + '"';
  }
  function exportCsv() {
    if (!activeUser || loading) return;
    const header = ['预约编号', '提交时间', '昵称', '联系方式类型', '联系方式', '目的地', '预约日期', '预约时间段', '灵感方案', '预算偏好', '交通方式', '相处方式', '当前想法', '人数', '偏好', '留言', '状态'];
    const matrix = [header, ...filtered().map(r => [r.id, r.created_at, r.nickname, r.contact_method, r.contact, r.destination, displayDate(r.outing_date), slotNames[r.time_slot] || r.time_slot, selection.title(r), labels.budgets[r.budget_preference] || '一起商量', labels.transport[r.transport] || '一起商量', labels.company[r.company_preference] || '先商量', labels.responses[r.invitation_response] || '愿意一起出门', r.guest_count, r.mood, r.message, statusNames[r.status] || r.status])];
    const csv = '\ufeff' + matrix.map(line => line.map(escapeCsv).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `出游预约_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!loginForm.reportValidity()) return;
    loginBtn.disabled = true;
    showFeedback(loginFeedback, '正在验证管理员身份…', false);
    const d = new FormData(loginForm);
    try {
      const { error } = await db.auth.signInWithPassword({ email: String(d.get('email')), password: String(d.get('password')) });
      if (error) throw error;
      loginForm.elements.password.value = '';
      await openDashboard();
    } catch (error) {
      clearPrivateData();
      showFeedback(loginFeedback, '登录失败：请核对邮箱、密码及账号权限。', true);
    } finally { loginBtn.disabled = false; }
  });
  function clearPrivateData() {
    generation++; activeUser = null; rows = [];
    tbody.replaceChildren();
    detailContact='';detailDialog.close();document.getElementById('reservation-details').replaceChildren();
    document.getElementById('invite-link-form').reset();document.getElementById('invite-link-output').value='';document.getElementById('invite-link-result').hidden=true;document.getElementById('preview-invite-link').removeAttribute('href');document.getElementById('invite-link-feedback').textContent='';
    for (const id of ['stat-all','stat-pending','stat-confirmed','stat-cancelled','visible-count']) document.getElementById(id).textContent = '0';
    searchInput.value = ''; dateFilter.value = ''; statusFilter.value = 'all'; planFilter.value='all'; sortInput.value='newest';
    dataFeedback.textContent = '';
    document.getElementById('password-form').reset();
    document.getElementById('password-feedback').textContent = '';
    dashboard.hidden = true; loginSection.hidden = false; logoutBtn.hidden = true;
  }
  db.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') clearPrivateData(); });
  logoutBtn.addEventListener('click', async () => {
    clearPrivateData();
    const {error} = await db.auth.signOut({scope:'local'});
    showFeedback(loginFeedback, error ? '本机已清除预约数据，退出请求失败，请关闭此标签页。' : '已退出登录。', Boolean(error));
  });
  document.getElementById('password-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!activeUser) return;
    const form = event.currentTarget;
    const feedback = document.getElementById('password-feedback');
    if (!form.reportValidity()) return;
    const password = form.elements.new_password.value;
    if (password !== form.elements.confirm_password.value) return showFeedback(feedback,'两次密码不一致，请重新输入。',true);
    const button = form.querySelector('button'); button.disabled = true;
    try {
      const {error} = await db.auth.updateUser({password});
      if (error) throw error;
      form.reset(); showFeedback(feedback,'密码已更新。请使用新密码登录。',false);
    } catch (error) { showFeedback(feedback,'更新失败，请稍后重试或重新登录。',true); }
    finally { button.disabled = false; }
  });
  function openDetails(r) {
    detailContact=r.contact;document.getElementById('copy-feedback').textContent='';
    const items=[['提交参考号','WK-'+r.request_id.slice(0,8).toUpperCase()],['昵称',r.nickname],['联系方式',r.contact],['当前想法',labels.responses[r.invitation_response] || '愿意一起出门'],['灵感方案',selection.recordPlans(r).length?selection.recordPlans(r).map((p,i)=>`${i+1}. ${p.title}`).join('\n'):'自定义出游'],['目的地',r.destination],['日期',displayDate(r.outing_date)],['时间段',slotNames[r.time_slot] || r.time_slot],['人数',r.guest_count+' 人'],['相处方式',labels.company[r.company_preference] || '先商量'],['预算偏好',labels.budgets[r.budget_preference] || '一起商量'],['交通方式',labels.transport[r.transport] || '一起商量'],['节奏',r.mood],['留言',r.message || '无备注'],['状态',statusNames[r.status]],['提交时间',new Date(r.created_at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})]];
    const list=document.getElementById('reservation-details');list.replaceChildren();
    for(const [name,value] of items){const dt=document.createElement('dt');dt.textContent=name;const dd=document.createElement('dd');dd.textContent=String(value);list.append(dt,dd);}
    detailDialog.showModal();
  }
  for(const plan of window.WEEKEND_CATALOG || []){const option=document.createElement('option');option.value=plan.id;option.textContent=plan.title;document.getElementById('suggested-plan').append(option);}
  document.getElementById('invite-link-form').addEventListener('submit',event=>{
    event.preventDefault();if(!activeUser)return;
    const form=event.currentTarget;if(!form.reportValidity())return;
    const data=new FormData(form),sender=String(data.get('sender')||'').trim(),recipient=String(data.get('recipient')||'').trim(),message=String(data.get('invitation_message')||'').trim();
    if(!sender||!recipient||!message)return showFeedback(document.getElementById('invite-link-feedback'),'称呼和文案不能只填空格。',true);
    const bytes=new TextEncoder().encode(JSON.stringify({sender,recipient,message,plan:String(data.get('suggested_plan')||'')}));
    const encoded=btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const url=new URL('index.html',location.href);url.hash='invite='+encoded;
    document.getElementById('invite-link-output').value=url.href;document.getElementById('preview-invite-link').href=url.href;document.getElementById('invite-link-result').hidden=false;
    showFeedback(document.getElementById('invite-link-feedback'),'链接已生成。称呼和文案仅放在链接中，不另存数据库。',false);
  });
  document.getElementById('copy-invite-link').addEventListener('click',async()=>{
    try {await navigator.clipboard.writeText(document.getElementById('invite-link-output').value);showFeedback(document.getElementById('invite-link-feedback'),'邀请链接已复制，可以由你亲自发送。',false);}
    catch {showFeedback(document.getElementById('invite-link-feedback'),'无法自动复制，请手动选择上方链接。',true);}
  });
  document.getElementById('close-admin-detail').addEventListener('click',()=>detailDialog.close());
  document.getElementById('copy-contact').addEventListener('click',async()=>{
    try {await navigator.clipboard.writeText(detailContact);showFeedback(document.getElementById('copy-feedback'),'已复制，请仅用于这次沟通。',false);}
    catch {showFeedback(document.getElementById('copy-feedback'),'未能复制，可手动选择上方联系方式。',true);}
  });
  document.querySelectorAll('[data-quick-status]').forEach(b=>b.addEventListener('click',()=>{statusFilter.value=b.dataset.quickStatus;renderRows();}));
  planFilter.addEventListener('change',renderRows);sortInput.addEventListener('change',renderRows);
  document.getElementById('refresh-btn').addEventListener('click', loadBookings);
  document.getElementById('export-btn').addEventListener('click', exportCsv);
  searchInput.addEventListener('input', renderRows);
  statusFilter.addEventListener('change', renderRows);
  dateFilter.addEventListener('change', renderRows);
  document.getElementById('clear-filters').addEventListener('click', () => {
    searchInput.value = ''; dateFilter.value = ''; statusFilter.value = 'all'; planFilter.value='all'; sortInput.value='newest'; renderRows();
  });
  (async () => {
    const { data } = await db.auth.getSession();
    if (data.session) await openDashboard();
  })();
})();
