// ==========================================================
// SNAKE & LADDER - CORE CONFIGURATION
// ==========================================================
let SNAKES={97:78,95:24,92:84,62:37,48:12,35:6,16:4};
let LADDERS={3:22,8:26,21:42,28:77,52:68,72:90,80:98};
const COLORS=['#00e5ff','#ff4081','#ffde59','#69f0ae'];
const EMOJIS=['🔵','🔴','🟡','🟢','🐵','🦁','🐯','🐱','🐶','🐺','🐻'];
const NAMES_DEF=['Biru','Merah','Kuning','Hijau'];

// ==========================================================
// GLOBAL STATE
// ==========================================================
let boardEl=document.getElementById('board'), players=[], turn=0, playing=false, moving=false, audioCtx, sixStreak=0, gameMode='mix', difficulty='normal', bossBotId=-1;
let winners=[], rareSpawns=[], isMuted=false, isLight=false;
let diceRuleStart='any', diceRuleSixRepeat=true, allowShared=true;
let diceRuleBounce=true; // true=MANTUL (bounce back), false=DIAM (stay)
let isDiceLocked=false, lastClickTime=0, lastRoll=0;
let cfg=null; // konfigurasi game yang sedang berjalan

// ==========================================================
// TIMER AMAN
// Semua timer game dicatat di sini, jadi saat "Ulang" semua
// timer lama dibersihkan tanpa trik clearTimeout 1..N.
// ==========================================================
const timers=new Set();
function later(fn,ms){ const id=setTimeout(()=>{ timers.delete(id); fn(); },ms); timers.add(id); return id; }
function every(fn,ms){ const id=setInterval(fn,ms); timers.add(id); return id; }
function stopTimer(id){ clearTimeout(id); clearInterval(id); timers.delete(id); }
function clearTimers(){ timers.forEach(id=>{ clearTimeout(id); clearInterval(id); }); timers.clear(); }

// ==========================================================
// BGM MENU 8-BIT SYSTEM
// ==========================================================
let bgmTimer = null;
let bgmNotes = [
  [262,0.35],[330,0.35],[392,0.35],[523,0.7],
  [392,0.35],[330,0.35],[262,0.7],
  [294,0.35],[330,0.35],[392,0.35],[440,0.7],
  [392,0.35],[330,0.35],[294,0.7],
  [0,0.2]
];
let bgmIdx = 0;
let bgmVolume = 0.09;
let bgmPercent = 50;

function playBgmNote(){
  if(isMuted) return;
  let mm = document.getElementById('mainMenu');
  if(mm && mm.classList.contains('hide')) return;
  let [f,d] = bgmNotes[bgmIdx];
  if(f>0) tone(f, d, 'sine', bgmVolume, 5);
  bgmIdx = (bgmIdx+1) % bgmNotes.length;
}
function startMenuBgm(){
  stopMenuBgm();
  bgmIdx=0;
  initAudio();
  if(bgmPercent==0) return;
  bgmTimer = setInterval(playBgmNote, 400);
}
function stopMenuBgm(){
  if(bgmTimer){ clearInterval(bgmTimer); bgmTimer=null; }
}

// ==========================================================
// VOLUME MANAGEMENT
// ==========================================================
function setBgmVolumePercent(p){
  bgmPercent = p;
  bgmVolume = (p / 100) * 0.25;
  let label = document.getElementById('volLabel');
  if(label) label.textContent = p + '%';
  let slider = document.getElementById('volSlider');
  if(slider) slider.value = p;
  if(p==0) stopMenuBgm();
  else {
    let mm = document.getElementById('mainMenu');
    if(mm &&!mm.classList.contains('hide') &&!bgmTimer){
      startMenuBgm();
    }
  }
  try{ localStorage.setItem('bgmVol', p); }catch(e){}
}

// ==========================================================
// AUDIO ENGINE
// ==========================================================
function initAudio(){ if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)(); }
function tone(f,d,t='sine',v=0.2,s=0){
 if(isMuted) return;
 initAudio();
 if(audioCtx.state==='suspended') audioCtx.resume();
 const o=audioCtx.createOscillator(), g=audioCtx.createGain();
 o.connect(g); g.connect(audioCtx.destination);
 o.type=t; o.frequency.setValueAtTime(f,audioCtx.currentTime);
 if(s) o.frequency.linearRampToValueAtTime(f+s,audioCtx.currentTime+d);
 g.gain.setValueAtTime(v,audioCtx.currentTime);
 g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+d);
 o.start(); o.stop(audioCtx.currentTime+d);
}

// ==========================================================
// SOUND EFFECTS (SFX)
// ==========================================================
function sfx(k){
 if(isMuted) return;
 let master = bgmPercent / 100;
 if(master==0) return;

 if(k==='click'){
  let now=Date.now();
  if(now-lastClickTime<90) return;
  lastClickTime=now;
  tone(900,0.07,'sine',0.12 * master);
  return;
 }
 if(k==='dice'){ tone(180,0.12,'square',0.22*master); setTimeout(()=>tone(420,0.1,'sine',0.18*master),70);}
 if(k==='step') tone(480+Math.random()*200,0.1,'sine',0.13*master,60);
 if(k==='ladder'){ tone(300,0.13,'sine',0.22*master); setTimeout(()=>tone(520,0.13,'sine',0.22*master),100); setTimeout(()=>tone(880,0.26,'sine',0.28*master),210);}
 if(k==='snake'){ tone(680,0.12,'sawtooth',0.2*master,-350); setTimeout(()=>tone(260,0.26,'sawtooth',0.2*master),120);}
 if(k==='win'){ tone(400,0.16,'sine',0.28*master,80); setTimeout(()=>tone(600,0.16,'sine',0.28*master,80),140); setTimeout(()=>tone(900,0.45,'sine',0.32*master),280);}
 if(k==='bust'){ tone(150,0.4,'sawtooth',0.25*master);}
 if(k==='kick'){ tone(800,0.08,'square',0.3*master); setTimeout(()=>tone(120,0.35,'sawtooth',0.35*master,-100),80); }
 if(k==='no'){ tone(100,0.2,'square',0.15*master); }
 if(k==='rare'){ tone(200,0.2,'sine',0.3*master,400); setTimeout(()=>tone(600,0.2,'sine',0.3*master,300),150); setTimeout(()=>tone(900,0.5,'sine',0.4*master),300); }
}

