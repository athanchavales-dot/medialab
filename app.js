
// --- SEN: Guided checklist embedded per stage ---
async function addGuidance(cardEl, stageKey){
  try{
    const me = (window.currentUser ? await currentUser() : {email:'anon'});
    const prefsKey = 'prefs:' + me.email;
    const saved = (await idb.get('settings', prefsKey)) || { key:prefsKey, checks:{} };
    const CHECKS = {
      development: [
        ['idea','I explained my idea'],
        ['characters','I listed people or roles'],
        ['story','I wrote the beginning, middle, end']
      ],
      preproduction: [
        ['storyboard','I sketched or described 3 scenes'],
        ['roles','We picked our team jobs'],
        ['props','I listed props/equipment']
      ],
      production: [
        ['tripod','Tripod and camera were safe'],
        ['sound','We checked sound'],
        ['scenes','We filmed our scenes']
      ],
      postproduction: [
        ['order','Clips are in the right order'],
        ['titles','I added titles or captions'],
        ['reflect','I wrote or recorded my reflection']
      ]
    };
    const TIPS = {
      development: 'Say your idea in one sentence. Who is in your story? What happens first, next, last? You can record your voice.',
      preproduction: 'Draw or describe at least 3 scenes. Pick team jobs. List props and places.',
      production: 'Safety first. Check tripod. Do a sound test. Film one short scene at a time.',
      postproduction: 'Put clips in order. Add a title. Add credits. Listen for clear sound.'
    };
    const list = CHECKS[stageKey]; if (!list) return;
    const wrap = document.createElement('div'); wrap.className = 'guided card';
    const h = document.createElement('h4'); h.textContent = 'Guided checklist'; wrap.appendChild(h);
    const ul = document.createElement('ul'); ul.className = 'checklist';
    list.forEach(([key,label])=>{
      const li = document.createElement('li');
      const lab = document.createElement('label');
      const cb = document.createElement('input'); cb.type='checkbox'; cb.setAttribute('data-check', key);
      const prefKey = 'chk:' + stageKey + ':' + key;
      cb.checked = !!saved.checks[prefKey];
      cb.addEventListener('change', async ()=>{
        saved.checks[prefKey] = cb.checked; await idb.put('settings', saved);
        if (window.renderProgress) window.renderProgress();
      });
      lab.appendChild(cb); lab.appendChild(document.createTextNode(' ' + label));
      li.appendChild(lab); ul.appendChild(li);
    });
    const bar = document.createElement('div'); bar.className = 'step-actions';
    const help = document.createElement('button'); help.className='btn secondary'; help.textContent='Help';
    help.addEventListener('click', ()=> alert(TIPS[stageKey] || 'Keep it simple and clear. Ask your teacher if you get stuck.'));
    bar.appendChild(help);

    wrap.appendChild(ul); wrap.appendChild(bar);
    // Insert guidance as the first block inside stage card
    const first = cardEl.firstElementChild && cardEl.firstElementChild.nextSibling;
    cardEl.insertBefore(wrap, cardEl.children[1]||null);
  }catch(e){ console.error('addGuidance failed', e); }
}

// Oak Hill Media Lab v9 (PLUS + Submissions + Admin uploads)
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const VIEWS = { login:'#view-login', student:'#view-student', teacher:'#view-teacher', admin:'#view-admin', guardian:'#view-guardian' };

const STAGES = [
  { key:'development',    name:'Development',    emoji:'💡', rubric:[ 'Idea clarity', 'Character', 'Story structure' ] },
  { key:'preproduction',  name:'Pre-Production', emoji:'📋', rubric:[ 'Storyboard detail', 'Shot plan', 'Roles & resources' ] },
  { key:'production',     name:'Production',     emoji:'🎥', rubric:[ 'Camera/sound use', 'Teamwork', 'Safety' ] },
  { key:'postproduction', name:'Post-Production',emoji:'🎬', rubric:[ 'Editing', 'Audio/titles', 'Reflection' ] },
];

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

// ---- Asset helpers (Admin stage resources) ----
async function saveAsset(file){
  const rec = { id: crypto.randomUUID(), name: file.name, type: file.type, blob: file };
  await idb.put('assets', rec);
  return rec.id;
}
async function getAssetURL(id){
  const a = await idb.get('assets', id);
  return a ? URL.createObjectURL(a.blob) : '';
}

let session = null;

init();

async function init(){
  if ('serviceWorker' in navigator) try { await navigator.serviceWorker.register('./service-worker.js'); } catch {}
  $('#themeToggle').addEventListener('click', toggleContrast);
  $('#dysToggle').addEventListener('click', toggleDyslexia);
  $('#loginForm').addEventListener('submit', onLogin);
  $('#logoutBtn').addEventListener('click', logout);
  $('#userForm').addEventListener('submit', saveUser);
  $('#uRole').addEventListener('change', (e)=>$('#guardianOfWrap').classList.toggle('hidden', e.target.value!=='guardian'));
  $('#saveSettings').addEventListener('click', saveSettings);
  $('#searchStudent').addEventListener('input', renderTeacherList);
  $('#exportCSV').addEventListener('click', exportCSV);
  $('#exportMyData').addEventListener('click', exportMyData);
  $('#certificateBtn').addEventListener('click', generateCertificate);
  await seedDefaults();
  restoreSession();
}

function toggleContrast(){ const on=!document.body.classList.contains('high-contrast'); document.body.classList.toggle('high-contrast', on); this.setAttribute('aria-pressed', String(on)); }
function toggleDyslexia(){ const on=!document.body.classList.contains('dyslexia'); document.body.classList.toggle('dyslexia', on); this.setAttribute('aria-pressed', String(on)); }

