// Oak Hill Media Lab – SPA controller
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const VIEWS = {
  login: '#view-login',
  student: '#view-student',
  teacher: '#view-teacher',
  admin: '#view-admin'
};

const STAGES = [
  { key:'development',    name:'Development',    emoji:'💡', tasks:['Idea Sheet','Character','Outline'] },
  { key:'preproduction',  name:'Pre-Production', emoji:'📋', tasks:['Storyboard','Shot List','Props'] },
  { key:'production',     name:'Production',     emoji:'🎥', tasks:['Film Scenes','Sound Check','Reshoots?'] },
  { key:'postproduction', name:'Post-Production',emoji:'🎬', tasks:['Edit','Titles & Audio','Export'] },
];

let session = null; // {email, role, name}

init();

async function init(){
  if ('serviceWorker' in navigator) try { await navigator.serviceWorker.register('service-worker.js'); } catch {}
  $('#themeToggle').addEventListener('click', toggleContrast);
  $('#dysToggle').addEventListener('click', toggleDyslexia);

  $('#loginForm').addEventListener('submit', onLogin);
  $('#logoutBtn').addEventListener('click', logout);

  $('#userForm').addEventListener('submit', saveUser);
  $('#saveSettings').addEventListener('click', saveSettings);

  $('#searchStudent').addEventListener('input', renderTeacherList);
  $('#exportCSV').addEventListener('click', exportCSV);

  $('#exportMyData').addEventListener('click', exportMyData);

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

// -------- Auth (demo) ----------
async function seedDefaults(){
  const existing = await idb.get('users','admin@oakhill.local');
  if (!existing){
    const admin = { name:'Admin', email:'admin@oakhill.local', role:'admin', pass: hash('admin123') };
    await idb.put('users', admin);
  }
  if (!await idb.get('settings','uploads')){
    await idb.put('settings',{key:'uploads', pdf:true, images:true, video:true});
  }
}

async function onLogin(e){
  e.preventDefault();
  const email = $('#loginEmail').value.trim().toLowerCase();
  const pass = $('#loginPass').value;
  const u = await idb.get('users', email);
  if (!u || u.pass !== hash(pass)) return alert('Invalid credentials.');
  session = { email:u.email, role:u.role, name:u.name };
  localStorage.setItem('session', JSON.stringify(session));
  $('#userChip').textContent = `${u.name} (${u.role})`;
  $('#userChip').hidden = false;
  $('#logoutBtn').hidden = false;
  routeRole(u.role);
}

function restoreSession(){
  const raw = localStorage.getItem('session');
  if (!raw) return;
  session = JSON.parse(raw);
  $('#userChip').textContent = `${session.name} (${session.role})`;
  $('#userChip').hidden = false;
  $('#logoutBtn').hidden = false;
  routeRole(session.role);
}

function logout(){
  session = null;
  localStorage.removeItem('session');
  $('#userChip').hidden = true;
  $('#logoutBtn').hidden = true;
  show('login');
}

function routeRole(role){
  if (role==='student') return showStudent();
  if (role==='teacher') return showTeacher();
  if (role==='admin')   return showAdmin();
  show('login');
}

function show(name){
  $$('.view').forEach(v=>v.classList.remove('active'));
  document.querySelector(VIEWS[name]).classList.add('active');
}

// -------- Admin ---------
async function saveUser(e){
  e.preventDefault();
  const user = {
    name: document.getElementById('uName').value.trim(),
    email: document.getElementById('uEmail').value.trim().toLowerCase(),
    pass: hash(document.getElementById('uPass').value),
    role: document.getElementById('uRole').value
  };
  await idb.put('users', user);
  if (user.role === 'student'){
    const existing = await idb.get('projects', user.email);
    if (!existing){
      const stages = Object.fromEntries(STAGES.map(s=>[s.key,{completed:false, notes:'', tasks:{}, feedback:''}]));
      await idb.put('projects', { id:user.email, stages });
    }
  }
  renderUserTable();
  e.target.reset();
  alert('User saved.');
}

async function renderUserTable(){
  const users = await idb.getAll('users');
  const box = document.getElementById('userTable');
  box.innerHTML = '';
  users.sort((a,b)=>a.role.localeCompare(b.role)||a.name.localeCompare(b.name)).forEach(u=>{
    const row = document.createElement('div');
    row.className = 'card-row';
    row.innerHTML = `
      <div>
        <strong>${u.name}</strong> <span class="badge">${u.role}</span><br>
        <small>${u.email}</small>
      </div>
      <div>
        <button class="secondary" data-reset="${u.email}">Reset PW</button>
        <button class="secondary" data-del="${u.email}">Delete</button>
      </div>`;
    box.appendChild(row);
  });
  box.querySelectorAll('button[data-reset]').forEach(btn=>{
    btn.onclick = async ()=>{
      const email = btn.dataset.reset;
      const pw = prompt('New password for '+email+':');
      if (!pw) return;
      const u = await idb.get('users', email); u.pass = hash(pw); await idb.put('users', u);
      alert('Password reset.');
    };
  });
  box.querySelectorAll('button[data-del]').forEach(btn=>{
    btn.onclick = async ()=>{
      const email = btn.dataset.del;
      if (!confirm('Delete user '+email+'?')) return;
      await idb.delete('users', email);
      await idb.delete('projects', email);
      renderUserTable();
    };
  });
}

async function saveSettings(){
  await idb.put('settings', {
    key:'uploads',
    pdf: document.getElementById('allowPDF').checked,
    images: document.getElementById('allowImages').checked,
    video: document.getElementById('allowVideo').checked
  });
  alert('Settings saved.');
}

function showAdmin(){ show('admin'); renderUserTable(); }

// -------- Teacher ---------
async function showTeacher(){ show('teacher'); renderTeacherList(); }

async function renderTeacherList(){
  const q = (document.getElementById('searchStudent').value||'').toLowerCase();
  const users = (await idb.getAll('users')).filter(u=>u.role==='student' && (u.name.toLowerCase().includes(q) || u.email.includes(q)));
  const box = document.getElementById('teacherList'); box.innerHTML='';
  for (const u of users){
    const proj = await idb.get('projects', u.email);
    const pct = progressPercent(proj);
    const row = document.createElement('div');
    row.className = 'card-row';
    row.innerHTML = `
      <div>
        <strong>${u.name}</strong> <small class="muted">${u.email}</small><br>
        <div class="progress" style="width:240px"><div style="width:${pct}%"></div></div>
        <small>${pct}% complete</small>
      </div>
      <div>
        <button data-review="${u.email}">Open</button>
      </div>`;
    box.appendChild(row);
  }
  box.querySelectorAll('button[data-review]').forEach(btn=>{
    btn.onclick = async ()=>{
      const email = btn.dataset.review;
      const u = (await idb.get('users', email));
      const proj = await idb.get('projects', email);
      openStudentModal(u, proj);
    };
  });
}

async function openStudentModal(user, proj){
  document.getElementById('studentModalTitle').textContent = `Review: ${user.name}`;
  const wrap = document.createElement('div');
  wrap.innerHTML = STAGES.map(s=>{
    const st = proj.stages[s.key];
    return `
      <div class="card">
        <h4>${s.emoji} ${s.name}</h4>
        <p><strong>Notes:</strong> ${escapeHTML(st.notes||'')}</p>
        <p><strong>Completed:</strong> ${st.completed ? 'Yes ✅' : 'No ⏳'}</p>
        <label>Teacher Feedback
          <textarea data-fb="${s.key}" placeholder="Feedback for ${s.name}...">${st.feedback||''}</textarea>
        </label>
        <button data-approve="${s.key}" class="secondary">${st.completed?'Mark Incomplete':'Approve Stage'}</button>
      </div>`;
  }).join('');
  const dlg = document.getElementById('studentModal');
  const content = document.getElementById('studentReviewContent'); content.innerHTML=''; content.appendChild(wrap);
  content.querySelectorAll('button[data-approve]').forEach(btn=>{
    btn.onclick = async ()=>{
      const key = btn.dataset.approve;
      const proj2 = await idb.get('projects', user.email);
      proj2.stages[key].completed = !proj2.stages[key].completed;
      await idb.put('projects', proj2);
      openStudentModal(user, proj2);
      renderTeacherList();
    };
  });
  content.querySelectorAll('textarea[data-fb]').forEach(txt=>{
    txt.onchange = async ()=>{
      const key = txt.dataset.fb;
      const proj2 = await idb.get('projects', user.email);
      proj2.stages[key].feedback = txt.value;
      await idb.put('projects', proj2);
    };
  });
  dlg.showModal();
}

async function exportCSV(){
  const users = (await idb.getAll('users')).filter(u=>u.role==='student');
  const rows = [['Name','Email',...STAGES.map(s=>s.name+' Complete')]];
  for (const u of users){
    const p = await idb.get('projects', u.email);
    rows.push([u.name,u.email, ...STAGES.map(s=>p?.stages[s.key]?.completed?'Yes':'No')]);
  }
  const csv = rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  downloadFile('media-lab-progress.csv', 'text/csv', csv);
}

// -------- Student ---------
async function showStudent(){
  show('student');
  const proj = await ensureProject(session.email);
  renderStages(proj);
  updateOverall(proj);
}

function renderStages(proj){
  const box = document.getElementById('stagesContainer'); box.innerHTML='';
  STAGES.forEach(s=>{
    const st = proj.stages[s.key];
    const div = document.createElement('div');
    div.className='card stage-card';
    div.innerHTML = `
      <h4>${s.emoji} ${s.name}</h4>
      <label>My notes
        <textarea data-notes="${s.key}" placeholder="Write or paste your notes…">${st.notes||''}</textarea>
      </label>
      <div class="stage-actions">
        <label class="file-btn">Upload file
          <input type="file" data-upload="${s.key}" hidden />
        </label>
        <button data-complete="${s.key}" class="${st.completed?'secondary':''}">
          ${st.completed?'Mark incomplete':'Mark complete'}
        </button>
      </div>
      <div class="uploads" id="uploads-${s.key}"></div>
      <p class="muted"><strong>Teacher feedback:</strong> ${st.feedback||'—'}</p>
    `;
    box.appendChild(div);
  });

  box.querySelectorAll('textarea[data-notes]').forEach(t=>{
    t.onchange = async ()=>{
      const proj = await idb.get('projects', session.email);
      proj.stages[t.dataset.notes].notes = t.value;
      await idb.put('projects', proj);
    };
  });
  box.querySelectorAll('input[type=file][data-upload]').forEach(inp=>{
    inp.onchange = ()=>handleUpload(inp);
  });
  box.querySelectorAll('button[data-complete]').forEach(btn=>{
    btn.onclick = async ()=>{
      const key = btn.dataset.complete;
      const proj = await idb.get('projects', session.email);
      proj.stages[key].completed = !proj.stages[key].completed;
      await idb.put('projects', proj);
      renderStages(proj);
      updateOverall(proj);
    };
  });
  STAGES.forEach(s=>renderUploads(s.key));
}

async function handleUpload(inp){
  const stage = inp.dataset.upload;
  const file = inp.files[0]; if(!file) return;
  const settings = await idb.get('settings','uploads');
  const okType = (settings.pdf && file.type==='application/pdf')
              || (settings.images && ['image/png','image/jpeg','image/jpg'].includes(file.type))
              || (settings.video && file.type==='video/mp4');
  if (!okType) return alert('This file type is not allowed by admin settings.');

  const id = `${crypto.randomUUID()}`;
  const rec = { id, email:session.email, stage, name:file.name, type:file.type, blob:file };
  await idb.put('files', rec);
  renderUploads(stage);
  inp.value='';
}

async function renderUploads(stage){
  const all = await idb.getAll('files');
  const mine = all.filter(f=>f.email===session.email && f.stage===stage);
  const box = document.getElementById(`uploads-${stage}`);
  box.innerHTML = mine.length? '<strong>My uploads:</strong>':'';
  mine.forEach(f=>{
    const url = URL.createObjectURL(f.blob);
    const a = document.createElement('a');
    a.href = url; a.download = f.name; a.textContent = `• ${f.name}`;
    box.appendChild(a);
  });
}

function updateOverall(proj){
  const pct = progressPercent(proj);
  document.getElementById('progressFill').style.width = pct+'%';
  document.getElementById('progressText').textContent = `${pct}% complete`;
}

function progressPercent(proj){
  const total = STAGES.length;
  const done = STAGES.filter(s=>proj.stages[s.key].completed).length;
  return Math.round((done/total)*100);
}

async function ensureProject(email){
  let p = await idb.get('projects', email);
  if (!p){
    p = { id:email, stages: Object.fromEntries(STAGES.map(s=>[s.key,{completed:false, notes:'', tasks:{}, feedback:''}])) };
    await idb.put('projects', p);
  }
  return p;
}

async function exportMyData(){
  const proj = await idb.get('projects', session.email);
  const files = (await idb.getAll('files')).filter(f=>f.email===session.email)
    .map(f=>({id:f.id, stage:f.stage, name:f.name, type:f.type}));
  const bundle = { user:session, project:proj, files };
  downloadFile(`my-media-lab-${session.email}.json`, 'application/json', JSON.stringify(bundle,null,2));
}

// -------- helpers ----------
function hash(str){
  let h=0; for (let i=0;i<str.length;i++) { h=((h<<5)-h)+str.charCodeAt(i); h|=0; }
  return String(h);
}
function downloadFile(name, type, data){
  const blob = new Blob([data], {type});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
}
function escapeHTML(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
