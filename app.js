// Oak Hill Media Lab – Enhanced SPA
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const VIEWS = {
  login: '#view-login',
  student: '#view-student',
  teacher: '#view-teacher',
  admin: '#view-admin',
  guardian: '#view-guardian'
};

const STAGES = [
  { key:'development',    name:'Development',    emoji:'💡', rubric:[ 'Idea clarity', 'Character', 'Story structure' ] },
  { key:'preproduction',  name:'Pre-Production', emoji:'📋', rubric:[ 'Storyboard detail', 'Shot plan', 'Roles & resources' ] },
  { key:'production',     name:'Production',     emoji:'🎥', rubric:[ 'Camera/sound use', 'Teamwork', 'Safety' ] },
  { key:'postproduction', name:'Post-Production',emoji:'🎬', rubric:[ 'Editing', 'Audio/titles', 'Reflection' ] },
];

let session = null;

init();

async function init(){
  if ('serviceWorker' in navigator) try { await navigator.serviceWorker.register('service-worker.js'); } catch{}
  $('#themeToggle').addEventListener('click', toggleContrast);
  $('#dysToggle').addEventListener('click', toggleDyslexia);
  $('#loginForm').addEventListener('submit', onLogin);
  $('#logoutBtn').addEventListener('click', logout);

  $('#userForm').addEventListener('submit', saveUser);
  $('#uRole').addEventListener('change', (e)=>{
    $('#guardianOfWrap').classList.toggle('hidden', e.target.value!=='guardian');
  });
  $('#saveSettings').addEventListener('click', saveSettings);

  $('#searchStudent').addEventListener('input', renderTeacherList);
  $('#exportCSV').addEventListener('click', exportCSV);

  $('#exportMyData').addEventListener('click', exportMyData);
  $('#certificateBtn').addEventListener('click', generateCertificate);

  await seedDefaults();
  restoreSession();
}

function toggleContrast(){
  const on = !document.body.classList.contains('high-contrast');
  document.body.classList.toggle('high-contrast', on);
  this.setAttribute('aria-pressed', String(on));
}
function toggleDyslexia(){
  const on = !document.body.classList.contains('dyslexia');
  document.body.classList.toggle('dyslexia', on);
  this.setAttribute('aria-pressed', String(on));
}

// ---------- Auth / Seed ----------
async function seedDefaults(){
  const admin = await idb.get('users','admin@oakhill.local');
  if (!admin){
    await idb.put('users', { name:'Admin', email:'admin@oakhill.local', role:'admin', pass: hash('admin123') });
  }
  if (!await idb.get('settings','uploads')){
    await idb.put('settings',{key:'uploads', pdf:true, images:true, video:true});
  }
  if (!await idb.get('settings','resources')){
    await idb.put('settings',{key:'resources', dev:'', pre:'', pro:'', post:''});
  }
}

async function onLogin(e){
  e.preventDefault();
  const email = $('#loginEmail').value.trim().toLowerCase();
  const pass = $('#loginPass').value;
  const u = await idb.get('users', email);
  if (!u || u.pass !== hash(pass)) return alert('Invalid credentials.');
  session = { email:u.email, role:u.role, name:u.name, guardianOf:u.guardianOf||'' };
  localStorage.setItem('session', JSON.stringify(session));
  $('#userChip').textContent = `${u.name} (${u.role})`; $('#userChip').hidden=false; $('#logoutBtn').hidden=false;
  routeRole(u.role);
}

function restoreSession(){
  const raw = localStorage.getItem('session'); if (!raw) return;
  session = JSON.parse(raw);
  $('#userChip').textContent = `${session.name} (${session.role})`; $('#userChip').hidden=false; $('#logoutBtn').hidden=false;
  routeRole(session.role);
}

function logout(){ session=null; localStorage.removeItem('session'); $('#userChip').hidden=true; $('#logoutBtn').hidden=true; show('login'); }

function routeRole(role){
  if (role==='student') return showStudent();
  if (role==='teacher') return showTeacher();
  if (role==='admin')   return showAdmin();
  if (role==='guardian')return showGuardian();
  show('login');
}

