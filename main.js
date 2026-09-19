// ==========================================================
// SNAKE & LADDER - CORE CONFIGURATION
// Defines classic snakes and ladders mapping, colors, emojis
// ==========================================================
let SNAKES={97:78,95:24,92:84,62:37,48:12,35:6,16:4};
let LADDERS={3:22,8:26,21:42,28:77,52:68,72:90,80:98};
const COLORS=['#00e5ff','#ff4081','#ffde59','#69f0ae'];
const EMOJIS=['🔵','🔴','🟡','🟢','😀','😎','🤖','👻','🐍','🪜'];
const NAMES_DEF=['Biru','Merah','Kuning','Hijau'];

// ==========================================================
// GLOBAL STATE VARIABLES
// Handles DOM references, game state, audio, and rule configs
// ==========================================================
let boardEl=document.getElementById('board'), players=[], turn=0, playing=false, moving=false, audioCtx, sixStreak=0, gameMode='mix', difficulty='normal', bossBotId=0;
let winners=[], rareSpawns=[], isMuted=false, isLight=false;
let diceRuleStart='any', diceRuleSixRepeat=true, allowShared=true;
let diceRuleBounce=true; // true=MANTUL (bounce back), false=DIAM (stay)
let isDiceLocked = false;
let lastClickTime = 0;
let rollInterval = null;

// ==========================================================
// BGM MENU 8-BIT SYSTEM
// Simple 8-bit background music for main menu
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

// ==========================================================
// BGM PLAYBACK LOGIC
// ==========================================================
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
// Controls master volume percentage and maps to audio gain
// ==========================================================
function setBgmVolumePercent(p){
  bgmPercent = p;
  // Mapping logic: 100% = 0.25 max gain, linear scaling
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
  localStorage.setItem('bgmVol', p);
}

// ==========================================================
// AUDIO ENGINE
// Web Audio API based sound synthesis
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
// SOUND EFFECTS (SFX) MANAGER
// Handles all game sound effects with master volume scaling
// ==========================================================
function sfx(k){
 if(isMuted) return;
 let master = bgmPercent / 100; // Master volume: 100->1, 75->0.75, 0->0
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
// DICE VISUAL LOGIC
// Controls dice face display using pip mapping
// ==========================================================
const diceMap={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
function showDice(n){ for(let i=1;i<=9;i++) document.getElementById('p'+i).classList.remove('on'); (diceMap[n]||[]).forEach(i=>document.getElementById('p'+i).classList.add('on')); }
function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }

// ==========================================================
// RANDOM BOARD GENERATOR
// Generates random snakes/ladders positions and rare events
// ==========================================================
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
 // Rare spawn: 0.5% chance legendary ladder 1-10 to 100
 if(Math.random() < 0.005){
   let bottom = randInt(1,10);
   if(SNAKES[bottom]) delete SNAKES[bottom];
   LADDERS[bottom]=100;
   rareSpawns.push({type:'ladder', from:bottom, to:100});
 }
 // Rare spawn: 5% chance cursed snake 95-99 to 1-10
 if(Math.random() < 0.05){
   let head = randInt(95,99);
   let tail = randInt(1,10);
   if(LADDERS[head]) delete LADDERS[head];
   SNAKES[head]=tail;
   rareSpawns.push({type:'snake', from:head, to:tail});
 }
}

// ==========================================================
// BOARD RENDERER
// Creates 10x10 zigzag board cells with snakes/ladders marks
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
// RARE EVENT POPUP SYSTEM
// Shows legendary ladder / cursed snake announcement
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
    inner.innerHTML=`<div class="rare-icon">🪜✨</div><div class="rare-title gold">LEGENDARY LADDER!</div><div class="rare-board" style="color:#ffde59;border:1px solid #ffde59">📍 ${r.from} → ${r.to}</div><br><br><button class="btn" onclick="closeRarePopup()">GASKEUN! 🚀</button>`;
  } else {
    card.className='rare-card snake-bg';
    inner.innerHTML=`<div class="rare-icon">🐍💀</div><div class="rare-title red">CURSED SNAKE!</div><div class="rare-board" style="color:#ff8daa;border:1px solid #ff4081">📍 ${r.from} → ${r.to}</div><br><br><button class="btn" onclick="closeRarePopup()" style="background:linear-gradient(#ff4081,#ff1744);color:white">HATI-HATI! ⚠️</button>`;
  }
  document.getElementById('rarePopup').classList.add('show');
  idx++;
 }
 showOne();
 window._rareNext = ()=>{ if(idx<rareSpawns.length) showOne(); };
}
function closeRarePopup(){ document.getElementById('rarePopup').classList.remove('show'); if(window._rareNext && rareSpawns.length>1){ setTimeout(()=>{ window._rareNext(); window._rareNext=null; },400); } }