// ==========================================================
// <CORE>  LOGIKA MURNI (tanpa DOM) - dipakai game & simulasi uji
// ==========================================================

// Angka acak seragam 0..1 (crypto bila ada, supaya tidak bisa "ditebak")
function rand(){
  try{ const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]/4294967296; }
  catch(e){ return Math.random(); }
}
function randInt(a,b){ return Math.floor(rand()*(b-a+1))+a; }

// ---------- Papan acak ----------
function generateRandomBoard(){
 const used=new Set(); const newLadders={}; const newSnakes={}; rareSpawns=[];
 used.add(1); used.add(100);
 let tries=0;
 while(Object.keys(newLadders).length<7 && tries<1000){
  tries++; const bottom=randInt(2,68); const top=randInt(bottom+12, Math.min(98, bottom+45));
  if(top>=100) continue; if(used.has(bottom) || used.has(top)) continue; if(newLadders[bottom]) continue;
  newLadders[bottom]=top; used.add(bottom); used.add(top);
 }
 tries=0;
 while(Object.keys(newSnakes).length<7 && tries<1000){
  tries++; const head=randInt(24,97); const tail=randInt(Math.max(2, head-45), head-12);
  if(tail>=head || tail<=1) continue; if(used.has(head) || used.has(tail)) continue; if(newSnakes[head]) continue;
  newSnakes[head]=tail; used.add(head); used.add(tail);
 }
 if(Object.keys(newLadders).length===7 && Object.keys(newSnakes).length===7){ LADDERS=newLadders; SNAKES=newSnakes; }
 // Rare: 0.5% tangga legend 1-10 -> 100
 if(rand() < 0.005){
   let bottom = randInt(1,10);
   if(SNAKES[bottom]) delete SNAKES[bottom];
   LADDERS[bottom]=100;
   rareSpawns.push({type:'ladder', from:bottom, to:100});
 }
 // Rare: 5% ular terkutuk 95-99 -> 1-10
 if(rand() < 0.05){
   let head = randInt(95,99);
   let tail = randInt(1,10);
   if(LADDERS[head]) delete LADDERS[head];
   SNAKES[head]=tail;
   rareSpawns.push({type:'snake', from:head, to:tail});
 }
}

// ---------- Hasil satu langkah (dipakai animasi & simulasi) ----------
// Mengembalikan jalur kotak yang dilewati, kotak mendarat, posisi akhir
// (setelah tangga/ular), dan alasan gagal bila ada.
function resolveMove(pos,steps){
  const r={path:[],land:pos,final:pos,kind:null,fail:null,bounced:false,need:0,target:0};
  if(pos===0 && diceRuleStart==='need1' && steps!==1){ r.fail='need1'; return r; }
  const target=(pos===0)?steps:pos+steps; r.target=target;
  if(target>100){
    if(!diceRuleBounce){ r.fail='stay'; r.need=100-pos; return r; }
    const bounce=200-target; r.bounced=true;
    for(let c=pos+1;c<=100;c++) r.path.push(c);
    for(let c=99;c>=bounce;c--) r.path.push(c);
    r.land=bounce;
  } else {
    for(let c=(pos===0?1:pos+1);c<=target;c++) r.path.push(c);
    r.land=target;
  }
  r.final=r.land;
  if(LADDERS[r.land]){ r.final=LADDERS[r.land]; r.kind='ladder'; }
  else if(SNAKES[r.land]){ r.final=SNAKES[r.land]; r.kind='snake'; }
  return r;
}

// ---------- Dadu berbobot ----------
// luck = 0  -> dadu 100% seragam (adil, dipakai manusia vs manusia & mode normal)
// luck > 0  -> angka yang membawa maju / naik tangga / menang lebih sering muncul
// luck < 0  -> angka yang membawa mundur / kena ular / mentok lebih sering muncul
function rollWeighted(pos,luck,no6){
  if(!luck){ return no6? randInt(1,5) : randInt(1,6); }
  const w=[]; let tot=0;
  for(let k=1;k<=6;k++){
    if(no6 && k===6){ w.push(0); continue; }
    const r=resolveMove(pos,k);
    let u=(r.final-pos)+(r.final===100?25:0)+((pos===0&&r.final>0)?6:0);
    const x=Math.exp(luck*u/10); w.push(x); tot+=x;
  }
  let t=rand()*tot;
  for(let k=1;k<=6;k++){ t-=w[k-1]; if(t<=0 && w[k-1]>0) return k; }
  return no6?5:6;
}