function show(name){ $$('.view').forEach(v=>v.classList.remove('active')); $(VIEWS[name]).classList.add('active'); }

// ---------- Admin ----------
async function saveUser(e){
  e.preventDefault();
  const role = $('#uRole').value;
  const user = {
    name: $('#uName').value.trim(),
    email: $('#uEmail').value.trim().toLowerCase(),
    pass: hash($('#uPass').value),
    role,
    guardianOf: role==='guardian' ? ($('#guardianOf').value.trim().toLowerCase()||'') : ''
  };
  await idb.put('users', user);
  if (user.role === 'student'){
    const existing = await idb.get('projects', user.email);
    if (!existing){
      const stages = Object.fromEntries(STAGES.map(s=>[s.key,{
        completed:false, notes:'', feedback:'', rubric:{}, score:0, badge:''
      }]));
      await idb.put('projects', { id:user.email, stages });
    }
  }
  renderUserTable();
  e.target.reset();
  alert('User saved.');
}

async function renderUserTable(){
  const users = await idb.getAll('users');
  const box = $('#userTable'); box.innerHTML='';
  users.sort((a,b)=>a.role.localeCompare(b.role)||a.name.localeCompare(b.name)).forEach(u=>{
    const row=document.createElement('div'); row.className='card-row';
    row.innerHTML=`<div><strong>${u.name}</strong> <span class="badge">${u.role}</span><br><small>${u.email}</small>${u.guardianOf?`<br><small>Guardian of: ${u.guardianOf}</small>`:''}</div>
    <div><button class="secondary" data-reset="${u.email}">Reset PW</button> <button class="secondary" data-del="${u.email}">Delete</button></div>`;
    box.appendChild(row);
  });
  box.querySelectorAll('button[data-reset]').forEach(btn=>btn.onclick=async()=>{
    const email=btn.dataset.reset; const pw=prompt('New password for '+email+':'); if(!pw)return;
    const u=await idb.get('users',email); u.pass=hash(pw); await idb.put('users',u); alert('Password reset.');
  });
  box.querySelectorAll('button[data-del]').forEach(btn=>btn.onclick=async()=>{
    const email=btn.dataset.del; if(!confirm('Delete user '+email+'?'))return;
    await idb.delete('users',email); await idb.delete('projects',email); renderUserTable();
  });
}

async function saveSettings(){
  await idb.put('settings', {
    key:'uploads',
    pdf: $('#allowPDF').checked, images: $('#allowImages').checked, video: $('#allowVideo').checked
  });
  await idb.put('settings', {
    key:'resources',
    dev: $('#resDev').value.trim(),
    pre: $('#resPre').value.trim(),
    pro: $('#resPro').value.trim(),
    post:$('#resPost').value.trim()
  });
  alert('Settings saved.');
}

function showAdmin(){ show('admin'); renderUserTable(); loadSettings(); }
async function loadSettings(){
  const res = await idb.get('settings','resources') || {dev:'',pre:'',pro:'',post:''};
  $('#resDev').value = res.dev||''; $('#resPre').value=res.pre||''; $('#resPro').value=res.pro||''; $('#resPost').value=res.post||'';
}

// ---------- Teacher ----------
async function showTeacher(){ show('teacher'); renderTeacherList(); }

async function renderTeacherList(){
  const q = $('#searchStudent').value?.toLowerCase()||'';
  const users = (await idb.getAll('users')).filter(u=>u.role==='student' && (u.name.toLowerCase().includes(q)||u.email.includes(q)));
  const box = $('#teacherList'); box.innerHTML='';
  for (const u of users){
    const proj = await ensureProject(u.email);
    const pct = progressPercent(proj);
    const row=document.createElement('div'); row.className='card-row';
    row.innerHTML=`<div><strong>${u.name}</strong> <small class="muted">${u.email}</small><br>
      <div class="progress" style="width:240px"><div style="width:${pct}%"></div></div>
      <small>${pct}% complete</small></div>
      <div><button data-review="${u.email}">Open</button></div>`;
    box.appendChild(row);
  }
  box.querySelectorAll('button[data-review]').forEach(btn=>btn.onclick=async()=>{
    const email=btn.dataset.review; const u=await idb.get('users',email); const p=await ensureProject(email); openStudentModal(u,p);
  });
}