// ==========================================================
// DOM REFERENCES FOR UI CONTROLS
// Main menu and in-game UI elements
// ==========================================================
let playersEl=document.getElementById('players'), logEl=document.getElementById('log'), diceEl=document.getElementById('dice');
let modeEl=document.getElementById('mode'), diffWrapEl=document.getElementById('diffWrap'), diffEl=document.getElementById('diff'), pCountEl=document.getElementById('pCount');
let diceAreaEl=document.getElementById('diceArea'), topEl=document.getElementById('top'), nameSetupEl=document.getElementById('nameSetup');
let mm_pCount=document.getElementById('mm_pCount'), mm_mode=document.getElementById('mm_mode'), mm_diff=document.getElementById('mm_diff'), mm_diffWrap=document.getElementById('mm_diffWrap'), mm_nameSetup=document.getElementById('mm_nameSetup');
let mm_diceStart=document.getElementById('mm_diceStart'), mm_bounceRule=document.getElementById('mm_bounceRule'), mm_sixRepeat=document.getElementById('mm_sixRepeat'), mm_shared=document.getElementById('mm_shared');

// ==========================================================
// LEGACY NAME INPUT BUILDER (Hidden top bar version)
// ==========================================================
function buildNameInputs(){
  const c=+pCountEl.value;
  nameSetupEl.innerHTML='';
  for(let i=0;i<c;i++){
    const box=document.createElement('div'); box.className='nameBox';
    const isBotDefault = (modeEl.value==='bot') || (modeEl.value==='mix' && i!==0);
    const defName = NAMES_DEF[i] + (isBotDefault? ' BOT' : '');
    box.innerHTML=`<input id="inpName${i}" value="${defName}" maxlength="10" placeholder="Nama ${i+1}"><select id="inpIcon${i}">${EMOJIS.map((em,j)=>`<option value="${j}" ${j===i?'selected':''}>${em}</option>`).join('')}</select><input type="color" id="inpColor${i}" value="${COLORS[i]}" style="width:32px;height:28px;border:none;border-radius:8px;background:transparent">`;
    nameSetupEl.appendChild(box);
  }
}

// ==========================================================
// MAIN MENU NAME INPUT BUILDER
// Dynamically creates name/color/emoji selectors for players
// ==========================================================
function buildMMNameInputs(){
  const c=+mm_pCount.value;
  mm_nameSetup.innerHTML='';
  function buildMMNameInputs(){
  const c=+mm_pCount.value;
  mm_nameSetup.innerHTML='';
  mm_nameSetup.style.display='grid';
  mm_nameSetup.style.gridTemplateColumns='1fr'; // Single column layout to prevent cutoff
  mm_nameSetup.style.gap='6px';
  mm_nameSetup.style.margin='8px 0';
  for(let i=0;i<c;i++){
    const box=document.createElement('div'); box.className='nameBox';
    const isBotDefault = (mm_mode.value==='bot') || (mm_mode.value==='mix' && i!==0);
    const defName = NAMES_DEF[i] + (isBotDefault? ' BOT' : '');
    box.innerHTML=`<input id="mm_inpName${i}" value="${defName}" maxlength="10" placeholder="Nama ${i+1}"><select id="mm_inpIcon${i}">${EMOJIS.map((em,j)=>`<option value="${j}" ${j===i?'selected':''}>${em}</option>`).join('')}</select><input type="color" id="mm_inpColor${i}" value="${COLORS[i]}" style="width:32px;height:28px;border:none;border-radius:8px;background:transparent">`;
    mm_nameSetup.appendChild(box);
  }
} mm_nameSetup.style.gap='6px'; mm_nameSetup.style.margin='8px 0';
  for(let i=0;i<c;i++){
    const box=document.createElement('div'); box.className='nameBox';
    const isBotDefault = (mm_mode.value==='bot') || (mm_mode.value==='mix' && i!==0);
    const defName = NAMES_DEF[i] + (isBotDefault? ' BOT' : '');
    box.innerHTML=`<input id="mm_inpName${i}" value="${defName}" maxlength="10" placeholder="Nama ${i+1}"><select id="mm_inpIcon${i}">${EMOJIS.map((em,j)=>`<option value="${j}" ${j===i?'selected':''}>${em}</option>`).join('')}</select><input type="color" id="mm_inpColor${i}" value="${COLORS[i]}" style="width:32px;height:28px;border:none;border-radius:8px;background:transparent">`;
    mm_nameSetup.appendChild(box);
  }
}