async function seedDefaults(){
  const admin = await idb.get('users','admin@oakhill.local');
  if (!admin){ await idb.put('users', { name:'Admin', email:'admin@oakhill.local', role:'admin', pass: hash('admin123') }); }
  if (!await idb.get('settings','uploads')){ await idb.put('settings',{key:'uploads', pdf:true, images:true, video:true}); }
  if (!await idb.get('settings','resources')){ await idb.put('settings',{key:'resources', dev:'', pre:'', pro:'', post:''}); }
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

function restoreSession(){ const raw=localStorage.getItem('session'); if(!raw) return; session=JSON.parse(raw); $('#userChip').textContent=`${session.name} (${session.role})`; $('#userChip').hidden=false; $('#logoutBtn').hidden=false; routeRole(session.role); }
function logout(){ session=null; localStorage.removeItem('session'); $('#userChip').hidden=true; $('#logoutBtn').hidden=true; show('login'); }
function routeRole(role){ if(role==='student')return showStudent(); if(role==='teacher')return showTeacher(); if(role==='admin')return showAdmin(); if(role==='guardian')return showGuardian(); show('login'); }
function show(name){ $$('.view').forEach(v=>v.classList.remove('active')); document.querySelector(VIEWS[name]).classList.add('active'); }

// -------- Admin --------
async function saveUser(e){
  e.preventDefault();
  const role=$('#uRole').value;
  const user={ name:$('#uName').value.trim(), email:$('#uEmail').value.trim().toLowerCase(), pass:hash($('#uPass').value), role, guardianOf: role==='guardian'?($('#guardianOf').value.trim().toLowerCase()||''):'' };
  await idb.put('users', user);
  if (user.role==='student'){
    const existing = await idb.get('projects', user.email);
    if (!existing){
      const stages = Object.fromEntries(STAGES.map(s=>[s.key,{completed:false, notes:'', feedback:'', rubric:{}, score:0, badge:''}]));
      await idb.put('projects', { id:user.email, stages });
    }
  }
  renderUserTable(); e.target.reset(); alert('User saved.');
}
async function renderUserTable(){
  const users=await idb.getAll('users'); const box=$('#userTable'); box.innerHTML='';
  users.sort((a,b)=>a.role.localeCompare(b.role)||a.name.localeCompare(b.name)).forEach(u=>{
    const row=document.createElement('div'); row.className='card-row';
    row.innerHTML=`<div><strong>${u.name}</strong> <span class="badge">${u.role}</span><br><small>${u.email}</small>${u.guardianOf?`<br><small>Guardian of: ${u.guardianOf}</small>`:''}</div>
      <div><button class="secondary" data-reset="${u.email}">Reset PW</button> <button class="secondary" data-del="${u.email}">Delete</button></div>`;
    box.appendChild(row);
  });
  box.querySelectorAll('button[data-reset]').forEach(btn=>btn.onclick=async()=>{ const email=btn.dataset.reset; const pw=prompt('New password for '+email+':'); if(!pw)return; const u=await idb.get('users',email); u.pass=hash(pw); await idb.put('users',u); alert('Password reset.'); });
  box.querySelectorAll('button[data-del]').forEach(btn=>btn.onclick=async()=>{ const email=btn.dataset.del; if(!confirm('Delete user '+email+'?'))return; await idb.delete('users',email); await idb.delete('projects',email); renderUserTable(); });
}
async function saveSettings(){
  await idb.put('settings',{
    key:'uploads',
    pdf: $('#allowPDF').checked,
    images: $('#allowImages').checked,
    video: $('#allowVideo').checked
  });
  const existing = await idb.get('settings','resources')||{};
  await idb.put('settings',{
    key:'resources',
    // extra links
    dev: $('#resDev')?.value.trim() || '',
    pre: $('#resPre')?.value.trim() || '',
    pro: $('#resPro')?.value.trim() || '',
    post:$('#resPost')?.value.trim() || '',
    // video urls
    devVideoUrl: $('#devVideoUrl')?.value.trim() || existing.devVideoUrl || '',
    preVideoUrl: $('#preVideoUrl')?.value.trim() || existing.preVideoUrl || '',
    proVideoUrl: $('#proVideoUrl')?.value.trim() || existing.proVideoUrl || '',
    postVideoUrl:$('#postVideoUrl')?.value.trim() || existing.postVideoUrl || '',
    // file ids + names (preserve if not changed)
    devWordId: existing.devWordId||'', devWordName: existing.devWordName||'',
    devPdfId:  existing.devPdfId||'',  devPdfName:  existing.devPdfName||'',
    devPptxId: existing.devPptxId||'', devPptxName: existing.devPptxName||'',
    preWordId: existing.preWordId||'', preWordName: existing.preWordName||'',
    prePdfId:  existing.prePdfId||'',  prePdfName:  existing.prePdfName||'',
    prePptxId: existing.prePptxId||'', prePptxName: existing.prePptxName||'',
    proWordId: existing.proWordId||'', proWordName: existing.proWordName||'',
    proPdfId:  existing.proPdfId||'',  proPdfName:  existing.proPdfName||'',
    proPptxId: existing.proPptxId||'', proPptxName: existing.proPptxName||'',
    postWordId: existing.postWordId||'', postWordName: existing.postWordName||'',
    postPdfId:  existing.postPdfId||'',  postPdfName:  existing.postPdfName||'',
    postPptxId: existing.postPptxId||'', postPptxName: existing.postPptxName||''
  });
  alert('Settings saved.');
}
function showAdmin(){ show('admin'); renderUserTable(); loadSettings(); }
async function loadSettings(){
  const res = await idb.get('settings','resources')||{};
  // Fill URLs
  if ($('#resDev'))  $('#resDev').value  = res.dev||'';
  if ($('#resPre'))  $('#resPre').value  = res.pre||'';
  if ($('#resPro'))  $('#resPro').value  = res.pro||'';
  if ($('#resPost')) $('#resPost').value = res.post||'';
  if ($('#devVideoUrl'))  $('#devVideoUrl').value  = res.devVideoUrl||'';
  if ($('#preVideoUrl'))  $('#preVideoUrl').value  = res.preVideoUrl||'';
  if ($('#proVideoUrl'))  $('#proVideoUrl').value  = res.proVideoUrl||'';
  if ($('#postVideoUrl')) $('#postVideoUrl').value = res.postVideoUrl||'';

  // Show uploaded filenames
  const setInfo = (id, name)=>{ const el = $('#'+id); if (el) el.textContent = name?('Uploaded: '+name):''; };
  setInfo('devWordInfo', res.devWordName||''); setInfo('devPdfInfo', res.devPdfName||''); setInfo('devPptxInfo', res.devPptxName||'');
  setInfo('preWordInfo', res.preWordName||''); setInfo('prePdfInfo', res.prePdfName||''); setInfo('prePptxInfo', res.prePptxName||'');
  setInfo('proWordInfo', res.proWordName||''); setInfo('proPdfInfo', res.proPdfName||''); setInfo('proPptxInfo', res.proPptxName||'');
  setInfo('postWordInfo', res.postWordName||''); setInfo('postPdfInfo', res.postPdfName||''); setInfo('postPptxInfo', res.postPptxName||'');

  // Wire file inputs (save to assets + remember id+name in settings)
  const wire = (inputId, keyBase) => {
    const inp = $('#'+inputId); if (!inp) return;
    inp.onchange = async ()=>{
      const file = inp.files[0]; if(!file) return;
      const id = await saveAsset(file);
      const s = await idb.get('settings','resources')||{};
      s.key='resources';
      s[keyBase+'Id'] = id;
      s[keyBase+'Name'] = file.name;
      await idb.put('settings', s);
      const info = $('#'+keyBase.replace(/([A-Z])/g,'$1')+'Info'); // not used; we'll manually set below
      const map = {
        devWordFile:'devWordInfo', devPdfFile:'devPdfInfo', devPptxFile:'devPptxInfo',
        preWordFile:'preWordInfo', prePdfFile:'prePdfInfo', prePptxFile:'prePptxInfo',
        proWordFile:'proWordInfo', proPdfFile:'proPdfInfo', proPptxFile:'proPptxInfo',
        postWordFile:'postWordInfo', postPdfFile:'postPdfInfo', postPptxFile:'postPptxInfo'
      };
      const infoId = map[inputId];
      if (infoId && $('#'+infoId)) $('#'+infoId).textContent = 'Uploaded: ' + file.name;
      alert(file.name + ' uploaded.');
    };
  };
  wire('devWordFile','devWord'); wire('devPdfFile','devPdf'); wire('devPptxFile','devPptx');
  wire('preWordFile','preWord'); wire('prePdfFile','prePdf'); wire('prePptxFile','prePptx');
  wire('proWordFile','proWord'); wire('proPdfFile','proPdf'); wire('proPptxFile','proPptx');
  wire('postWordFile','postWord'); wire('postPdfFile','postPdf'); wire('postPptxFile','postPptx');
}

// -------- Teacher --------
async function showTeacher(){ show('teacher'); renderTeacherList(); }
async function renderTeacherList(){
  const q=$('#searchStudent').value?.toLowerCase()||'';
  const users=(await idb.getAll('users')).filter(u=>u.role==='student' && (u.name.toLowerCase().includes(q)||u.email.includes(q)));
  const box=$('#teacherList'); box.innerHTML='';
  for (const u of users){
    const proj=await ensureProject(u.email); const pct=progressPercent(proj);
    const row=document.createElement('div'); row.className='card-row';
    row.innerHTML=`<div><strong>${u.name}</strong> <small class="muted">${u.email}</small><br><div class="progress" style="width:240px"><div style="width:${pct}%"></div></div><small>${pct}% complete</small></div><div><button data-review="${u.email}">Open</button></div>`;
    box.appendChild(row);
  }
  box.querySelectorAll('button[data-review]').forEach(btn=>btn.onclick=async()=>{ const email=btn.dataset.review; const u=await idb.get('users',email); const p=await ensureProject(email); openStudentModal(u,p); });
}

async function openStudentModal(user, proj){
  $('#studentModalTitle').textContent=`Review: ${user.name}`;
  const wrap=document.createElement('div');
  wrap.innerHTML = STAGES.map(s=>{
    const st=proj.stages[s.key];
    return `<div class="card">
      <h4>${s.emoji} ${s.name} ${st.completed?'✅':''} ${st.badge?`<span class='badge'>${st.badge}</span>`:''}</h4>
      <details open><summary><strong>Worksheet Submission</strong> (<span id="ws-status-${s.key}">Loading…</span>)</summary>
        <div id="ws-answers-${s.key}">Loading…</div>
        <div id="res-${s.key}"></div><div class="stage-actions">
          <button class="secondary" data-return="${s.key}">Return for edits</button>
          <button class="secondary" data-approve="${s.key}">${st.completed?'Mark Incomplete':'Approve Stage'}</button>
        </div>
      </details>
      <details><summary><strong>Rubric & Badge</strong></summary>${rubricHTML(s, st)}</details>
      <label>Teacher Feedback<textarea data-fb="${s.key}" placeholder="Feedback for ${s.name}...">${st.feedback||''}</textarea></label>
      <details open><summary><strong>Comments</strong></summary>
        <div id="comments-${s.key}">Loading…</div>
        <div id="res-${s.key}"></div><div class="stage-actions"><input id="cmt-input-${s.key}" placeholder="Write a comment…"/><button data-cmt="${s.key}">Send</button></div>
      </details>
    </div>`;
  }).join('');
  const dlg=$('#studentModal'); const content=$('#studentReviewContent'); content.innerHTML=''; content.appendChild(wrap);

  content.querySelectorAll('button[data-approve]').forEach(btn=>btn.onclick=async()=>{ const key=btn.dataset.approve; const p=await idb.get('projects', user.email); p.stages[key].completed=!p.stages[key].completed; await idb.put('projects', p); openStudentModal(user,p); renderTeacherList(); });
  content.querySelectorAll('button[data-return]').forEach(btn=>btn.onclick=async()=>{ const key=btn.dataset.return; const sub=await getSubmission(user.email, key); if(!sub) return alert('No submission to return.'); sub.status='returned'; await idb.put('submissions', sub); renderWorksheetInto(user.email,key,'ws-answers-'+key,'ws-status-'+key); });
  content.querySelectorAll('textarea[data-fb]').forEach(txt=>txt.onchange=async()=>{ const key=txt.dataset.fb; const p=await idb.get('projects', user.email); p.stages[key].feedback=txt.value; await idb.put('projects', p); });
  content.querySelectorAll('button[data-cmt]').forEach(btn=>btn.onclick=async()=>{ const key=btn.dataset.cmt; const input=$('#cmt-input-'+key); await addComment(user.email, key, 'teacher', session.name, input.value.trim()); input.value=''; renderCommentsInto(user.email, key, 'comments-'+key); });

  for (const s of STAGES){ renderWorksheetInto(user.email, s.key, 'ws-answers-'+s.key, 'ws-status-'+s.key); renderCommentsInto(user.email, s.key, 'comments-'+s.key); }
  dlg.showModal();
}

function rubricHTML(stage, st){
  const rows = stage.rubric.map(k=>{
    const score=st?.rubric?.[k]??0;
    return `<tr><td>${k}</td><td><select data-rubric="${stage.key}" data-crit="${k}">${[0,1,2,3,4].map(v=>`<option value="${v}" ${v===score?'selected':''}>${v}</option>`).join('')}</select></td></tr>`;
  }).join('');
  return `<table class="rubric"><thead><tr><th>Criterion</th><th>Score (0–4)</th></tr></thead><tbody>${rows}</tbody></table>
  <p><strong>Total:</strong> <span id="rubric-total-${stage.key}">${st?.score||0}</span> &nbsp; <strong>Badge:</strong> <span id="rubric-badge-${stage.key}">${st?.badge||'—'}</span></p>
  <div class="badges"><button class="secondary" data-calc="${stage.key}">Recalculate</button></div>`;
}

document.addEventListener('change', async (e)=>{
  const sel=e.target.closest('select[data-rubric]'); if(!sel) return;
  const stageKey=sel.dataset.rubric, crit=sel.dataset.crit;
  const name=$('#studentModalTitle').textContent.replace('Review: ','').trim();
  const users=await idb.getAll('users'); const u=users.find(x=>x.name===name); if(!u) return;
  const p=await idb.get('projects', u.email); p.stages[stageKey].rubric=p.stages[stageKey].rubric||{}; p.stages[stageKey].rubric[crit]=Number(sel.value); await idb.put('projects', p);
});
document.addEventListener('click', async (e)=>{
  const btn=e.target.closest('button[data-calc]'); if(!btn) return;
  const stageKey=btn.dataset.calc; const name=$('#studentModalTitle').textContent.replace('Review: ','').trim();
  const users=await idb.getAll('users'); const u=users.find(x=>x.name===name); if(!u) return;
  const p=await idb.get('projects', u.email); const st=p.stages[stageKey]; const total=Object.values(st.rubric||{}).reduce((a,b)=>a+b,0);
  st.score=total; st.badge= total>=10?'Gold ⭐': total>=7?'Silver 🥈': total>=4?'Bronze 🥉':''; await idb.put('projects', p);
  $('#rubric-total-'+stageKey).textContent=String(total); $('#rubric-badge-'+stageKey).textContent=st.badge||'—';
});

async function addComment(email, stage, authorRole, author, text){ if(!text)return; const rec={id:crypto.randomUUID(), email, stage, authorRole, author, text, ts:Date.now()}; await idb.put('comments', rec); }
async function renderCommentsInto(email, stage, elemId){
  const all=await idb.getAll('comments'); const list=all.filter(c=>c.email===email && c.stage===stage).sort((a,b)=>a.ts-b.ts);
  const box=document.getElementById(elemId); if(!box) return; box.innerHTML = list.map(c=>`<div class="card-row"><div><strong>${c.authorRole==='teacher'?'👩‍🏫':'🧑‍🎓'} ${escapeHTML(c.author)}</strong><br><small>${new Date(c.ts).toLocaleString()}</small></div><div>${escapeHTML(c.text)}</div></div>`).join('') || '<p class="muted">No comments yet.</p>';
}

async function exportCSV(){
  const users=(await idb.getAll('users')).filter(u=>u.role==='student');
  const rows=[['Name','Email',...STAGES.map(s=>s.name+' Complete'),...STAGES.map(s=>s.name+' Score'),...STAGES.map(s=>s.name+' Badge')]];
  for (const u of users){ const p=await ensureProject(u.email); rows.push([u.name,u.email, ...STAGES.map(s=>p.stages[s.key].completed?'Yes':'No'), ...STAGES.map(s=>p.stages[s.key].score||0), ...STAGES.map(s=>p.stages[s.key].badge||'')]); }
  const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n'); downloadFile('media-lab-progress.csv','text/csv',csv);
}

// -------- Student --------
async function showStudent(){ show('student'); const proj=await ensureProject(session.email); renderStages(proj); updateOverall(proj); }
function stageResourceLink(sKey, settings){
  const map={development:'dev',preproduction:'pre',production:'pro',postproduction:'post'};
  const fileMap={development:'devFileId',preproduction:'preFileId',production:'proFileId',postproduction:'postFileId'};
  const nameMap={development:'devFileName',preproduction:'preFileName',production:'proFileName',postproduction:'postFileName'};
  const url=(settings?.[map[sKey]]||'').trim();
  const fileId=settings?.[fileMap[sKey]]||'';
  const label = settings?.[nameMap[sKey]] ? `Open ${settings[nameMap[sKey]]}` : 'Open worksheet/slides';
  if (fileId){
    return `<a class="secondary" data-asset-link="${fileId}" data-asset-label="${label}">${label}</a>` + (url?` <a class="secondary" href="${url}" target="_blank" rel="noopener">Open (URL)</a>`:'');
  }
  return url?`<a class="secondary" href="${url}" target="_blank" rel="noopener">${label}</a>`:'';
}
async function renderStages(proj){
  const box=$('#stagesContainer'); box.innerHTML=''; const res=await idb.get('settings','resources');
  for (const s of STAGES){
    const st=proj.stages[s.key]; const sub=await getSubmission(session.email, s.key); const status=sub?.status||'draft';
    const div=document.createElement('div'); div.className='card stage-card';
    div.innerHTML = `
      <h4>${s.emoji} ${s.name} ${st.badge?`<span class='badge'>${st.badge}</span>`:''}</h4>
      ${/* async block follows */ ''}
      <div id="res-${s.key}"></div><div class="stage-actions">
        <button data-open="${s.key}">Open Worksheet</button>
        <button data-submit="${s.key}" class="secondary"${status==='submitted'?' disabled':''}>${status==='submitted'?'Submitted':'Submit for review'}</button>
        <button data-complete="${s.key}" class="${st.completed?'secondary':''}">${st.completed?'Mark incomplete':'Mark complete'}</button>
      </div>
      <label>My notes<textarea data-notes="${s.key}" placeholder="Write or paste your notes…">${st.notes||''}</textarea></label>
      <div class="uploads" id="uploads-${s.key}"></div>
      <div class="file-preview" id="preview-${s.key}"></div>
      <details open><summary><strong>Comments</strong></summary>
        <div id="cbox-${s.key}" class="list"></div>
        <div id="res-${s.key}"></div><div class="stage-actions"><input id="cmt-${s.key}" placeholder="Write a comment…"/><button data-stucmt="${s.key}">Send</button></div>
      </details>
      <p class="muted"><strong>Worksheet status:</strong> <span id="st-status-${s.key}">${status}</span></p>
    `;
    await addGuidance(div, s.key); box.appendChild(div);
  }
  box.querySelectorAll('textarea[data-notes]').forEach(t=>t.onchange=async()=>{ const p=await idb.get('projects', session.email); p.stages[t.dataset.notes].notes=t.value; await idb.put('projects', p); });
  box.querySelectorAll('button[data-complete]').forEach(btn=>btn.onclick=async()=>{ const key=btn.dataset.complete; const p=await idb.get('projects', session.email); p.stages[key].completed=!p.stages[key].completed; await idb.put('projects', p); renderStages(p); updateOverall(p); });
  box.querySelectorAll('button[data-open]').forEach(b=>b.onclick=()=>openWorksheet(b.dataset.open));
  box.querySelectorAll('button[data-submit]').forEach(b=>b.onclick=()=>submitWorksheet(b.dataset.submit));
  box.querySelectorAll('button[data-stucmt]').forEach(btn=>btn.onclick=async()=>{ const key=btn.dataset.stucmt; const input=$('#cmt-'+key); await addComment(session.email, key, 'student', session.name, input.value.trim()); input.value=''; renderCommentsInto(session.email, key, 'cbox-'+key); });
  for (const s of STAGES){ await renderUploads(s.key); await renderPreviews(s.key); await renderCommentsInto(session.email, s.key, 'cbox-'+s.key); }
  // Hydrate resource blocks
  for (const s of STAGES){ const el = document.getElementById('res-'+s.key); if (!el) continue; const html = await stageResourceBlock(s.key, res); el.innerHTML = html; }
  (async ()=>{ // hydrate asset links after resource blocks
  for (const el of document.querySelectorAll('[data-asset-link]')){ const id = el.getAttribute('data-asset-link'); const label = el.getAttribute('data-asset-label'); const href = await getAssetURL(id); if (href){ el.setAttribute('href', href); el.setAttribute('target','_blank'); el.setAttribute('rel','noopener'); el.textContent = label; } } })();
}

async function openWorksheet(stage){
  const dlg=$('#worksheetDialog'); $('#wsTitle').textContent=`${STAGES.find(x=>x.key===stage).name} Worksheet`; $('#wsDesc').textContent='Fill the fields and click Save. When ready, submit from the dashboard.';
  const form=$('#wsForm'); form.innerHTML='';
  const existing=await getSubmission(session.email, stage);
  for (const field of WORKSHEETS[stage]){
    const wrap=document.createElement('label'); const val=existing?.data?.[field.id]||'';
    wrap.innerHTML=`${field.label}${field.required?' *':''}${field.type==='textarea'?`<textarea data-field="${field.id}" aria-label="${field.label}">${val}</textarea>`:`<input data-field="${field.id}" value="${val}" aria-label="${field.label}"/>`}`;
    form.appendChild(wrap);
  }
  const save=document.createElement('button'); save.type='button'; save.textContent='Save Draft'; save.className='secondary';
  save.onclick=async()=>{ const data={}; form.querySelectorAll('[data-field]').forEach(el=>data[el.dataset.field]=el.value.trim()); await saveSubmission(session.email, stage, data, existing?.status||'draft'); alert('Saved.'); $('#st-status-'+stage).textContent=(await getSubmission(session.email, stage))?.status||'draft'; };
  form.appendChild(save);
  dlg.showModal();
}
async function submitWorksheet(stage){
  const sub=await getSubmission(session.email, stage);
  if (!sub || !validateSubmission(sub)) return alert('Please fill the required fields first.');
  sub.status='submitted'; sub.ts=Date.now(); await idb.put('submissions', sub); $('#st-status-'+stage).textContent='submitted';
}
function validateSubmission(sub){ const req=WORKSHEETS[sub.stage].filter(f=>f.required).map(f=>f.id); return req.every(k=>(sub.data?.[k]||'').trim().length>0); }

async function renderUploads(stage){
  const mine=(await idb.getAll('files')).filter(f=>f.email===session.email && f.stage===stage);
  const box=document.getElementById('uploads-'+stage); box.innerHTML=mine.length?'<strong>My uploads:</strong>':'';
  mine.forEach(f=>{ const url=URL.createObjectURL(f.blob); const a=document.createElement('a'); a.href=url; a.download=f.name; a.textContent=`• ${f.name}`; box.appendChild(a); });
}
async function renderPreviews(stage){
  const mine=(await idb.getAll('files')).filter(f=>f.email===session.email && f.stage===stage);
  const box=document.getElementById('preview-'+stage); box.innerHTML='';
  for (const f of mine){
    const url=URL.createObjectURL(f.blob);
    if (f.type.startsWith('image/')){ const img=document.createElement('img'); img.src=url; img.alt=f.name; box.appendChild(img); }
    else if (f.type==='application/pdf'){ const obj=document.createElement('object'); obj.data=url; obj.type='application/pdf'; obj.textContent='PDF preview'; box.appendChild(obj); }
    else if (f.type==='video/mp4'){ const v=document.createElement('video'); v.src=url; v.controls=true; box.appendChild(v); }
    else { const a=document.createElement('a'); a.href=url; a.textContent=f.name; box.appendChild(a); }
  }
}

// Guardian
async function showGuardian(){
  show('guardian');
  const email=session.guardianOf; if(!email){ $('#guardianContent').innerHTML='<p>Please ask admin to link you to a student account.</p>'; return; }
  const user=await idb.get('users', email); if(!user){ $('#guardianContent').innerHTML='<p>Linked student not found.</p>'; return; }
  const proj=await ensureProject(email); const pct=progressPercent(proj);
  const wrap=document.createElement('div'); wrap.className='card'; wrap.innerHTML=`<h3>Student: ${escapeHTML(user.name)} (${escapeHTML(user.email)})</h3><div class="progress" style="width:300px"><div style="width:${pct}%"></div></div><small>${pct}% complete</small>`;
  $('#guardianContent').innerHTML=''; $('#guardianContent').appendChild(wrap);
  for (const s of STAGES){ const st=proj.stages[s.key]; const sub=await getSubmission(email, s.key); const sec=document.createElement('div'); sec.className='card'; sec.innerHTML=`<h4>${s.emoji} ${s.name} ${st.completed?'✅':''} ${st.badge?`<span class='badge'>${st.badge}</span>`:''}</h4><p><strong>Worksheet:</strong> ${sub?escapeHTML(sub.status):'—'}</p><p><strong>Teacher feedback:</strong> ${escapeHTML(st.feedback||'—')}</p>`; $('#guardianContent').appendChild(sec); }
}

// Teacher modal worksheet renderer
async function renderWorksheetInto(email, stage, elemId, statusId){
  const sub = await getSubmission(email, stage);
  const box = document.getElementById(elemId);
  const status = document.getElementById(statusId);
  if (status) status.textContent = sub ? (sub.status || 'draft') : 'Not started';
  if (!box) return;
  if (!sub){ box.innerHTML = '<p class="muted">No submission yet.</p>'; return; }
  const fields = (WORKSHEETS[stage] || []);
  box.innerHTML = fields.map(f=>`<p><strong>${f.label}:</strong><br>${escapeHTML(sub.data?.[f.id]||'—')}</p>`).join('');
}

// Certificate
async function generateCertificate(){
  const proj=await ensureProject(session.email);
  const allDone=STAGES.every(s=>proj.stages[s.key].completed);
  if (!allDone) return alert('Complete all stages first.');
  const total=STAGES.map(s=>proj.stages[s.key].score||0).reduce((a,b)=>a+b,0);
  const badge = total>=40?'Gold ⭐': total>=28?'Silver 🥈': total>=16?'Bronze 🥉':'Participant';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Certificate</title>
    <style>body{font-family:Arial,sans-serif;padding:40px;text-align:center}.card{border:6px solid #ffcc00;padding:40px;border-radius:20px}
    h1{font-size:40px;margin:0 0 10px} h2{margin:6px 0} .muted{color:#555}</style></head>
    <body onload="window.print()"><div class="card"><h1>Oak Hill Media Lab</h1><h2>Certificate of Completion</h2>
    <p>This certifies that</p><h2><strong>${escapeHTML(session.name)}</strong></h2>
    <p class="muted">has successfully completed the Filmmaking Project (Development → Post-Production).</p>
    <p><strong>Total Score:</strong> ${total} &nbsp; <strong>Award:</strong> ${badge}</p>
    <p>Date: ${new Date().toLocaleDateString()}</p></div></body></html>`;
  const w=window.open('about:blank','_blank'); w.document.write(html); w.document.close();
}

// Helpers
async function ensureProject(email){ let p=await idb.get('projects', email); if(!p){ p={id:email, stages:Object.fromEntries(STAGES.map(s=>[s.key,{completed:false, notes:'', feedback:'', rubric:{}, score:0, badge:''}]))}; await idb.put('projects', p); } return p; }
async function getSubmission(email, stage){ const all=await idb.getAll('submissions'); return all.find(s=>s.email===email && s.stage===stage)||null; }
async function saveSubmission(email, stage, data, status='draft'){ const existing=await getSubmission(email, stage); const rec=existing||{id:crypto.randomUUID(), email, stage, status:'draft', data:{}, ts:Date.now()}; rec.data=data; rec.status=status; rec.ts=Date.now(); await idb.put('submissions', rec); return rec; }
function progressPercent(proj){ const total=STAGES.length; const done=STAGES.filter(s=>proj.stages[s.key].completed).length; return Math.round((done/total)*100); }
function updateOverall(proj){ const pct=progressPercent(proj); $('#progressFill').style.width=pct+'%'; $('#progressText').textContent=`${pct}% complete`; }
function hash(str){ let h=0; for(let i=0;i<str.length;i++){ h=((h<<5)-h)+str.charCodeAt(i); h|=0; } return String(h); }
function escapeHTML(s){ return String(s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]||c)); }
function downloadFile(name, type, data){ const blob=new Blob([data],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); }


function embedVideoHTML(url){
  if(!url) return '';
  const u = url.trim();
  try {
    const yt = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/.exec(u);
    if (yt) return `<div class="card"><div class="file-preview"><iframe width="100%" height="360" src="https://www.youtube.com/embed/${yt[1]}" title="Video" frameborder="0" allowfullscreen></iframe></div></div>`;
    const vm = /vimeo\.com\/(\d+)/.exec(u);
    if (vm) return `<div class="card"><div class="file-preview"><iframe src="https://player.vimeo.com/video/${vm[1]}" width="100%" height="360" frameborder="0" allow="fullscreen" allowfullscreen></iframe></div></div>`;
  } catch {}
  // Fallback: plain link
  return `<a class="secondary" href="${u}" target="_blank" rel="noopener">Open Video</a>`;
}

async function fileButtonHTML(id, label, ico){
  const href = await getAssetURL(id);
  if (!href) return '';
  return `<a class="btn" href="${href}" target="_blank" rel="noopener"><span class="ico">${ico}</span><span>${label}</span></a>`;
}
function thumbHTML(kind, name){
  const icon = kind==='word'?'🗒️': kind==='pdf'?'📄':'📊';
  return `<span class="thumb"><span class="ico">${icon}</span><span class="fn">${name}</span></span>`;
}
async function stageResourceBlock(stageKey, settings){
  const prefix = stageKey==='development'?'dev': stageKey==='preproduction'?'pre': stageKey==='production'?'pro':'post';
  const wordId  = settings?.[prefix+'WordId'];  const wordName = settings?.[prefix+'WordName'];
  const pdfId   = settings?.[prefix+'PdfId'];   const pdfName  = settings?.[prefix+'PdfName'];
  const pptxId  = settings?.[prefix+'PptxId'];  const pptxName = settings?.[prefix+'PptxName'];
  const videoUrl= settings?.[prefix+'VideoUrl'];
  const extra   = settings?.[prefix] || '';

  const pieces = [];
  // Thumbnails row
  const thumbs = [];
  if (wordId) thumbs.push(thumbHTML('word', wordName||'Word file'));
  if (pdfId)  thumbs.push(thumbHTML('pdf',  pdfName ||'PDF file'));
  if (pptxId) thumbs.push(thumbHTML('pptx', pptxName||'PPTX file'));
  if (thumbs.length) pieces.push(`<div class="resource-bar">${thumbs.join(' ')}</div>`);

  // Buttons row
  const btns = [];
  if (videoUrl) btns.push(`${embedVideoHTML(videoUrl)}`);
  if (wordId)  btns.push(await fileButtonHTML(wordId,  (wordName?('Word: '+wordName):'Open Word'), '🗒️'));
  if (pdfId)   btns.push(await fileButtonHTML(pdfId,   (pdfName ?('PDF: '+pdfName) :'Open PDF'),  '📄'));
  if (pptxId)  btns.push(await fileButtonHTML(pptxId,  (pptxName?('PPTX: '+pptxName):'Open PPTX'),'📊'));
  if (extra.trim()) btns.push(`<a class="btn secondary" href="${extra.trim()}" target="_blank" rel="noopener"><span class="ico">🔗</span><span>INTO FILM Source</span></a>`);

  // Zip button (gathers whatever exists)
  const any = [wordId,pdfId,pptxId].filter(Boolean);
  if (any.length){
    const zipBtn = `<button class="btn btn-zip" data-zip-stage="${stageKey}"><span class="ico">🗂️</span><span>Download all stage resources (.zip)</span></button>`;
    btns.push(zipBtn);
  }

  if (!btns.length && !thumbs.length) return '';
  return `<div class="card"><strong>Stage Resources</strong><div class="resource-bar">${btns.join(' ')}</div></div>`;
}


// --- Minimal ZIP builder (stored/no compression) ---
function crc32(buf){
  let table = crc32.table;
  if (!table){
    table = new Uint32Array(256);
    for (let i=0;i<256;i++){
      let c=i;
      for (let k=0;k<8;k++) c = (c & 1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1);
      table[i]=c>>>0;
    }
    crc32.table = table;
  }
  let c = 0xFFFFFFFF;
  const u8 = new Uint8Array(buf);
  for (let i=0;i<u8.length;i++) c = table[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function strToU8(s){ return new TextEncoder().encode(s); }
function u32LE(n){ const b=new Uint8Array(4); new DataView(b.buffer).setUint32(0,n,true); return b; }
function u16LE(n){ const b=new Uint8Array(2); new DataView(b.buffer).setUint16(0,n,true); return b; }

async function buildZip(files){
  // files: [{name, blob}]
  const chunks = [];
  let offset = 0;
  const central = [];
  for (const f of files){
    const nameU8 = strToU8(f.name);
    const buf = await f.blob.arrayBuffer();
    const size = buf.byteLength;
    const crc = crc32(buf);
    // Local file header
    chunks.push(strToU8('PK\x03\x04'));
    chunks.push(u16LE(20)); // version needed
    chunks.push(u16LE(0));  // flags
    chunks.push(u16LE(0));  // method 0 = store
    chunks.push(u16LE(0));  // time
    chunks.push(u16LE(0));  // date
    chunks.push(u32LE(crc));
    chunks.push(u32LE(size));
    chunks.push(u32LE(size));
    chunks.push(u16LE(nameU8.length));
    chunks.push(u16LE(0)); // extra len
    chunks.push(nameU8);
    chunks.push(new Uint8Array(buf));
    central.push({nameU8, crc, size, offset});
    offset += 30 + nameU8.length + size;
  }
  const startCD = offset;
  for (const c of central){
    chunks.push(strToU8('PK\x01\x02'));
    chunks.push(u16LE(20)); // made by
    chunks.push(u16LE(20)); // version needed
    chunks.push(u16LE(0));  // flags
    chunks.push(u16LE(0));  // method
    chunks.push(u16LE(0));  // time
    chunks.push(u16LE(0));  // date
    chunks.push(u32LE(c.crc));
    chunks.push(u32LE(c.size));
    chunks.push(u32LE(c.size));
    chunks.push(u16LE(c.nameU8.length));
    chunks.push(u16LE(0)); // extra
    chunks.push(u16LE(0)); // comment
    chunks.push(u16LE(0)); // disk
    chunks.push(u16LE(0)); // int attr
    chunks.push(u32LE(0)); // ext attr
    chunks.push(u32LE(c.offset));
    chunks.push(c.nameU8);
  }
  const sizeCD = chunks.reduce((a,b)=>a + (b.byteLength||b.length||0), 0) - startCD;
  const endCD = startCD + sizeCD;
  // End of central directory
  chunks.push(strToU8('PK\x05\x06'));
  chunks.push(u16LE(0)); // disk
  chunks.push(u16LE(0)); // start disk
  chunks.push(u16LE(central.length));
  chunks.push(u16LE(central.length));
  chunks.push(u32LE(sizeCD));
  chunks.push(u32LE(startCD));
  chunks.push(u16LE(0)); // comment
  const total = new Uint8Array(chunks.reduce((a,b)=>a+(b.byteLength||b.length||0),0));
  let p=0;
  for (const c of chunks){ total.set(c, p); p += (c.byteLength||c.length||0); }
  return new Blob([total], {type:'application/zip'});
}


// Accessibility: theme/high-contrast toggle & skip link focus management
document.addEventListener('DOMContentLoaded', () => {
  const t = document.getElementById('themeToggle');
  if (t) {
    t.addEventListener('click', () => {
      document.body.classList.toggle('high-contrast');
      const on = document.body.classList.contains('high-contrast');
      t.setAttribute('aria-pressed', String(on));
    });
  }
  // Move focus to main when hash changes or after login navigation
  const main = document.getElementById('main');
  if (main) {
    window.addEventListener('hashchange', () => setTimeout(()=>{ main.focus(); }, 0));
  }
  // Announce page ready
  const live = document.getElementById('liveRegion');
  if (live) live.textContent = 'Media Lab ready';
});


// --- Accessibility: trap focus inside worksheet dialog and restore on close ---
(function(){
  const dlg = document.getElementById('worksheetDialog');
  if (!dlg) return;
  let lastFocused = null;

  function getFocusable(container){
    return Array.from(container.querySelectorAll([
      'a[href]','area[href]','input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])','textarea:not([disabled])','button:not([disabled])',
      'iframe','audio[controls]','video[controls]','[contenteditable]','[tabindex]:not([tabindex="-1"])'
    ].join(','))).filter(el=>el.offsetParent!==null || el === container);
  }

  function openDialog(){
    lastFocused = document.activeElement;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open','');
    const f = getFocusable(dlg);
    if (f.length) f[0].focus();
    document.addEventListener('keydown', onKeyDown, true);
  }

  function closeDialog(){
    if (dlg.open) dlg.close();
    document.removeEventListener('keydown', onKeyDown, true);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function onKeyDown(e){
    if (!dlg.open) return;
    if (e.key === 'Escape'){
      e.preventDefault();
      closeDialog();
      return;
    }
    if (e.key === 'Tab'){
      const f = getFocusable(dlg);
      if (!f.length) return;
      const idx = f.indexOf(document.activeElement);
      let next = idx;
      if (e.shiftKey){
        next = idx <= 0 ? f.length - 1 : idx - 1;
      } else {
        next = idx === f.length - 1 ? 0 : idx + 1;
      }
      f[next].focus();
      e.preventDefault();
    }
  }

  window.WSDialog = { open: openDialog, close: closeDialog };
  dlg.addEventListener('close', ()=>{
    document.removeEventListener('keydown', onKeyDown, true);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  });
})();

document.addEventListener('click', (e)=>{
  const t = e.target;
  if (t && t.matches('[data-open="worksheet"]')){ e.preventDefault(); if (window.WSDialog) window.WSDialog.open(); }
  if (t && t.matches('[data-close="worksheet"]')){ e.preventDefault(); if (window.WSDialog) window.WSDialog.close(); }
});


// ===============================
// Assignment, Feedback & Threads
// ===============================

function uid(prefix='id'){ return prefix + '_' + Math.random().toString(36).slice(2,9) + Date.now().toString(36); }
function fmtDate(ts){ const d = new Date(ts); return d.toLocaleString(); }
async function currentUser(){ return await idb.get('settings','currentUser') || { role:'student', email:'student@example.com', name:'Student' }; }
async function getUser(email){ return await idb.get('users', email) || { email, name: email.split('@')[0] }; }

const STAGE_LABELS = {
  development:'Development', preproduction:'Pre-Production', production:'Production', postproduction:'Post-Production'
};
const DEFAULT_RUBRIC = {
  development: ['Idea clarity','Character','Story structure'],
  preproduction: ['Storyboard detail','Shot plan','Roles & resources'],
  production: ['Camera & sound','Teamwork','Safety'],
  postproduction: ['Editing','Audio/titles','Reflection']
};

async function saveSubmission(stage, {note, files=[]}){
  const me = await currentUser();
  const s = {
    id: uid('sub'),
    stage,
    stageName: STAGE_LABELS[stage] || stage,
    owner: me.email,
    ownerName: me.name || me.email,
    note: (note||'').trim(),
    assets: [],
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  for (const f of files){
    const id = uid('asset');
    const bin = await f.arrayBuffer?.() ?? f;
    await idb.put('assets', { id, name: f.name || ('file_' + id), type: f.type || 'application/octet-stream', data: bin, createdAt: Date.now() });
    s.assets.push({ id, name: f.name, type: f.type });
  }
  await idb.put('submissions', s);
  announce('Submission created for ' + s.stageName);
  return s;
}
async function listMySubmissions(stage='all'){
  const me = await currentUser();
  const all = await idb.getAll('submissions');
  return all.filter(x=>x.owner===me.email && (stage==='all' || x.stage===stage)).sort((a,b)=>b.updatedAt - a.updatedAt);
}
async function listAllSubmissions({status='all', stage='all'}={}){
  const all = await idb.getAll('submissions');
  return all.filter(x=>(status==='all'||x.status===status) && (stage==='all'||x.stage===stage)).sort((a,b)=>b.updatedAt - a.updatedAt);
}
async function addComment(subId, text){
  const me = await currentUser();
  const c = { id: uid('c'), subId, by: me.email, byName: me.name || me.email, text: text.trim(), createdAt: Date.now() };
  await idb.put('comments', c);
  const sub = await idb.get('submissions', subId);
  if (sub && me.email !== sub.owner) pushNotice(sub.owner, `💬 New comment on ${sub.stageName} from ${me.name || me.email}`);
  return c;
}
async function getComments(subId){
  const all = await idb.getAll('comments');
  return all.filter(c=>c.subId===subId).sort((a,b)=>a.createdAt - b.createdAt);
}
async function saveFeedback(subId, {rubricMap, text, status, audioAssetId}){
  const me = await currentUser();
  const sub = await idb.get('submissions', subId);
  if (!sub) throw new Error('Submission not found');
  const fb = {
    id: uid('fb'), subId, by: me.email, byName: me.name || me.email,
    rubric: rubricMap, text: text.trim(), audioAssetId: audioAssetId || null, createdAt: Date.now()
  };
  await idb.put('comments', { id: fb.id, subId, by: fb.by, byName: fb.byName, text: `📝 Feedback: ${fb.text}`, createdAt: fb.createdAt });
  sub.status = status; sub.updatedAt = Date.now(); await idb.put('submissions', sub);
  if (me.email !== sub.owner) {
    const msg = status==='needs_changes' ? `🔄 Feedback: please improve your ${sub.stageName}` : `✅ Your ${sub.stageName} has been reviewed`;
    pushNotice(sub.owner, msg);
  }
  announce('Feedback saved'); return fb;
}
async function storeAudioBlob(blob){
  const id = uid('asset'); const ab = await blob.arrayBuffer();
  await idb.put('assets', { id, name: 'audio-' + id + '.webm', type: 'audio/webm', data: ab, createdAt: Date.now() });
  return id;
}
async function getAssetUrl(assetId){
  const a = await idb.get('assets', assetId); if (!a) return null;
  const blob = new Blob([a.data], { type: a.type||'application/octet-stream' });
  return URL.createObjectURL(blob);
}
async function pushNotice(email, message){
  const key = 'notices:' + email;
  const rec = (await idb.get('settings', key)) || { key, items: [] };
  rec.items.unshift({ id: uid('n'), message, createdAt: Date.now() });
  rec.items = rec.items.slice(0, 20);
  await idb.put('settings', rec);
}
async function pullNotices(){
  const me = await currentUser();
  const key = 'notices:' + me.email;
  const rec = (await idb.get('settings', key)) || { key, items: [] };
  return rec.items;
}
function announce(msg){
  const live = document.getElementById('liveRegion');
  if (live){ live.textContent = ''; setTimeout(()=> live.textContent = msg, 30); }
}


async function renderStudentStages(){
  // Map steps to pane ids
  var map = {
    development: 'stagePane-development',
    preproduction: 'stagePane-preproduction',
    production: 'stagePane-production',
    postproduction: 'stagePane-postproduction'
  };
  var stages = ['development','preproduction','production','postproduction'];
  for (var i=0;i<stages.length;i++){
    var st = stages[i];
    var hostId = map[st];
    var host = document.getElementById(hostId);
    if (!host) continue;
    // Build inline upload + history
    host.innerHTML = '';
    var up = document.createElement('div'); up.className = 'upload-row';
    var file = document.createElement('input'); file.type='file'; file.id='file-'+st; file.multiple = true; file.setAttribute('aria-label','Upload file for ' + (STAGE_LABELS[st]||st));
    var note = document.createElement('input'); note.type='text'; note.id='note-'+st; note.placeholder='Add a short note…';
    var btn  = document.createElement('button'); btn.className='btn'; btn.setAttribute('data-submit', st); btn.textContent='Submit';
    up.appendChild(file); up.appendChild(note); up.appendChild(btn);
    host.appendChild(up);

    var hist = document.createElement('div'); hist.className='history';
    var list = document.createElement('div'); list.className='list'; list.id='mine-'+st;
    var meta = document.createElement('div'); meta.className='meta'; meta.innerHTML = '<span id="count-'+st+'">0</span> previous submissions';
    hist.appendChild(meta); hist.appendChild(list);
    host.appendChild(hist);

    (function(st, file, note){
      btn.addEventListener('click', async function(){
        var files = Array.prototype.slice.call(file.files||[]);
        await saveSubmission(st, { note: note.value, files: files });
        note.value=''; await refreshStudentLists();
      });
    })(st, file, note);
  }
  await refreshStudentLists();
}

async function handleSaveFeedback(){
  const subId = FB_CTX.subId;
  const crits = Array.from(document.getElementById('fbRubric').querySelectorAll('.rubric-row'));
  const rubric = {};
  crits.forEach((row,i)=>{
    const label = row.firstElementChild.textContent.trim();
    const pick = row.querySelector('input[type=radio]:checked');
    rubric[label] = pick ? pick.value : '👍 Good';
  });
  const text = document.getElementById('fbText').value;
  const status = document.getElementById('fbStatus').value;
  await saveFeedback(subId, { rubricMap: rubric, text, status, audioAssetId: FB_CTX.audioId });
  await openThread(subId);
  if (document.getElementById('subFilter')) renderTeacherSubmissions();
  await refreshStudentLists();
  announce('Feedback saved.');
}
document.addEventListener('click', async (e)=>{
  const t = e.target;
  if (t && t.matches('[data-review]')){ e.preventDefault(); const id = t.getAttribute('data-review'); openFeedback(id); }
  if (t && t.matches('[data-open-thread]')){ e.preventDefault(); const id = t.getAttribute('data-open-thread'); await openFeedback(id); }
});
document.addEventListener('DOMContentLoaded', () => {
  renderStudentStages(); refreshStudentLists();
  document.getElementById('subFilter')?.addEventListener('change', renderTeacherSubmissions);
  document.getElementById('subStageFilter')?.addEventListener('change', renderTeacherSubmissions);
  renderTeacherSubmissions();
  document.getElementById('fbRecordBtn')?.addEventListener('click', toggleRecord);
  document.getElementById('fbSave')?.addEventListener('click', handleSaveFeedback);
  document.getElementById('fbSendReply')?.addEventListener('click', async ()=>{
    const txt = document.getElementById('fbReply').value.trim(); if (!txt) return;
    await addComment(FB_CTX.subId, txt);
    document.getElementById('fbReply').value = '';
    await openThread(FB_CTX.subId);
    await refreshStudentLists();
  });
});






// ---------- SEN Guided Mode & Progress (ASCII-safe) ----------
(function(){
  function make(el, cls, text){ var n=document.createElement(el); if(cls) n.className=cls; if(text!=null) n.textContent=text; return n; }
  function rowNode(sub){ var row=make('div','row'); var left=make('div',''); var title=make('div',''); var strong=make('strong','', sub.ownerName||sub.owner); title.appendChild(strong); title.appendChild(document.createTextNode(' • '+(sub.stageName||sub.stage))); left.appendChild(title); var meta=make('div','meta', new Date(sub.updatedAt||Date.now()).toLocaleString()+' • '+((sub.assets&&sub.assets.length)||0)+' file(s)'); var right=make('div','toolbar'); var review=make('button','btn','Review'); review.setAttribute('data-review', sub.id); var thread=make('button','btn secondary','Thread'); thread.setAttribute('data-open-thread', sub.id); right.appendChild(review); right.appendChild(thread); row.appendChild(left); row.appendChild(right); left.appendChild(meta); return row; }
  document.addEventListener('DOMContentLoaded', function(){
    (async function init(){
      var guided=document.getElementById('guidedMode'); var large=document.getElementById('largeText'); var tLarge=document.getElementById('tLargeText'); var tCompact=document.getElementById('tCompact');
      var me=(window.currentUser? await currentUser(): {email:'anon'}); var key='prefs:'+me.email; var saved=(await idb.get('settings', key))||{key:key,guided:true,largeText:false,tLarge:false,tCompact:false,checks:{}};
      function apply(){ document.body.classList.toggle('large-text', !!saved.largeText||!!saved.tLarge); document.body.classList.toggle('t-compact', !!saved.tCompact); if(guided) guided.checked=!!saved.guided; if(large) large.checked=!!saved.largeText; if(tLarge) tLarge.checked=!!saved.tLarge; if(tCompact) tCompact.checked=!!saved.tCompact; renderProgress(saved); window.renderQueues&&window.renderQueues(); }
      async function save(){ await idb.put('settings', saved); }
      if(guided) guided.addEventListener('change', async function(e){ saved.guided=!!e.target.checked; await save(); });
      if(large)  large.addEventListener('change',  async function(e){ saved.largeText=!!e.target.checked; await save(); apply(); });
      if(tLarge) tLarge.addEventListener('change', async function(e){ saved.tLarge=!!e.target.checked; await save(); apply(); });
      if(tCompact) tCompact.addEventListener('change', async function(e){ saved.tCompact=!!e.target.checked; await save(); apply(); });
      Array.prototype.forEach.call(document.querySelectorAll('.checklist input[type=checkbox]'), function(cb){ var stepEl=cb.closest('.step'); var step=stepEl&&stepEl.getAttribute('data-step')?stepEl.getAttribute('data-step'):'step'; var item=cb.getAttribute('data-check')||'item'; var ck='chk:'+step+':'+item; cb.checked=!!saved.checks[ck]; cb.addEventListener('change', async function(){ saved.checks[ck]=!!cb.checked; await save(); renderProgress(saved); }); });
      Array.prototype.forEach.call(document.querySelectorAll('[data-open-stage]'), function(btn){ btn.addEventListener('click', function(){ var a=document.getElementById('senSteps'); if(a&&a.scrollIntoView) a.scrollIntoView({behavior:'smooth',block:'start'}); }); });
      var tips={plan:'Say your idea in one sentence. Who is in your story? What happens first, next, last? You can record your voice.',prepare:'Draw or describe at least 3 scenes. Pick team jobs. List props and places.',film:'Safety first. Check tripod. Do a sound test. Film one short scene at a time.',edit:'Put clips in order. Add a title. Add credits. Listen for clear sound.'};
      Array.prototype.forEach.call(document.querySelectorAll('[data-help]'), function(btn){ btn.addEventListener('click', function(){ var k=btn.getAttribute('data-help'); alert(tips[k]||'Keep it simple and clear. Ask your teacher if you get stuck.'); }); });
      apply();
      async function renderProgress(savedPrefs){ var fill=document.getElementById('overallProgress'); var label=document.getElementById('progressLabel'); if(!fill||!label) return; var total=document.querySelectorAll('.checklist input[type=checkbox]').length||1; var checked=0; for(var k in (savedPrefs.checks||{})){ if(savedPrefs.checks[k]) checked++; } var pct=Math.round((checked/total)*70); var lists=window.listMySubmissions? await Promise.all(['development','preproduction','production','postproduction'].map(listMySubmissions)):[[],[],[],[]]; var flat=[]; lists.forEach(function(a){ flat=flat.concat(a); }); var reviewed=flat.filter(function(x){return x.status==='reviewed';}).length; var needs=flat.filter(function(x){return x.status==='needs_changes';}).length; var bonus=Math.min(30, reviewed*10 - needs*5); pct=Math.max(0, Math.min(100, pct+bonus)); fill.style.width=String(pct)+'%'; label.textContent=String(pct)+'% done • ' + (pct<40?'Great start!':(pct<80?'Keep going!':'Almost there!')); }
      window.renderQueues = window.renderQueues || function(){};
      window.renderProgress = function(){ renderProgress(saved); };
    })();
  });
})();

function initAccordionSteps(){
  var steps = Array.prototype.slice.call(document.querySelectorAll('.step'));
  steps.forEach(function(step, idx){
    var btn = step.querySelector('.step-toggle');
    if (!btn) return;
    btn.setAttribute('aria-expanded','false');
    step.setAttribute('aria-expanded','false');
    btn.addEventListener('click', function(){
      var expanded = step.getAttribute('aria-expanded') === 'true';
      // collapse all
      steps.forEach(function(s){ s.setAttribute('aria-expanded','false'); var b=s.querySelector('.step-toggle'); if(b) b.setAttribute('aria-expanded','false'); });
      // expand current if it was collapsed
      if (!expanded){
        step.setAttribute('aria-expanded','true');
        btn.setAttribute('aria-expanded','true');
        // focus into the pane for keyboard users
        var pane = step.querySelector('.stage-pane'); if (pane) pane.setAttribute('tabindex','-1'), pane.focus();
      }
    });
    // Expand the first step by default
    if (idx===0){ step.setAttribute('aria-expanded','true'); btn.setAttribute('aria-expanded','true'); }
  });
}
document.addEventListener('DOMContentLoaded', function(){ initAccordionSteps(); });


// --- SEN Voice-to-Text for Worksheet fields ---
(function(){
  function getRecognition(lang){
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    try{
      var r = new SR();
      r.continuous = true;
      r.interimResults = true;
      r.lang = lang || 'en-GB';
      return r;
    }catch(e){ return null; }
  }
  function insertAtCursor(el, text){
    if (document.selection){ el.focus(); var sel = document.selection.createRange(); sel.text = text; }
    else if (typeof el.selectionStart === 'number'){
      var start = el.selectionStart, end = el.selectionEnd;
      var before = el.value.slice(0, start), after = el.value.slice(end);
      el.value = before + text + after;
      var pos = start + text.length;
      el.selectionStart = el.selectionEnd = pos;
    } else { el.value += text; }
  }

  var active = {}; // map textarea id -> recognition

  function startDictate(targetId, lang){
    if (active[targetId]) return; // already running
    var el = document.getElementById(targetId);
    if (!el) return;
    var rec = getRecognition(lang);
    if (!rec){ alert('Voice typing is not supported in this browser.'); return; }
    active[targetId] = rec;
    rec.onresult = function(e){
      var finalText = '';
      for (var i = e.resultIndex; i < e.results.length; i++){
        var res = e.results[i];
        var txt = res[0].transcript;
        if (res.isFinal) finalText += txt;
      }
      if (finalText){ insertAtCursor(el, finalText + ' '); }
    };
    rec.onerror = function(){ stopDictate(targetId); };
    rec.onend = function(){ stopDictate(targetId); };
    try{ rec.start(); }catch(err){ stopDictate(targetId); }
  }
  function stopDictate(targetId){
    var rec = active[targetId];
    if (rec){ try{ rec.stop(); }catch(e){} }
    delete active[targetId];
    var btn = document.querySelector('[data-voice-target="'+targetId+'"]');
    if (btn) btn.setAttribute('aria-pressed', 'false');
  }

  document.addEventListener('click', function(e){
    var t = e.target;
    if (t && t.matches('[data-voice-target]')){
      var id = t.getAttribute('data-voice-target');
      var wrap = t.closest('.voice-bar');
      var langSel = wrap ? wrap.querySelector('.voice-lang') : null;
      var lang = langSel ? langSel.value : 'en-GB';
      if (t.getAttribute('aria-pressed') === 'true'){
        stopDictate(id);
      } else {
        // stop any other active
        Object.keys(active).forEach(stopDictate);
        t.setAttribute('aria-pressed', 'true');
        startDictate(id, lang);
      }
    }
  });
})();