async function openStudentModal(user, proj){
  $('#studentModalTitle').textContent = `Review: ${user.name}`;
  const wrap = document.createElement('div');
  wrap.innerHTML = STAGES.map(s=>{
    const st = proj.stages[s.key];
    const rubricTable = rubricHTML(s, st);
    const comments = commentThreadHTML(user.email, s.key);
    const files = previewListHTML(user.email, s.key);
    return `<div class="card">
      <h4>${s.emoji} ${s.name} ${st.badge?`<span class='badge'>${st.badge}</span>`:''}</h4>
      <div class="file-preview">${files}</div>
      <details><summary><strong>Rubric & Badge</strong></summary>${rubricTable}</details>
      <p><strong>Student notes:</strong> ${escapeHTML(st.notes||'')}</p>
      <label>Teacher Feedback
        <textarea data-fb="${s.key}" placeholder="Feedback for ${s.name}...">${st.feedback||''}</textarea>
      </label>
      <div class="badges"><button data-approve="${s.key}" class="secondary">${st.completed?'Mark Incomplete':'Approve Stage'}</button></div>
      <details open><summary><strong>Comments</strong></summary>
        <div id="comments-${s.key}">${comments}</div>
        <div class="stage-actions">
          <input id="cmt-input-${s.key}" placeholder="Write a comment…"/>
          <button data-cmt="${s.key}">Send</button>
        </div>
      </details>
    </div>`;
  }).join('');
  const dlg = document.getElementById('studentModal');
  const content = document.getElementById('studentReviewContent'); content.innerHTML=''; content.appendChild(wrap);

  content.querySelectorAll('button[data-approve]').forEach(btn=>btn.onclick=async()=>{
    const key=btn.dataset.approve; const p=await idb.get('projects', user.email);
    p.stages[key].completed = !p.stages[key].completed; await idb.put('projects', p); openStudentModal(user,p); renderTeacherList();
  });
  content.querySelectorAll('textarea[data-fb]').forEach(txt=>txt.onchange=async()=>{
    const key=txt.dataset.fb; const p=await idb.get('projects', user.email); p.stages[key].feedback=txt.value; await idb.put('projects', p);
  });
  content.querySelectorAll('button[data-cmt]').forEach(btn=>btn.onclick=async()=>{
    const key=btn.dataset.cmt; const input = document.getElementById('cmt-input-'+key);
    await addComment(user.email, key, 'teacher', session.name, input.value.trim()); input.value=''; renderCommentsInto(user.email, key, 'comments-'+key);
  });

  dlg.showModal();
}

function rubricHTML(stage, st){
  const rows = stage.rubric.map(k=>{
    const score = st?.rubric?.[k] ?? 0;
    return `<tr><td>${k}</td>
      <td><select data-rubric="${stage.key}" data-crit="${k}">${[0,1,2,3,4].map(v=>`<option value="${v}" ${v===score?'selected':''}>${v}</option>`).join('')}</select></td></tr>`;
  }).join('');
  const total = st?.score||0;
  const badge = st?.badge||'';
  return `<table class="rubric"><thead><tr><th>Criterion</th><th>Score (0–4)</th></tr></thead><tbody>${rows}</tbody></table>
  <p><strong>Total:</strong> <span id="rubric-total-${stage.key}">${total}</span> &nbsp; <strong>Badge:</strong> <span id="rubric-badge-${stage.key}">${badge||'—'}</span></p>
  <div class="badges"><button class="secondary" data-calc="${stage.key}">Recalculate</button></div>`;
}

function commentThreadHTML(email, stage){
  // container; will be filled asynchronously
  setTimeout(()=>renderCommentsInto(email, stage, 'comments-'+stage), 0);
  return `<div class="list" id="comments-${stage}">Loading comments…</div>`;
}