// ==========================================================
// MENU LABEL UPDATER
// Updates AKTIF/NONAKTIF tags for all toggle options
// ==========================================================
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
}

// ==========================================================
// EVENT LISTENERS FOR MAIN MENU CONTROLS
// ==========================================================
mm_pCount.addEventListener('change', ()=>{ sfx('click'); buildMMNameInputs(); updateMenuLabels(); });
mm_mode.addEventListener('change', ()=>{ sfx('click'); updateMMDiffVisibility(); buildMMNameInputs(); updateMenuLabels(); });
mm_diff.addEventListener('change', ()=>sfx('click'));
mm_diceStart.addEventListener('change', ()=>{ sfx('click'); updateMenuLabels(); });
mm_bounceRule.addEventListener('change', ()=>{ sfx('click'); updateMenuLabels(); });
mm_sixRepeat.addEventListener('change', ()=>{ sfx('click'); updateMenuLabels(); });
mm_shared.addEventListener('change', ()=>{ sfx('click'); updateMenuLabels(); });
pCountEl.addEventListener('change', buildNameInputs);
modeEl.addEventListener('change', ()=>{ updateDiffVisibility(); buildNameInputs(); });

// ==========================================================
// DIFFICULTY VISIBILITY TOGGLER
// Shows/hides difficulty selector based on game mode
// ==========================================================
function updateDiffVisibility(){
 const m=modeEl.value;
 if(m==='human'){ diffWrapEl.style.display='none'; } else { diffWrapEl.style.display='block'; }
}
function updateMMDiffVisibility(){
 const m=mm_mode.value;
 if(m==='human'){ mm_diffWrap.style.display='none'; } else { mm_diffWrap.style.display='block'; }
}
updateDiffVisibility(); updateMMDiffVisibility(); buildNameInputs(); buildMMNameInputs(); updateMenuLabels();

// ==========================================================
// SETTINGS & CREDIT PAGE NAVIGATION
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
// Restores all options to initial values
// ==========================================================
function resetDefault(){
 sfx('click');
 isLight=false; isMuted=false; document.body.classList.remove('light');
 mm_pCount.value='4'; mm_mode.value='mix'; mm_diff.value='normal';mm_diceStart.value='any'; mm_bounceRule.value='bounce'; mm_sixRepeat.checked=true; mm_shared.checked=true;
 pCountEl.value='4'; modeEl.value='mix'; diffEl.value='normal';
diceRuleStart='any'; diceRuleBounce=true; diceRuleSixRepeat=true; allowShared=true;
 updateMMDiffVisibility(); buildMMNameInputs(); buildNameInputs(); updateMenuLabels();
 setBgmVolumePercent(50);
 if(rollInterval){ clearInterval(rollInterval); rollInterval=null; }
 if(!document.getElementById('mainMenu').classList.contains('hide')){
   startMenuBgm();
 }
}