// ---------- Tabel keberuntungan per tingkat kesulitan ----------
// Indeks = jumlah pemain. Nilai hasil kalibrasi simulasi (lihat uji).
const LUCK={
  2:{mixEasyHuman:0.121,mixEasyBot:-0.06,mixHardHuman:-0.102,mixHardBot:0.203,mixHardBoss:0.254,botHardBoss:0.206,botHardOthers:-0.103,rb:0.9,rbMax:1.2},
  3:{mixEasyHuman:0.151,mixEasyBot:-0.075,mixHardHuman:-0.096,mixHardBot:0.192,mixHardBoss:0.24,botHardBoss:0.229,botHardOthers:-0.115,rb:0.9,rbMax:1.2},
  4:{mixEasyHuman:0.148,mixEasyBot:-0.074,mixHardHuman:-0.091,mixHardBot:0.182,mixHardBoss:0.227,botHardBoss:0.236,botHardOthers:-0.118,rb:0.9,rbMax:1.2}
};
function luckFor(p){
  if(!cfg || cfg.mode==='human' || cfg.diff==='normal') return 0;
  const T=LUCK[Math.min(4,Math.max(2,players.length))];
  const isBot=(p.origType==='bot');
  if(cfg.mode==='mix'){
    if(cfg.diff==='easy') return isBot? T.mixEasyBot : T.mixEasyHuman;
    return isBot? (p.id===bossBotId? T.mixHardBoss : T.mixHardBot) : T.mixHardHuman;
  }
  // BOT vs BOT
  if(cfg.diff==='easy'){
    // semua bot setara & mudah saling kalahkan: yang tertinggal selalu bisa mengejar
    // (hanya yang tertinggal dibantu; pemimpin tidak dihukum supaya game pasti selesai)
    const alive=players.filter(x=>!x.win); if(!alive.length) return 0;
    const lead=Math.max.apply(null,alive.map(x=>x.pos));
    return Math.max(0,Math.min(T.rbMax,T.rb*(lead-p.pos)/15));
  }
  return p.id===bossBotId? T.botHardBoss : T.botHardOthers;
}

// ---------- Lempar dadu satu pemain ----------
// Aturan "tidak boleh 3x angka 6 beruntun" berlaku sama untuk semua pemain.
function getDice(p){
  let d=rollWeighted(p.pos,luckFor(p),false);
  if(d===6) sixStreak++; else sixStreak=0;
  if(sixStreak>=3){ d=rollWeighted(p.pos,luckFor(p),true); sixStreak=0; }
  return d;
}
// </CORE>