async function renderCommentsInto(email, stage, elemId){
  const all = await idb.getAll('comments');
  const list = all.filter(c=>c.email===email && c.stage===stage).sort((a,b)=>a.ts-b.ts);
  const box = document.getElementById(elemId); if (!box) return;
  box.innerHTML = list.map(c=>`<div class="card-row"><div><strong>${c.authorRole==='teacher'?'👩‍🏫':'🧑‍🎓'} ${escapeHTML(c.author)}</strong><br><small>${new Date(c.ts).toLocaleString()}</small></div><div>${escapeHTML(c.text)}</div></div>`).join('') || '<p class="muted">No comments yet.</p>';
}

function previewListHTML(email, stage){
  // Build preview links synchronously; student/teacher can click to open
  // Previews will render inline in student view; here we list simple links
  return `<div id="files-${stage}">${/* dynamic in student view */''}</div>`;
}

// teacher rubric interactions
document.addEventListener('change', async (e)=>{
  const sel = e.target.closest('select[data-rubric]'); if (!sel) return;
  const stageKey = sel.dataset.rubric; const crit = sel.dataset.crit;
  // Find student being reviewed via modal title
  const name = document.getElementById('studentModalTitle').textContent.replace('Review: ','').trim();
  const users = await idb.getAll('users'); const u = users.find(x=>x.name===name);
  if (!u) return;
  const p = await idb.get('projects', u.email); p.stages[stageKey].rubric = p.stages[stageKey].rubric||{}; p.stages[stageKey].rubric[crit]=Number(sel.value);
  await idb.put('projects', p);
});

document.addEventListener('click', async (e)=>{
  const btn = e.target.closest('button[data-calc]'); if (!btn) return;
  const stageKey = btn.dataset.calc;
  const name = document.getElementById('studentModalTitle').textContent.replace('Review: ','').trim();
  const users = await idb.getAll('users'); const u = users.find(x=>x.name===name); if (!u) return;
  const p = await idb.get('projects', u.email);
  const st = p.stages[stageKey]; const scores = Object.values(st.rubric||{});
  const total = scores.reduce((a,b)=>a+b,0);
  st.score = total;
  st.badge = total>=10 ? 'Gold ⭐' : total>=7 ? 'Silver 🥈' : total>=4 ? 'Bronze 🥉' : '';
  await idb.put('projects', p);
  document.getElementById('rubric-total-'+stageKey).textContent = String(total);
  document.getElementById('rubric-badge-'+stageKey).textContent = st.badge||'—';
});

async function addComment(email, stage, authorRole, author, text){
  if (!text) return;
  const rec = { id: crypto.randomUUID(), email, stage, authorRole, author, text, ts: Date.now() };
  await idb.put('comments', rec);
}

// ---------- Teacher CSV ----------
async function exportCSV(){
  const users = (await idb.getAll('users')).filter(u=>u.role==='student');
  const rows = [['Name','Email',...STAGES.map(s=>s.name+' Complete'), ...STAGES.map(s=>s.name+' Score'), ...STAGES.map(s=>s.name+' Badge')]];
  for (const u of users){
    const p = await ensureProject(u.email);
    rows.push([u.name,u.email, ...STAGES.map(s=>p.stages[s.key].completed?'Yes':'No'), ...STAGES.map(s=>p.stages[s.key].score||0), ...STAGES.map(s=>p.stages[s.key].badge||'')]);
  }
  const csv = rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  downloadFile('media-lab-progress.csv','text/csv',csv);
}

// ---------- Student ----------
async function showStudent(){
  show('student');
  const proj = await ensureProject(session.email);
  renderStages(proj);
  updateOverall(proj);
}

function stageResourceLink(sKey, settings){
  const map = {development:'dev', preproduction:'pre', production:'pro', postproduction:'post'};
  const url = (settings?.[map[sKey]]||'').trim();
  return url ? `<a class="secondary" href="${url}" target="_blank" rel="noopener">Open worksheet/slides</a>` : '';
}