// ==========================================================
// START GAME FROM MAIN MENU
// Transfers settings from main menu to game and launches
// ==========================================================
function startFromMenu(){
 sfx('click');
 stopMenuBgm();
 pCountEl.value=mm_pCount.value;
 modeEl.value=mm_mode.value;
 diffEl.value=mm_diff.value;
 diceRuleStart=mm_diceStart.value;
 diceRuleSixRepeat=mm_sixRepeat.checked;
  diceRuleBounce = (mm_bounceRule.value === 'bounce');
 allowShared=mm_shared.checked;
 buildNameInputs();
 for(let i=0;i<+mm_pCount.value;i++){
   let sName=document.getElementById(`mm_inpName${i}`); let dName=document.getElementById(`inpName${i}`);
   let sIcon=document.getElementById(`mm_inpIcon${i}`); let dIcon=document.getElementById(`inpIcon${i}`);
   let sCol=document.getElementById(`mm_inpColor${i}`); let dCol=document.getElementById(`inpColor${i}`);
   if(sName&&dName) dName.value=sName.value;
   if(sIcon&&dIcon) dIcon.value=sIcon.value;
   if(sCol&&dCol) dCol.value=sCol.value;
 }
 document.getElementById('mainMenu').classList.add('hide');
 document.getElementById('wrap').style.display='block';
 startGame();
}

// ==========================================================
// IN-GAME MENU HANDLERS
// ==========================================================
function openMenu(){ sfx('click'); const modeMap={mix:'Manusia vs BOT', human:'Manusia vs Manusia', bot:'BOT vs BOT'}; const modeName = modeMap[gameMode] || gameMode; if(gameMode==='human'){ document.getElementById('menuInfo').textContent = `Mode: ${modeName} | Menang: ${winners.length}/${players.length}`; } else { const diffText = diffEl.options[diffEl.selectedIndex].text; document.getElementById('menuInfo').textContent = `Mode: ${modeName} (${diffText}) | Menang: ${winners.length}/${players.length}`; } document.getElementById('menuPopup').classList.add('show'); }
function closeMenu(){ sfx('click'); document.getElementById('menuPopup').classList.remove('show'); }
function restartSame(){ sfx('click'); closeMenu(); startGame(); }

// ==========================================================
// GAME INITIALIZATION
// Generates board, players, and sets initial turn
// ==========================================================
function startGame(){
 generateRandomBoard(); createBoard();
 let c=+pCountEl.value; gameMode=modeEl.value; difficulty=diffEl.value;
 if(gameMode==='human'){ difficulty='normal'; }
 players=[]; winners=[];
 for(let i=0;i<c;i++){
   let type; if(gameMode==='human') type='human'; else if(gameMode==='bot') type='bot'; else type=(i===0?'human':'bot');
   const nameInput=document.getElementById(`inpName${i}`);
   const colorInput=document.getElementById(`inpColor${i}`);
   const iconInput=document.getElementById(`inpIcon${i}`);
   const nm = (nameInput && nameInput.value.trim())? nameInput.value.trim() : NAMES_DEF[i];
   const col = colorInput? colorInput.value : COLORS[i];
   const iconIdx = iconInput? parseInt(iconInput.value) : i;
   const icon = EMOJIS[iconIdx] || '';
   players.push({id:i,name:nm,color:col,icon:icon,type:type,origType:type,pos:0,win:false,rank:0,auto:false});
 }
 bossBotId=Math.floor(Math.random()*players.length);
 turn=0; playing=true; sixStreak=0; moving=false;
 if(rollInterval){ clearInterval(rollInterval); rollInterval=null; }
 topEl.style.display='none'; nameSetupEl.style.display='none';
 diceAreaEl.classList.add('show'); document.getElementById('menuBtn').classList.add('show');
 render(); place(); showDice(1); updateLock();
 logEl.innerHTML=`🎲 ${players[turn].name} lempar dadu untuk masuk!`;
 if(rareSpawns.length>0) setTimeout(showRarePopup,600);
 if(isAutoPlayer(players[turn])) setTimeout(botRoll,900);
}

// ==========================================================
// PLAYER TYPE HELPERS
// ==========================================================
function isAutoPlayer(p){ return p.type==='bot' || p.auto; }
function toggleAuto(id){
 sfx('click');
 let p=players.find(x=>x.id===id);
 if(!p || p.win) return;
 if(p.origType==='bot') return;
 p.auto=!p.auto;
 render();
 updateLock();
 if(isAutoPlayer(players[turn]) &&!moving) setTimeout(botRoll,500);
}