// ==========================================================
// DICE VISUAL
// ==========================================================
const diceMap={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
function pipsHTML(){ let s=''; for(let i=0;i<9;i++) s+='<div class="pip"></div>'; return s; }
function showDice(n,el){
  const els = el? [el] : allDice();
  els.forEach(e=>{
    if(!e) return;
    const pips=e.querySelectorAll('.pip');
    pips.forEach(p=>p.classList.remove('on'));
    (diceMap[n]||[]).forEach(i=>{ if(pips[i-1]) pips[i-1].classList.add('on'); });
  });
}

// ==========================================================
// BOARD RENDERER
// ==========================================================
function createBoard(){
 boardEl.innerHTML='';
 for(let row=0; row<10; row++){
  for(let col=0; col<10; col++){
   let r=row; let base=100-r*10; let n; if(r%2===0){ n=base-col; } else { n=base-9+col; }
   let d=document.createElement('div'); d.className='cell'; d.id='c'+n;
   let isRareL = rareSpawns.some(x=>x.type==='ladder' && x.from===n);
   let isRareS = rareSpawns.some(x=>x.type==='snake' && x.from===n);
   let lbl='';
   if(LADDERS[n]){ d.classList.add(isRareL?'rare-ladder':'ladder'); lbl=`<small>↑${LADDERS[n]}</small>`; }
   if(SNAKES[n]){ d.classList.add(isRareS?'rare-snake':'snake'); lbl=`<small>↓${SNAKES[n]}</small>`; }
   d.innerHTML=`<b>${n}</b>${lbl}`; boardEl.appendChild(d);
  }
 }
}

// ==========================================================
// RARE EVENT POPUP
// ==========================================================
function showRarePopup(){
 if(rareSpawns.length===0) return;
 let idx=0;
 function showOne(){
  if(idx>=rareSpawns.length) return;
  let r=rareSpawns[idx];
  let card=document.getElementById('rareCard');
  let inner=document.getElementById('rareInner');
  sfx('rare');
  if(r.type==='ladder'){
    card.className='rare-card ladder-bg';
    inner.innerHTML=`<div class="rare-icon">🪜✨</div><div class="rare-title gold">TANGGA LEGEND!</div><div class="rare-board" style="color:#ffde59;border:1px solid #ffde59">📍 ${r.from} → ${r.to}</div><br><br><button class="btn" onclick="closeRarePopup()">GASKAN! 🚀</button>`;
  } else {
    card.className='rare-card snake-bg';
    inner.innerHTML=`<div class="rare-icon">🐍💀</div><div class="rare-title red">Ular Terkutuk!</div><div class="rare-board" style="color:#ff8daa;border:1px solid #ff4081">📍 ${r.from} → ${r.to}</div><br><br><button class="btn" onclick="closeRarePopup()" style="background:linear-gradient(#ff4081,#ff1744);color:white">HATI-HATI! ⚠️</button>`;
  }
  document.getElementById('rarePopup').classList.add('show');
  idx++;
 }
 showOne();
 window._rareNext = ()=>{ if(idx<rareSpawns.length) showOne(); };
}
function closeRarePopup(){ document.getElementById('rarePopup').classList.remove('show'); if(window._rareNext && rareSpawns.length>1){ setTimeout(()=>{ if(window._rareNext){ let f=window._rareNext; window._rareNext=null; f(); } },400); } }

// ==========================================================
// DOM REFERENCES
// ==========================================================
let playersEl=document.getElementById('players'), logEl=document.getElementById('log'), logTopEl=document.getElementById('logTop'), diceEl=document.getElementById('dice');
let diceAreaEl=document.getElementById('diceArea');
let mm_pCount=document.getElementById('mm_pCount'), mm_mode=document.getElementById('mm_mode'), mm_diff=document.getElementById('mm_diff'), mm_diffWrap=document.getElementById('mm_diffWrap'), mm_nameSetup=document.getElementById('mm_nameSetup');
let mm_diceStart=document.getElementById('mm_diceStart'), mm_bounceRule=document.getElementById('mm_bounceRule'), mm_sixRepeat=document.getElementById('mm_sixRepeat'), mm_shared=document.getElementById('mm_shared');
diceEl.innerHTML=pipsHTML();

function esc(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function setLog(html){ logEl.innerHTML=html; if(logTopEl) logTopEl.innerHTML=html; }
function humanMode(){ return !!cfg && cfg.mode==='human'; }

// ==========================================================
// MAIN MENU NAME INPUT BUILDER
// ==========================================================
function buildMMNameInputs(){
  const c=+mm_pCount.value;
  mm_nameSetup.innerHTML='';
  mm_nameSetup.style.display='grid';
  mm_nameSetup.style.gridTemplateColumns='1fr';
  mm_nameSetup.style.gap='6px';
  mm_nameSetup.style.margin='8px 0';
  for(let i=0;i<c;i++){
    const box=document.createElement('div'); box.className='nameBox';
    const isBotDefault = (mm_mode.value==='bot') || (mm_mode.value==='mix' && i!==0);
    const defName = NAMES_DEF[i] + (isBotDefault? ' BOT' : '');
    box.innerHTML=`<input id="mm_inpName${i}" value="${defName}" maxlength="10" placeholder="Nama ${i+1}"><select id="mm_inpIcon${i}">${EMOJIS.map((em,j)=>`<option value="${j}" ${j===i?'selected':''}>${em}</option>`).join('')}</select><input type="color" id="mm_inpColor${i}" value="${COLORS[i]}" style="width:32px;height:28px;border:none;border-radius:8px;background:transparent">`;
    mm_nameSetup.appendChild(box);
  }
}

// ==========================================================
// MENU LABEL UPDATER + PENJELASAN MODE
// ==========================================================
function updateMMHint(){
  const el=document.getElementById('mm_hint'); if(!el) return;
  const m=mm_mode.value, d=mm_diff.value; let t='';
  if(m==='human') t='Setiap pemain punya dadu di sudut layarnya sendiri. Dadu hanya aktif saat gilirannya, semua pemain punya peluang yang sama.';
  else if(m==='mix') t = d==='easy'?'Mudah: manusia jauh lebih mudah menang dibanding BOT.' : d==='hard'?'Sulit: BOT sangat mudah menang dibanding manusia.' : 'Normal: manusia dan BOT punya peluang menang yang sama.';
  else t = d==='easy'?'Mudah: semua BOT saling mudah mengalahkan, hasil sulit ditebak.' : d==='hard'?'Sulit: satu BOT jagoan sangat mudah mengalahkan BOT lainnya.' : 'Normal: semua BOT punya peluang menang yang sama.';
  el.textContent=t;
}
function updateMenuLabels(){
  let sixOn=mm_sixRepeat.checked;
  document.getElementById('chkSix').classList.toggle('active', sixOn);
  document.getElementById('tagSix').textContent=sixOn?'AKTIF':'NONAKTIF';
  document.getElementById('tagSix').className='mm-tag '+(sixOn?'on':'off');
  let shareOn=mm_shared.checked;
  document.getElementById('chkShare').classList.toggle('active', shareOn);
  document.getElementById('tagShare').textContent=shareOn?'AKTIF':'NONAKTIF';
  document.getElementById('tagShare').className='mm-tag '+(shareOn?'on':'off');
  document.getElementById('tagTheme').textContent=isLight?'TERANG':'GELAP';
  document.getElementById('tagTheme').className='mm-tag '+(isLight?'on':'off');
  document.getElementById('tagMute').textContent=isMuted?'MUTE':'ON';
  document.getElementById('tagMute').className='mm-tag '+(isMuted?'off':'on');
  document.getElementById('tagTheme2').textContent=isLight?'TERANG':'GELAP';
  document.getElementById('tagTheme2').className='mm-tag '+(isLight?'on':'off');
  document.getElementById('tagMute2').textContent=isMuted?'MUTE':'ON';
  document.getElementById('tagMute2').className='mm-tag '+(isMuted?'off':'on');
  updateMMHint();
}

// ==========================================================
// EVENT LISTENERS MENU UTAMA
// ==========================================================
mm_pCount.addEventListener('change', ()=>{ sfx('click'); buildMMNameInputs(); updateMenuLabels(); });
mm_mode.addEventListener('change', ()=>{ sfx('click'); updateMMDiffVisibility(); buildMMNameInputs(); updateMenuLabels(); });
mm_diff.addEventListener('change', ()=>{ sfx('click'); updateMenuLabels(); });
mm_diceStart.addEventListener('change', ()=>{ sfx('click'); updateMenuLabels(); });
mm_bounceRule.addEventListener('change', ()=>{ sfx('click'); updateMenuLabels(); });
mm_sixRepeat.addEventListener('change', ()=>{ sfx('click'); updateMenuLabels(); });
mm_shared.addEventListener('change', ()=>{ sfx('click'); updateMenuLabels(); });

function updateMMDiffVisibility(){
 mm_diffWrap.style.display = (mm_mode.value==='human') ? 'none' : 'block';
}
updateMMDiffVisibility(); buildMMNameInputs(); updateMenuLabels();

// ==========================================================
// SETTINGS & CREDIT NAVIGATION
// ==========================================================
function openSettings(){ sfx('click'); updateMenuLabels(); document.getElementById('settingsPage').classList.add('show'); }
function closeSettings(){ sfx('click'); document.getElementById('settingsPage').classList.remove('show'); }
function openCredit(){ sfx('click'); document.getElementById('creditPage').classList.add('show'); }
function closeCredit(){ sfx('click'); document.getElementById('creditPage').classList.remove('show'); }
function openInGameSettings(){ sfx('click'); updateMenuLabels(); document.getElementById('menuPopup').classList.remove('show'); document.getElementById('inGameSettings').classList.add('show'); }
function closeInGameSettings(){ sfx('click'); document.getElementById('inGameSettings').classList.remove('show'); document.getElementById('menuPopup').classList.add('show'); }

// ==========================================================
// THEME & AUDIO TOGGLES
// ==========================================================
function toggleTheme(){ isLight=!isLight; document.body.classList.toggle('light', isLight); sfx('click'); updateMenuLabels(); }
function toggleMute(){
  isMuted=!isMuted;
  if(isMuted) stopMenuBgm();
  else {
    if(!document.getElementById('mainMenu').classList.contains('hide')){
      startMenuBgm();
    }
  }
  sfx('click'); updateMenuLabels();
}

// ==========================================================
// RESET TO DEFAULT SETTINGS
// ==========================================================
function resetDefault(){
 sfx('click');
 isLight=false; isMuted=false; document.body.classList.remove('light');
 mm_pCount.value='4'; mm_mode.value='mix'; mm_diff.value='normal'; mm_diceStart.value='any'; mm_bounceRule.value='bounce'; mm_sixRepeat.checked=true; mm_shared.checked=true;
 updateMMDiffVisibility(); buildMMNameInputs(); updateMenuLabels();
 setBgmVolumePercent(50);
 if(!document.getElementById('mainMenu').classList.contains('hide')){
   startMenuBgm();
 }
}

// ==========================================================
// START GAME FROM MAIN MENU
// ==========================================================
function startFromMenu(){
 sfx('click');
 stopMenuBgm();
 const n=+mm_pCount.value;
 const names=[], icons=[], colors=[];
 for(let i=0;i<n;i++){
   const nm=document.getElementById(`mm_inpName${i}`), ic=document.getElementById(`mm_inpIcon${i}`), co=document.getElementById(`mm_inpColor${i}`);
   names.push((nm&&nm.value.trim())? nm.value.trim() : NAMES_DEF[i]);
   icons.push(ic? parseInt(ic.value) : i);
   colors.push(co? co.value : COLORS[i]);
 }
 cfg={ n, mode:mm_mode.value, diff:(mm_mode.value==='human'?'normal':mm_diff.value), names, icons, colors };
 diceRuleStart=mm_diceStart.value;
 diceRuleSixRepeat=mm_sixRepeat.checked;
 diceRuleBounce=(mm_bounceRule.value==='bounce');
 allowShared=mm_shared.checked;
 document.getElementById('mainMenu').classList.add('hide');
 // Saat main: halaman dikunci, tidak bisa di-scroll (hanya menu utama yang bisa)
 document.documentElement.classList.add('in-game');
 document.body.classList.add('in-game');
 startGame();
}

// ==========================================================
// IN-GAME MENU HANDLERS
// ==========================================================
function diffLabel(){ return ({easy:'Mudah',normal:'Normal',hard:'Sulit'})[difficulty]||difficulty; }
function openMenu(){
  sfx('click');
  const modeMap={mix:'Manusia vs BOT', human:'Manusia vs Manusia', bot:'BOT vs BOT'};
  const modeName = modeMap[gameMode] || gameMode;
  const info = gameMode==='human' ? `Mode: ${modeName} | Menang: ${winners.length}/${players.length}` : `Mode: ${modeName} (${diffLabel()}) | Menang: ${winners.length}/${players.length}`;
  document.getElementById('menuInfo').textContent = info;
  document.getElementById('menuPopup').classList.add('show');
}
function closeMenu(){ sfx('click'); document.getElementById('menuPopup').classList.remove('show'); }
function restartSame(){
  sfx('click');
  closeMenu();
  document.getElementById('popup').classList.remove('show');
  startGame();
}

// ==========================================================
// DADU DI SUDUT LAYAR (khusus Manusia vs Manusia)
// Urutan searah jarum jam: kiri-bawah -> kiri-atas -> kanan-atas -> kanan-bawah.
// Dadu sisi atas diputar 180° supaya menghadap pemain yang duduk di atas.
// ==========================================================
const SEATS={2:['bl','tr'],3:['bl','tl','tr'],4:['bl','tl','tr','br']};
function buildCorners(){
  const box=document.getElementById('cornerDice'); box.innerHTML='';
  if(!humanMode()) return;
  const seats=SEATS[players.length];
  players.forEach((p,i)=>{
    const s=seats[i]; const el=document.createElement('div');
    el.className='cd seat-'+s+(s[0]==='t'?' flip':'');
    el.id='cd-'+p.id; el.style.setProperty('--pc',p.color);
    el.innerHTML=`<div class="cd-name"><span class="cd-ic" style="background:${p.color}">${p.icon}</span><b>${p.name}</b></div><div class="cd-sub" id="cd-sub-${p.id}">START</div><div class="dice cd-dice" id="dice-${p.id}" onclick="humanRoll(${p.id})">${pipsHTML()}</div>`;
    box.appendChild(el);
  });
}
function nudge(id){ const b=document.getElementById('cd-'+id); if(!b) return; b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); }

// ==========================================================
// GAME INITIALIZATION
// ==========================================================
function startGame(){
 clearTimers();
 isDiceLocked=false; moving=false; sixStreak=0; lastRoll=0;
 document.getElementById('animLine').innerHTML='';
 gameMode=cfg.mode; difficulty=cfg.diff;
 document.body.classList.toggle('mode-human', gameMode==='human');
 generateRandomBoard(); createBoard();
 players=[]; winners=[];
 for(let i=0;i<cfg.n;i++){
   let type; if(gameMode==='human') type='human'; else if(gameMode==='bot') type='bot'; else type=(i===0?'human':'bot');
   const icon = EMOJIS[cfg.icons[i]] || '';
   players.push({id:i,name:esc(cfg.names[i]),color:cfg.colors[i],icon:icon,type:type,origType:type,pos:0,win:false,rank:0,auto:false});
 }
 // BOT jagoan dipilih dari bot saja (bukan manusia)
 const botPool=players.filter(p=>p.origType==='bot');
 bossBotId = botPool.length? botPool[randInt(0,botPool.length-1)].id : -1;

 // Pemain pertama: diundi acak agar adil. Mode manusia vs BOT: mudah = manusia dulu, sulit = BOT dulu.
 if(gameMode==='mix' && difficulty==='easy') turn=0;
 else if(gameMode==='mix' && difficulty==='hard') turn=bossBotId;
 else turn=randInt(0,players.length-1);
 playing=true;

 buildCorners();
 diceAreaEl.classList.add('show'); document.getElementById('menuBtn').classList.add('show');
 render(); place(); showDice(1); updateLock();
 if(gameMode==='human') setLog(`🎲 ${players[turn].name} jalan duluan (diundi acak)`);
 if(rareSpawns.length>0) later(showRarePopup,600);
 if(isAutoPlayer(players[turn])) later(botRoll,900);
}

// ==========================================================
// PLAYER TYPE HELPERS
// ==========================================================
function isAutoPlayer(p){ return p.type==='bot' || p.auto; }
function toggleAuto(id) {
  if (moving || isDiceLocked) return;
  sfx('click');
  let p = players.find(x => x.id === id);
  if(!p || p.win) return;
  if(p.origType==='bot') return;
  p.auto=!p.auto;
  render();
  updateLock();
  if(isAutoPlayer(players[turn]) &&!moving) later(botRoll,500);
}

// ==========================================================
// DICE LOCK & TURN LOCK
// syncDice: hanya mengatur status dadu (tanpa menimpa log)
// ==========================================================
function diceElFor(p){ return humanMode()? document.getElementById('dice-'+p.id) : diceEl; }
function allDice(){ return humanMode()? players.map(p=>document.getElementById('dice-'+p.id)).filter(Boolean) : [diceEl]; }
function syncDice(){
  const cur=players[turn];
  const ok = playing && !moving && !isDiceLocked && cur && !cur.win && !isAutoPlayer(cur);
  if(humanMode()){
    players.forEach(p=>{
      const el=document.getElementById('dice-'+p.id); if(!el) return;
      const mine = !!cur && p.id===cur.id;
      el.classList.toggle('disabled', !(ok&&mine));
      const box=document.getElementById('cd-'+p.id);
      if(box) box.classList.toggle('on-turn', !!(playing && mine && !p.win));
    });
  } else {
    diceEl.classList.toggle('disabled', !ok);
    diceEl.classList.toggle('bot-turn', !!(playing && cur && !cur.win && isAutoPlayer(cur)));
  }
}
function updateLock(){
 if(!playing){ syncDice(); return; }
 let guard=0;
 while(players[turn].win && guard++<10){ turn=(turn+1)%players.length; }
 let cur=players[turn];
 if(cur.win){ checkGameOver(); return; }
 syncDice();
 if(moving) return;
 if(isAutoPlayer(cur)){
   setLog(`🤖 ${cur.name} ${cur.auto?'[AUTO]':''} jalan...`);
 } else if(cur.pos===0){
   setLog(diceRuleStart==='need1' ? `🎲 ${cur.name} butuh angka 1 untuk masuk!` : `🎲 ${cur.name} butuh lempar untuk masuk papan!`);
 } else {
   setLog(`🎲 Giliran <b style="color:${cur.color}">${cur.name}</b> - [${winners.length} finish]`);
 }
}

// ==========================================================
// PLAYER CARD RENDERER
// ==========================================================
function renderCards(){
 playersEl.innerHTML='';
 players.forEach((p,i)=>{
   let d=document.createElement('div');
   d.className='p-card'+(i===turn&&!p.win?' turn':'')+(p.win?' finished':'');
   let rankIcon=p.rank===1?'🥇':p.rank===2?'🥈':p.rank===3?'🥉':p.rank>0?'🏅':'';
   let autoBtn='';
   if(p.origType!=='bot' &&!p.win){
     autoBtn=`<button class="p-afk ${p.auto?'on':'off'}" onclick="toggleAuto(${p.id})">${p.auto?'ON':'OFF'}</button>`;
   } else if(p.origType==='bot'){
     autoBtn=`<button class="p-afk on" style="pointer-events:none">BOT</button>`;
   }
   d.innerHTML=`<div class="p-dot" style="background:${p.color}">${p.icon}</div><b>${p.name}${p.origType==='bot'?' 🤖':''}${rankIcon}</b><br><span>${p.win?'FINISH #'+p.rank:(p.pos===0?'START':p.pos)}</span>${autoBtn}`;
   playersEl.appendChild(d);
 });
}
function renderCorners(){
 players.forEach(p=>{
   const sub=document.getElementById('cd-sub-'+p.id); if(!sub) return;
   const box=document.getElementById('cd-'+p.id);
   const rankIcon=p.rank===1?'🥇':p.rank===2?'🥈':p.rank===3?'🥉':p.rank>0?'🏅':'';
   const mine=(players[turn].id===p.id && !p.win && playing);
   sub.textContent = p.win? `${rankIcon} FINISH #${p.rank}` : (mine && !moving && !isDiceLocked ? '🎲 LEMPAR!' : (p.pos===0?'START':'Kotak '+p.pos));
   if(box){ box.classList.toggle('finished',p.win); box.classList.toggle('on-turn',mine); }
 });
}
function render(){
 if(humanMode()) renderCorners(); else renderCards();
 document.querySelectorAll('.cell').forEach(c=>c.classList.remove('active'));
 let curCell=document.getElementById('c'+players[turn].pos);
 if(curCell &&!players[turn].win && players[turn].pos!==0) curCell.classList.add('active');
}

// ==========================================================
// PAWN PLACEMENT
// Posisi pion memakai persen kotak, jadi ikut mengecil/membesar mengikuti papan.
// ==========================================================
const SLOTS={1:[[50,60]],2:[[30,62],[70,62]],4:[[30,42],[70,42],[30,76],[70,76]]};
function place(){
 document.querySelectorAll('.pion').forEach(e=>e.remove());
 let g={}; players.forEach(p=>{if(p.win) return; if(p.pos===0) return; if(!g[p.pos]) g[p.pos]=[]; g[p.pos].push(p);});
 Object.keys(g).forEach(pos=>{
  let cell=document.getElementById('c'+pos); if(!cell) return;
  const list=g[pos]; const slots=SLOTS[list.length===1?1:list.length===2?2:4];
  list.forEach((p,idx)=>{
   let pion=document.createElement('div'); pion.className='pion'+(players[turn].id===p.id?' active':''); pion.id='pion-'+p.id; pion.style.background=p.color; pion.textContent=p.icon || (p.id+1);
   pion.style.left=slots[idx][0]+'%'; pion.style.top=slots[idx][1]+'%';
   pion.style.setProperty('--k', list.length===1? 0.62 : 0.46);
   cell.appendChild(pion);
  });
 });
}

// ==========================================================
// DICE ROLL
// ==========================================================
// id = pemilik dadu yang ditekan (mode manusia vs manusia). Tanpa id = dadu utama.
function humanRoll(id) {
  if (!playing || isDiceLocked || moving) { if(id!==undefined) sfx('no'); return; }
  const cur=players[turn];
  if (id!==undefined && id!==cur.id) { sfx('no'); nudge(id); return; } // bukan gilirannya
  if (isAutoPlayer(cur)) { sfx('no'); return; }
  doRoll();
}
function botRoll() {
  if (!playing || moving || isDiceLocked) return;
  if (!isAutoPlayer(players[turn])) return;
  doRoll();
}
function doRoll() {
  if (isDiceLocked || moving || !playing) return;
  const p=players[turn], el=diceElFor(p);
  isDiceLocked = true;
  moving = true;
  syncDice();
  renderCorners_ifHuman();
  el.classList.add('rolling');
  sfx('dice');
  let r = 0;
  const id = every(() => {
    showDice(randInt(1,6), el);
    if (++r > 12) {
      stopTimer(id);
      el.classList.remove('rolling');
      let d = getDice(p);
      showDice(d, el);
      lastRoll = d;
      moveStep(p, d);
    }
  }, 70);
}
function renderCorners_ifHuman(){ if(humanMode()) renderCorners(); }

// ==========================================================
// ANIMATION LINE
// ==========================================================
function drawLine(from,to,color){ let svg=document.getElementById('animLine'); svg.innerHTML=''; let fromEl=document.getElementById('c'+from), toEl=document.getElementById('c'+to); if(!fromEl||!toEl) return; let wrap=document.getElementById('boardWrap').getBoundingClientRect(); let f=fromEl.getBoundingClientRect(), t=toEl.getBoundingClientRect(); let x1=f.left + f.width/2 - wrap.left; let y1=f.top + f.height/2 - wrap.top; let x2=t.left + t.width/2 - wrap.left; let y2=t.top + t.height/2 - wrap.top; let line=document.createElementNS('http://www.w3.org/2000/svg','line'); line.setAttribute('x1',x1); line.setAttribute('y1',y1); line.setAttribute('x2',x2); line.setAttribute('y2',y2); line.setAttribute('stroke',color); line.setAttribute('stroke-width','5'); line.setAttribute('stroke-linecap','round'); line.setAttribute('stroke-dasharray','10 8'); line.style.animation='dashFlow 0.4s linear infinite'; line.style.filter=`drop-shadow(0 0 6px ${color})`; svg.appendChild(line); later(()=>{ svg.innerHTML=''; },1300); }

// ==========================================================
// MOVEMENT ENGINE (animasi mengikuti jalur dari resolveMove)
// ==========================================================
function walk(p,path,done){
  let i=0;
  if(!path.length){ done(); return; }
  const id=every(()=>{
    p.pos=path[i++]; render(); place(); sfx('step');
    if(i>=path.length){ stopTimer(id); done(); }
  },180);
}
function extraTurn(p,msg){
  moving=false; isDiceLocked=false;
  setLog(msg);
  syncDice(); render();
  if(isAutoPlayer(p)) later(botRoll,900);
}
function moveStep(p,steps){
 lastRoll=steps;
 const r=resolveMove(p.pos,steps);
 if(r.fail==='need1'){
   setLog(`${p.name} dapat ${steps} - butuh 1 untuk masuk!`); sfx('bust');
   later(()=>nextTurn(),700); return;
 }
 if(r.fail==='stay'){
   setLog(`Butuh ${r.need}! ${p.pos}+${steps}=${p.pos+steps} lewat, diam!`); sfx('bust');
   later(()=>{
     if(steps===6 && diceRuleSixRepeat) extraTurn(p,`🎉 Dapat 6! ${p.name} diam tapi lempar lagi! (butuh ${r.need})`);
     else nextTurn();
   },700);
   return;
 }
 if(r.bounced){ setLog(`Lewat 100! ${p.pos}+${steps}=${r.target} → mantul ${r.land}`); sfx('bust'); }
 else if(p.pos===0) setLog(`${p.name} masuk! dapat ${steps} → ${r.target}`);
 else setLog(`${p.name} dapat ${steps} → ${r.target}`);
 walk(p,r.path,()=>handleSnakeLadder(p));
}

// ==========================================================
// SNAKE & LADDER HANDLER
// ==========================================================
function handleSnakeLadder(p){
 if(LADDERS[p.pos]){ let to=LADDERS[p.pos]; setLog(`🪜 TANGGA! ${p.pos} → ${to} ⬆️`); sfx('ladder'); let from=document.getElementById('c'+p.pos); if(from) from.classList.add('anim-up'); drawLine(p.pos,to,'#69f0ae'); later(()=>{ p.pos=to; render(); place(); let dest=document.getElementById('c'+to); if(dest) dest.classList.add('anim-up'); later(()=>checkKick(p),500); },700); }
 else if(SNAKES[p.pos]){ let to=SNAKES[p.pos]; setLog(`🐍 ULAR! ${p.pos} → ${to} ⬇️`); sfx('snake'); let from=document.getElementById('c'+p.pos); if(from) from.classList.add('anim-down'); drawLine(p.pos,to,'#ff4081'); later(()=>{ p.pos=to; render(); place(); let dest=document.getElementById('c'+to); if(dest) dest.classList.add('anim-down'); later(()=>checkKick(p),500); },700); }
 else { checkKick(p); }
}

// ==========================================================
// KICK / SHARED TILE
// ==========================================================
function checkKick(p){
 if(allowShared){ finishAfterMove(p); return; }
 let victims=players.filter(o=>!o.win && o.id!==p.id && o.pos!==0 && o.pos===p.pos && o.pos!==100);
 if(victims.length>0){
  victims.forEach(v=>{ sfx('kick'); let vp=document.getElementById('pion-'+v.id); if(vp) vp.classList.add('kicked'); });
  setLog(`${p.name} NENDANG 💥 ${victims.map(v=>v.name).join(',')}!`);
  later(()=>{ victims.forEach(v=>v.pos=0); render(); place(); finishAfterMove(p); },600);
 } else { finishAfterMove(p); }
}

// ==========================================================
// FINISH & EXTRA TURN
// ==========================================================
function finishAfterMove(p){
 if(p.pos===100){
   p.win=true; p.rank=winners.length+1; winners.push(p); sfx('win');
   if(winners.length < players.length-1){
     setLog(`🏁 ${p.name} FINISH #${p.rank}! Sisa ${players.length-winners.length} pemain`);
     render(); place();
     later(()=>nextTurn(),800);
     return;
   } else {
     let loser=players.find(x=>!x.win);
     if(loser){ loser.rank=players.length; winners.push(loser); }
     render(); place();
     showFinalRanking();
     return;
   }
 }
 const gotSix = (lastRoll === 6);
 if(gotSix && diceRuleSixRepeat){
   extraTurn(p,`🎉 Dapat 6! ${p.name} lempar lagi!`);
 } else {
   if(gotSix && !diceRuleSixRepeat){ setLog(`Dapat 6 tapi tanpa putar lagi`); }
   nextTurn();
 }
}

// ==========================================================
// FINAL RANKING
// ==========================================================
function showFinalRanking(){
 playing=false; moving=false; syncDice();
 let sorted=[...winners].sort((a,b)=>a.rank-b.rank);
 const modeMapDesc={mix:'Manusia vs BOT', human:'Manusia vs Manusia', bot:'BOT vs BOT'};
 const modeNameDesc = modeMapDesc[gameMode] || gameMode;
 let desc = gameMode==='human'? `Mode ${modeNameDesc}` : `Mode ${modeNameDesc} [${diffLabel()}]`;
 let listHtml=sorted.map(w=>{ const icon=w.rank===1?'🥇':w.rank===2?'🥈':w.rank===3?'🥉':'🏅'; const label=`JUARA ${w.rank}`; return `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.1);align-items:center"><span style="color:#ffffff;font-weight:700;display:flex;align-items:center;gap:6px"><span>${icon}</span> ${w.name}</span><b style="color:${w.color}">${label}</b></div>`; }).join('');
 document.getElementById('winTitle').textContent='LIST JUARA'; document.getElementById('winDesc').textContent=desc; document.getElementById('winList').innerHTML=listHtml; document.getElementById('popup').classList.add('show');
}
function checkGameOver(){ if(winners.length>=players.length-1){ showFinalRanking(); } }

// ==========================================================
// TURN ROTATION
// ==========================================================
function nextTurn(){
  isDiceLocked = false; moving=false; sixStreak=0; lastRoll=0;
  let loop=0;
  do{ turn=(turn+1)%players.length; loop++; if(loop>20) break; }while(players[turn].win);
  render(); place(); updateLock();
  if(isAutoPlayer(players[turn]) &&!players[turn].win) later(botRoll,1100);
}

// ==========================================================
// BOOTSTRAP
// ==========================================================
generateRandomBoard(); createBoard();

let savedVol=null; try{ savedVol = localStorage.getItem('bgmVol'); }catch(e){}
if(savedVol!==null) setBgmVolumePercent(parseInt(savedVol));
else setBgmVolumePercent(50);

startMenuBgm();
window.addEventListener('click', function firstBgm(){
  let mm = document.getElementById('mainMenu');
  if(mm &&!mm.classList.contains('hide') &&!bgmTimer && bgmPercent>0){
    startMenuBgm();
  }
}, {once:true});

let vs = document.getElementById('volSlider');
if(vs){
  vs.addEventListener('input', (e)=>{
    setBgmVolumePercent(parseInt(e.target.value));
  });
}

function closeInfoPopup(){document.getElementById('infoPopup').classList.remove('show')}
window.addEventListener('load',()=>{
  setTimeout(()=>{
    try{
      if(localStorage.getItem('infoPop')===new Date().toDateString()) return;
      localStorage.setItem('infoPop', new Date().toDateString());
    }catch(e){}
    sfx('rare'); document.getElementById('infoPopup').classList.add('show');
  },900);
});

// === ANTI TIDUR - LAYAR GAK AKAN PADAM ===
let wakeLock = null;

async function enableNoSleep(){
  try{
    if('wakeLock' in navigator){
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', ()=>{ wakeLock=null; });
    }
  }catch(err){
    console.log('Wake Lock gagal:', err.message);
  }
}
document.addEventListener('pointerdown', ()=>{
  if(!wakeLock) enableNoSleep();
}, {once:true});
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'visible' && !wakeLock){
    enableNoSleep();
  }
});
window.addEventListener('load', enableNoSleep);

// MINTA BROWSER JANGAN HAPUS CACHE SEMINGGU
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(ok => {
    console.log(ok? "Cache DIKUNCI permanen ✅" : "Gagal dikunci ❌");
  });
}
