// SPA with per-stage Worksheets + submission
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const STAGES = [
  { key:'development', name:'Development', emoji:'💡' },
  { key:'preproduction', name:'Pre-Production', emoji:'📋' },
  { key:'production', name:'Production', emoji:'🎥' },
  { key:'postproduction', name:'Post-Production', emoji:'🎬' },
];

// Simple schemas mirroring your DOCX worksheets
const WORKSHEETS = {
  development: [
    { id:'idea', label:'Your film idea (write or draw description)', type:'textarea', required:true },
    { id:'characters', label:'Describe your main character(s)', type:'textarea' },
    { id:'outline', label:'Story outline (Beginning / Middle / End)', type:'textarea', required:true }
  ],
  preproduction: [
    { id:'team_roles', label:'Your team & roles (Director, Camera, Actor, Sound)', type:'textarea', required:true },
    { id:'storyboard', label:'Storyboard overview (describe key scenes)', type:'textarea', required:true },
    { id:'props', label:'Props & equipment list', type:'textarea' },
    { id:'script', label:'Short script or acting notes', type:'textarea' }
  ],
  production: [
    { id:'setup', label:'How did you set up camera & tripod safely?', type:'textarea', required:true },
    { id:'scenes', label:'What scenes did you film today?', type:'textarea', required:true },
    { id:'soundcheck', label:'Sound check notes', type:'textarea' },
    { id:'review', label:'What went well? What to improve?', type:'textarea' }
  ],
  postproduction: [
    { id:'editing', label:'What editing did you do (trim, order, transitions)?', type:'textarea', required:true },
    { id:'audio_titles', label:'What did you add (music, SFX, titles)?', type:'textarea' },
    { id:'reflection', label:'Final reflection', type:'textarea', required:true }
  ]
};

let session = null;

init();

async function init(){
  $('#loginForm').addEventListener('submit', onLogin);
  $('#logoutBtn').addEventListener('click', logout);
  $('#exportMyData').addEventListener('click', exportMyData);
  $('#certificateBtn').addEventListener('click', generateCertificate);
  await seedAdmin();
  restoreSession();
}

async function seedAdmin(){
  const existing = await idb.get('users','admin@oakhill.local');
  if (!existing){
    await idb.put('users',{email:'admin@oakhill.local', name:'Admin', role:'admin', pass: hash('admin123')});
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
  $('#userChip').textContent = `${u.name} (${u.role})`; $('#userChip').hidden=false; $('#logoutBtn').hidden=false;
  show('student');
  renderStudent();
}

function logout(){ session=null; localStorage.removeItem('session'); $('#userChip').hidden=true; $('#logoutBtn').hidden=true; show('login'); }

function show(name){
  $$('.view').forEach(v=>v.classList.remove('active'));
  document.querySelector(`#view-${name}`).classList.add('active');
}

// ---------- Student dashboard ----------
async function renderStudent(){
  const box = $('#stagesContainer'); box.innerHTML='';
  for (const s of STAGES){
    const st = await getSubmission(session.email, s.key);
    const status = st?.status || 'draft';
    const card = document.createElement('div');
    card.className='card stage-card';
    card.innerHTML = `
      <h4>${s.emoji} ${s.name}</h4>
      <div class="stage-actions">
        <button data-open="${s.key}">Open Worksheet</button>
        <button data-submit="${s.key}" class="secondary"${status==='submitted'?' disabled':''}>${status==='submitted'?'Submitted':'Submit for review'}</button>
        <button data-status="${s.key}" class="secondary">View Status</button>
      </div>
      <div class="uploads" id="status-${s.key}"><strong>Status:</strong> ${status}</div>
    `;
    box.appendChild(card);
  }
  box.querySelectorAll('button[data-open]').forEach(b=>b.onclick=()=>openWorksheet(b.dataset.open));
  box.querySelectorAll('button[data-submit]').forEach(b=>b.onclick=()=>submitWorksheet(b.dataset.submit));
  box.querySelectorAll('button[data-status]').forEach(b=>b.onclick=()=>showStatus(b.dataset.status));
}

async function openWorksheet(stage){
  const dlg = document.getElementById('worksheetDialog');
  const title = document.getElementById('wsTitle'); const desc = document.getElementById('wsDesc'); const form = document.getElementById('wsForm');
  title.textContent = `${STAGE_NAME(stage)} Worksheet`;
  desc.textContent = `Fill the fields and click Save. When ready, click "Submit for review" from your dashboard.`;
  const existing = await getSubmission(session.email, stage);
  form.innerHTML = '';
  for (const field of WORKSHEETS[stage]){
    const wrap = document.createElement('label');
    wrap.innerHTML = `${field.label}${field.required?' *':''}
      ${field.type==='textarea'
        ? `<textarea data-field="${field.id}" aria-label="${field.label}">${existing?.data?.[field.id]||''}</textarea>`
        : `<input data-field="${field.id}" aria-label="${field.label}" value="${existing?.data?.[field.id]||''}"/>`}`;
    form.appendChild(wrap);
  }
  const save = document.createElement('button'); save.type='button'; save.textContent='Save Draft'; save.className='secondary';
  save.onclick = async ()=>{
    const data = {};
    form.querySelectorAll('[data-field]').forEach(el=>data[el.dataset.field]=el.value.trim());
    await saveSubmission(session.email, stage, data, existing?.status||'draft');
    alert('Saved.');
  };
  form.appendChild(save);
  dlg.showModal();
}

async function submitWorksheet(stage){
  const sub = await getSubmission(session.email, stage);
  if (!sub || !validateSubmission(sub)) return alert('Please open the worksheet and fill the required fields first.');
  sub.status = 'submitted'; sub.ts = Date.now();
  await idb.put('submissions', sub);
  document.getElementById('status-'+stage).innerHTML = '<strong>Status:</strong> submitted';
  renderStudent();
}

function showStatus(stage){
  getSubmission(session.email, stage).then(sub=>{
    alert(sub ? `Stage: ${STAGE_NAME(stage)}\nStatus: ${sub.status}` : 'No submission yet.');
  });
}

// ---------- Data helpers ----------
function STAGE_NAME(key){ return STAGES.find(s=>s.key===key).name; }

async function getSubmission(email, stage){
  const list = await idb.getAll('submissions');
  return list.find(s=>s.email===email && s.stage===stage) || null;
}
async function saveSubmission(email, stage, data, status='draft'){
  const existing = await getSubmission(email, stage);
  const rec = existing || { id: crypto.randomUUID(), email, stage, status:'draft', data:{}, ts: Date.now() };
  rec.data = data; rec.status = status; rec.ts = Date.now();
  await idb.put('submissions', rec);
  return rec;
}
function validateSubmission(sub){
  const req = WORKSHEETS[sub.stage].filter(f=>f.required).map(f=>f.id);
  return req.every(k=> (sub.data?.[k]||'').trim().length>0 );
}

// ---------- Exports / Certificate (placeholder) ----------
async function exportMyData(){
  const subs = (await idb.getAll('submissions')).filter(s=>s.email===session.email);
  const bundle = { user:session, submissions:subs };
  const json = JSON.stringify(bundle,null,2);
  downloadFile(`media-lab-${session.email}.json`,'application/json',json);
}
async function generateCertificate(){
  alert('Certificate generation is available in the PLUS package. (This demo focuses on Worksheets & submission.)');
}

// ---------- Utilities ----------
function hash(str){ let h=0; for (let i=0;i<str.length;i++){ h=((h<<5)-h)+str.charCodeAt(i); h|=0; } return String(h); }