// ==========================================================
// DICE LOCK & TURN LOCK LOGIC
// Controls when dice can be rolled
// ==========================================================
function updateLock(){
 diceEl.classList.remove('disabled','bot-turn'); diceEl.style.pointerEvents='auto';
 if(!playing || moving){ diceEl.classList.add('disabled'); diceEl.style.pointerEvents='none'; return; }
 while(players[turn].win){ turn=(turn+1)%players.length; if(winners.length>=players.length-1) break; }
 let cur=players[turn];
 if(cur.win){ checkGameOver(); return; }
 if(isAutoPlayer(cur)){
   diceEl.classList.add('disabled','bot-turn'); diceEl.style.pointerEvents='none';
   logEl.innerHTML=`🤖 ${cur.name} ${cur.auto?'[AUTO]':''} jalan...`;
 } else {
   diceEl.classList.remove('disabled','bot-turn'); diceEl.style.pointerEvents='auto';
   if(cur.pos===0){ if(diceRuleStart==='need1') logEl.innerHTML=`🎲 ${cur.name} butuh angka 1 untuk masuk!`; else logEl.innerHTML=`🎲 ${cur.name} butuh lempar untuk masuk papan!`; }
   else { logEl.innerHTML=`🎲 Giliran <b style="color:${cur.color}">${cur.name}</b> - [${winners.length} finish]`; }
 }
}

// ==========================================================
// PLAYER CARD RENDERER
// Renders player status cards and active cell highlight
// ==========================================================
function render(){
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
   d.innerHTML=`<div class="span-info" style="width:20px;height:20px;border-radius:50%;background:${p.color};margin:0 auto 2px;border:1.5px solid white;display:flex;align-items:center;justify-content:center;font-size:10px">${p.icon}</div><b style="color= #ffffff;">${p.name}${p.origType==='bot'?' 🤖':''}${rankIcon}</b><br><span>${p.win?'FINISH #'+p.rank:(p.pos===0?'START':p.pos)}</span>${autoBtn}`;
   playersEl.appendChild(d);
 });
 document.querySelectorAll('.cell').forEach(c=>c.classList.remove('active'));
 let curCell=document.getElementById('c'+players[turn].pos);
 if(curCell &&!players[turn].win && players[turn].pos!==0) curCell.classList.add('active');
}

// ==========================================================
// PAWN PLACEMENT SYSTEM
// Places player pawns on board cells with offset for stacking
// ==========================================================
function place(){
 document.querySelectorAll('.pion').forEach(e=>e.remove());
 let g={}; players.forEach(p=>{if(p.win) return; if(p.pos===0) return; if(!g[p.pos]) g[p.pos]=[]; g[p.pos].push(p);});
 Object.keys(g).forEach(pos=>{
  let cell=document.getElementById('c'+pos); if(!cell) return;
  g[pos].forEach((p,idx)=>{
   let pion=document.createElement('div'); pion.className='pion'+(players[turn].id===p.id?' active':''); pion.id='pion-'+p.id; pion.style.background=p.color; pion.textContent=p.icon || (p.id+1);
   let offsets=[{x:-21,y:5},{x:10,y:0},{x:-10,y:8},{x:10,y:8}];
   let off=offsets[idx%4];
   pion.style.left=`calc(50% + ${off.x}px)`;
   pion.style.bottom=`${2+off.y}px`;
   pion.style.top='auto';
   pion.style.transform=`translateX(-50%)`;
   pion.style.transform = `scale(.9)`
   if(players[turn].id===p.id){ pion.style.transform=`translateX(0%) scale(1.25) translateY(5px)`; }
   cell.appendChild(pion);
  });
 });
}