async function renderStages(proj){
  const box = $('#stagesContainer'); box.innerHTML='';
  const res = await idb.get('settings','resources');
  STAGES.forEach(s=>{
    const st = proj.stages[s.key];
    const div = document.createElement('div');
    div.className='card stage-card';
    div.innerHTML = `
      <h4>${s.emoji} ${s.name} ${st.badge?`<span class='badge'>${st.badge}</span>`:''}</h4>
      <div class="stage-actions">
        ${stageResourceLink(s.key, res)}
        <label class="file-btn">Upload file<input type="file" data-upload="${s.key}" hidden /></label>
        <button data-complete="${s.key}" class="${st.completed?'secondary':''}">${st.completed?'Mark incomplete':'Mark complete'}</button>
      </div>
      <label>My notes<textarea data-notes="${s.key}" placeholder="Write or paste your notes…">${st.notes||''}</textarea></label>
      <div class="uploads" id="uploads-${s.key}"></div>
      <div class="file-preview" id="preview-${s.key}"></div>
      <details open><summary><strong>Comments</strong></summary>
        <div id="cbox-${s.key}" class="list"></div>
        <div class="stage-actions">
          <input id="cmt-${s.key}" placeholder="Write a comment…"/>
          <button data-stucmt="${s.key}">Send</button>
        </div>
      </details>
      <details><summary><strong>Rubric (Teacher)</strong></summary>
        <p class="muted">Scores are set by your teacher. Your current score: <strong>${st.score||0}</strong>. ${st.badge?`Badge: <strong>${st.badge}</strong>`:''}</p>
      </details>
    `;
    box.appendChild(div);
  });

  // notes/save
  box.querySelectorAll('textarea[data-notes]').forEach(t=>t.onchange=async()=>{
    const p=await idb.get('projects', session.email); p.stages[t.dataset.notes].notes=t.value; await idb.put('projects', p);
  });
  // uploads
  box.querySelectorAll('input[type=file][data-upload]').forEach(inp=>inp.onchange=()=>handleUpload(inp));
  // complete
  box.querySelectorAll('button[data-complete]').forEach(btn=>btn.onclick=async()=>{
    const key=btn.dataset.complete; const p=await idb.get('projects', session.email);
    p.stages[key].completed=!p.stages[key].completed; await idb.put('projects', p); renderStages(p); updateOverall(p);
  });
  // comments
  box.querySelectorAll('button[data-stucmt]').forEach(btn=>btn.onclick=async()=>{
    const key=btn.dataset.stucmt; const input=$('#cmt-'+key); await addComment(session.email, key, 'student', session.name, input.value.trim()); input.value=''; renderCommentsInto(session.email, key, 'cbox-'+key);
  });

  // render existing previews/comments
  STAGES.forEach(async s=>{ await renderUploads(s.key); await renderPreviews(s.key); await renderCommentsInto(session.email, s.key, 'cbox-'+s.key); });
}

async function handleUpload(inp){
  const stage = inp.dataset.upload; const file = inp.files[0]; if(!file) return;
  const settings = await idb.get('settings','uploads');
  const okType = (settings.pdf && file.type==='application/pdf')
              || (settings.images && ['image/png','image/jpeg','image/jpg'].includes(file.type))
              || (settings.video && file.type==='video/mp4');
  if (!okType) return alert('This file type is not allowed.');
  const id = crypto.randomUUID(); const rec={ id, email:session.email, stage, name:file.name, type:file.type, blob:file };
  await idb.put('files', rec); await renderUploads(stage); await renderPreviews(stage); inp.value='';
}

async function renderUploads(stage){
  const mine = (await idb.getAll('files')).filter(f=>f.email===session.email && f.stage===stage);
  const box = document.getElementById('uploads-'+stage);
  box.innerHTML = mine.length? '<strong>My uploads:</strong>':'';
  mine.forEach(f=>{
    const url = URL.createObjectURL(f.blob);
    const a = document.createElement('a'); a.href=url; a.download=f.name; a.textContent=`• ${f.name}`; box.appendChild(a);
  });
}
async function renderPreviews(stage){
  const mine = (await idb.getAll('files')).filter(f=>f.email===session.email && f.stage===stage);
  const box = document.getElementById('preview-'+stage); box.innerHTML='';
  for (const f of mine){
    const url = URL.createObjectURL(f.blob);
    if (f.type.startsWith('image/')){
      const img = document.createElement('img'); img.src=url; img.alt=f.name; box.appendChild(img);
    } else if (f.type==='application/pdf'){
      const obj = document.createElement('object'); obj.data=url; obj.type='application/pdf'; obj.textContent='PDF preview'; box.appendChild(obj);
    } else if (f.type==='video/mp4'){
      const v = document.createElement('video'); v.src=url; v.controls=true; box.appendChild(v);
    } else {
      const a = document.createElement('a'); a.href=url; a.textContent=f.name; box.appendChild(a);
    }
  }
}