// ==========================================================
// DICE ROLL LOGIC
// Handles random dice generation with anti-triple-6 rule
// ==========================================================
function getDiceForPlayer(p){ return Math.floor(Math.random()*6)+1; }
function getDice(){ let d=getDiceForPlayer(players[turn]); if(d===6) sixStreak++; else sixStreak=0; if(sixStreak>=3){ d=Math.floor(Math.random()*5)+1; sixStreak=0; } return d; }
function humanRoll() {
  if (!playing || isDiceLocked || moving || rollInterval) return;
  if (isAutoPlayer(players[turn])) {
    if (players[turn].auto) return;
    sfx('no');
    return;
  }
  if (diceEl.classList.contains('disabled') || diceEl.classList.contains('bot-turn')) {
    sfx('no');
    return;
  }
  doRoll();
}

function botRoll() {
  if (!playing || moving || rollInterval || isDiceLocked) return;
  if (!isAutoPlayer(players[turn])) return;
  doRoll();
}

function doRoll() {
  if (rollInterval) { return; }
  if (isDiceLocked) return;
  
  isDiceLocked = true;
  moving = true;
  diceEl.classList.add('rolling', 'disabled');
  diceEl.style.pointerEvents = 'none';
  sfx('dice');
  
  let r = 0;
  rollInterval = setInterval(() => {
    showDice(Math.floor(Math.random() * 6) + 1);
    if (++r > 12) {
      clearInterval(rollInterval);
      rollInterval = null;
      diceEl.classList.remove('rolling');
           let d = getDice();
           showDice(d);
           diceEl.dataset.last = d;
           moveStep(players[turn], d);
    }
  }, 70);
}

// ==========================================================
// ANIMATION LINE DRAWER
// Draws dashed line for snake/ladder transition
// ==========================================================
function drawLine(from,to,color){ let svg=document.getElementById('animLine'); svg.innerHTML=''; let fromEl=document.getElementById('c'+from), toEl=document.getElementById('c'+to); if(!fromEl||!toEl) return; let wrap=document.getElementById('boardWrap').getBoundingClientRect(); let f=fromEl.getBoundingClientRect(), t=toEl.getBoundingClientRect(); let x1=f.left + f.width/2 - wrap.left; let y1=f.top + f.height/2 - wrap.top; let x2=t.left + t.width/2 - wrap.left; let y2=t.top + t.height/2 - wrap.top; let line=document.createElementNS('http://www.w3.org/2000/svg','line'); line.setAttribute('x1',x1); line.setAttribute('y1',y1); line.setAttribute('x2',x2); line.setAttribute('y2',y2); line.setAttribute('stroke',color); line.setAttribute('stroke-width','5'); line.setAttribute('stroke-linecap','round'); line.setAttribute('stroke-dasharray','10 8'); line.style.animation='dashFlow 0.4s linear infinite'; line.style.filter=`drop-shadow(0 0 6px ${color})`; svg.appendChild(line); setTimeout(()=>{ svg.innerHTML=''; },1300); }

// ==========================================================
// PLAYER MOVEMENT ENGINE
// Handles movement with bounce/stay rules for >100
// ==========================================================
function moveStep(p,steps){
 if(p.pos===0){ if(diceRuleStart==='need1' && steps!==1){ logEl.innerHTML=`${p.name} dapat ${steps} - butuh 1 untuk masuk!`; sfx('bust'); setTimeout(()=>{ moving=false; nextTurn(); },600); return; } }
 let target = (p.pos===0)? steps : p.pos+steps;
  if(target>100){
      if (!diceRuleBounce) {
     // STAY MODE - no bounce, but 6 still gives extra turn
     let need = 100 - p.pos;
     let isSixRoll = (steps === 6);
     logEl.innerHTML = `Butuh ${need}! ${p.pos}+${steps}=${target} lewat, diam!`;
     sfx('bust');
     setTimeout(() => {
       moving = false;
        if (isSix && diceRuleSixRepeat) {
          moving = false;
          isDiceLocked = false;
          logEl.innerHTML = `🎉 Dapat 6! ${p.name} lempar lagi!`;
          diceEl.classList.remove('disabled', 'bot-turn');
          diceEl.style.pointerEvents = 'auto';
          updateLock();
          if (isAutoPlayer(p)) setTimeout(botRoll, 900);
        } else {
         nextTurn();
       }
     }, 700);
     return;
   } else {
     // BOUNCE MODE - classic bounce back logic
     let over=target-100; let bounce=100-over;
     logEl.innerHTML=`Lewat 100! ${p.pos}+${steps}=${target} → mantul ${bounce}`;
     sfx('bust');
     let cur=p.pos===0?1:p.pos; if(p.pos===0){ p.pos=1; render(); place(); cur=1; }
     let up=setInterval(()=>{ if(cur<100){ cur++; p.pos=cur; render(); place(); sfx('step'); } else{ clearInterval(up); setTimeout(()=>{ let down=setInterval(()=>{ if(p.pos>bounce){ p.pos--; render(); place(); sfx('step'); } else{ clearInterval(down); handleSnakeLadder(p); } },180); },250); } },180);
     return;
   }
 }
 if(p.pos===0){ logEl.innerHTML=`${p.name} masuk! dapat ${steps} → ${target}`; p.pos=0; let cur=0; let it=setInterval(()=>{ if(cur<target){ cur++; p.pos=cur; render(); place(); sfx('step'); } else{ clearInterval(it); handleSnakeLadder(p); } },190); }
 else { logEl.innerHTML=`${p.name} dapat ${steps} → ${target}`; let cur=p.pos; let it=setInterval(()=>{ if(cur<target){ cur++; p.pos=cur; render(); place(); sfx('step'); } else{ clearInterval(it); handleSnakeLadder(p); } },190); }
}

// ==========================================================
// SNAKE & LADDER HANDLER
// Checks and animates ladder climb / snake bite
// ==========================================================
function handleSnakeLadder(p){
 if(LADDERS[p.pos]){ let to=LADDERS[p.pos]; logEl.innerHTML=`🪜 TANGGA! ${p.pos} → ${to} ⬆️`; sfx('ladder'); let from=document.getElementById('c'+p.pos); if(from) from.classList.add('anim-up'); drawLine(p.pos,to,'#69f0ae'); setTimeout(()=>{ p.pos=to; render(); place(); let dest=document.getElementById('c'+to); if(dest) dest.classList.add('anim-up'); setTimeout(()=>checkKick(p),500); },700); }
 else if(SNAKES[p.pos]){ let to=SNAKES[p.pos]; logEl.innerHTML=`🐍 ULAR! ${p.pos} → ${to} ⬇️`; sfx('snake'); let from=document.getElementById('c'+p.pos); if(from) from.classList.add('anim-down'); drawLine(p.pos,to,'#ff4081'); setTimeout(()=>{ p.pos=to; render(); place(); let dest=document.getElementById('c'+to); if(dest) dest.classList.add('anim-down'); setTimeout(()=>checkKick(p),500); },700); }
 else { checkKick(p); }
}

// ==========================================================
// KICK / SHARED TILE LOGIC
// Handles collision: shared tile vs kick to start
// ==========================================================
function checkKick(p){
 if(allowShared){ finishAfterMove(p); return; }
 let victims=players.filter(o=>!o.win && o.id!==p.id && o.pos!==0 && o.pos===p.pos && o.pos!==100);
 if(victims.length>0){
  victims.forEach(v=>{ sfx('kick'); let vp=document.getElementById('pion-'+v.id); if(vp) vp.classList.add('kicked'); });
  logEl.innerHTML=`${p.name} NENDANG 💥 ${victims.map(v=>v.name).join(',')}!`;
  setTimeout(()=>{ victims.forEach(v=>v.pos=0); render(); place(); finishAfterMove(p); },600);
 } else { finishAfterMove(p); }
}