function updateOverall(proj){
  const pct = progressPercent(proj);
  $('#progressFill').style.width = pct+'%';
  $('#progressText').textContent = `${pct}% complete`;
}

function progressPercent(proj){
  const total = STAGES.length;
  const done = STAGES.filter(s=>proj.stages[s.key].completed).length;
  return Math.round((done/total)*100);
}

async function ensureProject(email){
  let p = await idb.get('projects', email);
  if (!p){
    p = { id:email, stages: Object.fromEntries(STAGES.map(s=>[s.key,{completed:false, notes:'', feedback:'', rubric:{}, score:0, badge:''}])) };
    await idb.put('projects', p);
  }
  return p;
}

// Certificate (HTML → print to PDF)
async function generateCertificate(){
  const proj = await ensureProject(session.email);
  const allDone = STAGES.every(s=>proj.stages[s.key].completed);
  if (!allDone) return alert('Complete all stages first.');
  const total = STAGES.map(s=>proj.stages[s.key].score||0).reduce((a,b)=>a+b,0);
  const badge = total>=40 ? 'Gold ⭐' : total>=28 ? 'Silver 🥈' : total>=16 ? 'Bronze 🥉' : 'Participant';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Certificate</title>
  <style>body{font-family:Arial,sans-serif;padding:40px;text-align:center}
  .card{border:6px solid #ffcc00;padding:40px;border-radius:20px}
  h1{font-size:40px;margin:0 0 10px} h2{margin:6px 0} .muted{color:#555}</style></head>
  <body onload="window.print()">
    <div class="card">
      <h1>Oak Hill Media Lab</h1>
      <h2>Certificate of Completion</h2>
      <p>This certifies that</p>
      <h2><strong>${escapeHTML(session.name)}</strong></h2>
      <p class="muted">has successfully completed the Filmmaking Project (Development → Post-Production).</p>
      <p><strong>Total Score:</strong> ${total} &nbsp; <strong>Award:</strong> ${badge}</p>
      <p>Date: ${new Date().toLocaleDateString()}</p>
    </div>
  </body></html>`;
  const w = window.open('about:blank','_blank'); w.document.write(html); w.document.close();
}

// ---------- Guardian (read-only) ----------
async function showGuardian(){
  show('guardian');
  const email = session.guardianOf;
  if (!email) { $('#guardianContent').innerHTML = '<p>Please ask admin to link you to a student account.</p>'; return; }
  const user = await idb.get('users', email);
  if (!user){ $('#guardianContent').innerHTML = '<p>Linked student not found.</p>'; return; }
  const proj = await ensureProject(email);
  const pct = progressPercent(proj);
  const wrap = document.createElement('div'); wrap.className='card';
  wrap.innerHTML = `<h3>Student: ${escapeHTML(user.name)} (${escapeHTML(user.email)})</h3>
    <div class="progress" style="width:300px"><div style="width:${pct}%"></div></div>
    <small>${pct}% complete</small>`;
  $('#guardianContent').innerHTML=''; $('#guardianContent').appendChild(wrap);
  STAGES.forEach(async s=>{
    const st = proj.stages[s.key];
    const sec = document.createElement('div'); sec.className='card';
    sec.innerHTML = `<h4>${s.emoji} ${s.name} ${st.completed?'✅':''} ${st.badge?`<span class='badge'>${st.badge}</span>`:''}</h4>
      <p><strong>Teacher feedback:</strong> ${escapeHTML(st.feedback||'—')}</p>`;
    $('#guardianContent').appendChild(sec);
  });
}

// ---------- Helpers ----------
function hash(str){ let h=0; for (let i=0;i<str.length;i++){ h=((h<<5)-h)+str.charCodeAt(i); h|=0; } return String(h); }
function downloadFile(name, type, data){ const blob = new Blob([data], {type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); }
function escapeHTML(s){ return String(s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]||c)); }