// ==========================================================
// FINISH & EXTRA TURN HANDLER
// Checks win condition and 6-repeat rule
// ==========================================================
function finishAfterMove(p){
 if(p.pos===100){
   p.win=true; p.rank=winners.length+1; winners.push(p); sfx('win');
   if(winners.length < players.length-1){
     logEl.innerHTML=`🏁 ${p.name} FINISH #${p.rank}! Sisa ${players.length-winners.length} pemain`;
     render(); place();
     isDiceLocked = false; // FIX: buka kunci
     setTimeout(()=>{ moving=false; nextTurn(); },800);
     return;
   } else {
     let loser=players.find(x=>!x.win);
     if(loser){ loser.rank=players.length; winners.push(loser); }
     showFinalRanking();
     return;
   }
 }

 let diceValue = document.querySelectorAll('.pip.on').length;
 // Mapping pip ke angka biar ga salah baca pas animasi
 let isSix = (diceValue === 6) || (p.pos!== 100 && sixStreak > 0 && diceValue === 6); // simpel: cek 6
 // Lebih akurat: ambil dari result terakhir
 let lastDice = 0;
 try { lastDice = parseInt(document.getElementById('dice').dataset.last || "0"); } catch {}

 // Pakai cara paling aman: cek sixStreak atau cek langsung
 const gotSix = sixStreak > 0; // karena sixStreak udah di-set di getDice()

 if(gotSix && diceRuleSixRepeat){
   moving=false;
   isDiceLocked = false; // PENTING: buka kunci dulu
   logEl.innerHTML=`🎉 Dapat 6! ${p.name} lempar lagi!`;

   if(isAutoPlayer(p)){
     diceEl.classList.add('disabled','bot-turn');
     diceEl.style.pointerEvents='none';
     setTimeout(botRoll, 900);
   } else {
     diceEl.classList.remove('disabled','bot-turn');
     diceEl.style.pointerEvents='auto';
     updateLock();
   }
 } else {
   if(gotSix &&!diceRuleSixRepeat){ logEl.innerHTML=`Dapat 6 tapi mode tanpa putar lagi`; }
   sixStreak=0;
   isDiceLocked = false;
   nextTurn();
 }
}

// ==========================================================
// FINAL RANKING SCREEN
// Displays leaderboard when game ends
// ==========================================================
function showFinalRanking(){
 playing=false; moving=false; diceEl.classList.add('disabled'); diceEl.style.pointerEvents='none';
 let sorted=[...winners].sort((a,b)=>a.rank-b.rank);
 const modeMapDesc={mix:'Manusia vs BOT', human:'manusia vs manusia', bot:'BOT vs BOT'};
 const modeNameDesc = modeMapDesc[gameMode] || gameMode;
 let desc = gameMode==='human'? `Mode ${modeNameDesc}` : `Mode ${modeNameDesc} [${difficulty}]`;
 let listHtml=sorted.map(w=>{ const icon=w.rank===1?'🥇':w.rank===2?'🥈':w.rank===3?'🥉':'🏅'; const label=`JUARA ${w.rank}`; return `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.1);align-items:center"><span style="color:#ffffff;font-weight:700;display:flex;align-items:center;gap:6px"><span>${icon}</span> ${w.name}</span><b style="color:${w.color}">${label}</b></div>`; }).join('');
 document.getElementById('winTitle').textContent='LIST JUARA'; document.getElementById('winDesc').textContent=desc; document.getElementById('winList').innerHTML=listHtml; document.getElementById('popup').classList.add('show');
}
function checkGameOver(){ if(winners.length>=players.length-1){ showFinalRanking(); } }

// ==========================================================
// TURN ROTATION ENGINE
// Moves to next player, skips finished players
// ==========================================================
function nextTurn(){
  isDiceLocked = false;
  let loop=0;
  do{ turn=(turn+1)%players.length; loop++; if(loop>20) break; }while(players[turn].win);
  render(); place(); moving=false; diceEl.classList.remove('disabled','rolling'); diceEl.style.pointerEvents='auto'; updateLock();
  if(isAutoPlayer(players[turn]) &&!players[turn].win) setTimeout(botRoll,1100);
}

// ==========================================================
// GAME BOOTSTRAP / INIT
// Initial load, volume restore, and BGM autostart
// ==========================================================
generateRandomBoard(); createBoard(); showDice(1); updateLock();

let savedVol = localStorage.getItem('bgmVol');
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

// === PWA - Offline Support v11.0.6 ===
if ('serviceWorker' in navigator) {
  // Register Service Worker after page fully loaded
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
  
  // Auto-reload when new Service Worker takes control
  // Ensures user always gets the latest cached version
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}