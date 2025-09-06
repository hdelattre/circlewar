// evolves.js
// Single-file "Evolves" arena inspired by SC:BW UMS
// Self-contained: creates its own canvas, UI, loop, and bots.

(function() {
  'use strict';

  // ---------- DOM SETUP ----------
  const root = document.createElement('div');
  root.id = 'evolvesRoot';
  root.style.position = 'fixed';
  root.style.inset = '0';
  root.style.background = '#0f1014';
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.userSelect = 'none';
  root.style.touchAction = 'none';

  const topBar = document.createElement('div');
  topBar.style.flex = '0 0 auto';
  topBar.style.display = 'flex';
  topBar.style.alignItems = 'center';
  topBar.style.gap = '16px';
  topBar.style.padding = '8px 12px';
  topBar.style.color = '#e7eaee';
  topBar.style.fontFamily = 'system-ui, Arial, sans-serif';
  topBar.style.fontSize = '14px';
  topBar.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0))';

  const leftInfo = document.createElement('div');
  leftInfo.style.flex = '0 0 auto';
  const centerInfo = document.createElement('div');
  centerInfo.style.flex = '1 1 auto';
  centerInfo.style.textAlign = 'center';
  const rightInfo = document.createElement('div');
  rightInfo.style.flex = '0 0 auto';

  const canvas = document.createElement('canvas');
  canvas.id = 'evolvesCanvas';
  canvas.style.flex = '1 1 auto';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');

  const bottomBar = document.createElement('div');
  bottomBar.style.flex = '0 0 auto';
  bottomBar.style.display = 'flex';
  bottomBar.style.alignItems = 'center';
  bottomBar.style.justifyContent = 'space-between';
  bottomBar.style.padding = '8px 12px';
  bottomBar.style.color = '#bfc7d1';
  bottomBar.style.fontFamily = 'system-ui, Arial, sans-serif';
  bottomBar.style.fontSize = '12px';
  bottomBar.style.opacity = '0.9';
  bottomBar.innerHTML = '<span>Select: LMB drag · Move: RMB · Attack-move: A+LMB/RMB · Stop: S · Hold: H · Pause: P · Speed: -/= · Restart: R</span>';

  const restartBtn = document.createElement('button');
  restartBtn.textContent = 'Restart (R)';
  Object.assign(restartBtn.style, {
    background: '#1c2530', color: '#e7eaee', border: '1px solid #364150',
    padding: '6px 10px', borderRadius: '6px', cursor: 'pointer'
  });
  bottomBar.appendChild(restartBtn);

  const overlay = document.createElement('div');
  overlay.style.position = 'absolute';
  overlay.style.inset = '0';
  overlay.style.display = 'none';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.background = 'rgba(0,0,0,0.35)';
  const overlayCard = document.createElement('div');
  Object.assign(overlayCard.style, {
    background: '#0b0d12', color: '#e7eaee', padding: '18px 22px', borderRadius: '10px',
    border: '1px solid #2a3340', boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
    fontFamily: 'system-ui, Arial, sans-serif', textAlign: 'center'
  });
  const overlayText = document.createElement('div');
  overlayText.style.fontSize = '18px';
  overlayText.style.marginBottom = '12px';
  const overlaySub = document.createElement('div');
  overlaySub.style.fontSize = '13px';
  overlaySub.style.opacity = '0.85';
  overlayCard.appendChild(overlayText);
  overlayCard.appendChild(overlaySub);
  overlay.appendChild(overlayCard);

  topBar.appendChild(leftInfo);
  topBar.appendChild(centerInfo);
  topBar.appendChild(rightInfo);
  root.appendChild(topBar);
  root.appendChild(canvas);
  root.appendChild(bottomBar);
  root.appendChild(overlay);
  // non-blocking toast area for lightweight notifications
  const toastArea = document.createElement('div');
  Object.assign(toastArea.style, {
    position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)',
    display: 'flex', flexDirection: 'column', gap: '6px', pointerEvents: 'none', zIndex: '10'
  });
  root.appendChild(toastArea);
  // Faction picker panel (blocks until selection)
  const factionPanel = document.createElement('div');
  factionPanel.id = 'evolvesFactionPanel';
  Object.assign(factionPanel.style, {
    position:'absolute', inset:'0', display:'none', alignItems:'center', justifyContent:'center',
    background:'rgba(0,0,0,0.45)', zIndex:'20'
  });
  const factionCard = document.createElement('div');
  Object.assign(factionCard.style, {
    background:'#0b0d12', color:'#e7eaee', padding:'18px 22px', borderRadius:'10px',
    border:'1px solid #2a3340', boxShadow:'0 8px 30px rgba(0,0,0,0.6)',
    fontFamily:'system-ui, Arial, sans-serif', textAlign:'center', minWidth:'320px'
  });
  const factionTitle = document.createElement('div'); factionTitle.textContent='Choose Your Faction'; factionTitle.style.fontSize='18px'; factionTitle.style.marginBottom='12px';
  factionCard.appendChild(factionTitle);
  const pickRow = document.createElement('div'); pickRow.style.display='flex'; pickRow.style.gap='10px'; pickRow.style.justifyContent='center';
  function pickButton(label, faction){ const b=document.createElement('button'); b.textContent=label; Object.assign(b.style,{padding:'8px 12px', background:'#1c2530', color:'#e7eaee', border:'1px solid #364150', borderRadius:'6px', cursor:'pointer'}); b.addEventListener('click',()=>selectFaction(faction)); return b; }
  pickRow.appendChild(pickButton('Zerg','zerg'));
  pickRow.appendChild(pickButton('Protoss','protoss'));
  pickRow.appendChild(pickButton('Terran','terran'));
  factionCard.appendChild(pickRow);
  factionPanel.appendChild(factionCard);
  root.appendChild(factionPanel);
  document.body.appendChild(root);

  // ---------- CONFIG ----------
  const COLORS = [
    '#4aa3ff', '#ff5d5d', '#48d17a', '#ffd166', '#cc77ff', '#ff9f40', '#ff77aa', '#9d6b53'
  ];
  const BOT_NAMES = ['HERB', 'ROSEMARY', 'THYME', 'SAGE', 'OREGANO', 'BASIL', 'MINT', 'DILL'];

  // Tiers: each has distinct movement or attack style
  const TIERS = [
    // Approximate SC:BW-like tuning in this engine
    { name: 'Zergling',  hp: 36,  speed: 700, radius: 12,
      attack: { type: 'dash',  cd: 0.30, range: 60, damage: 12, dashSpeed: 1400, dashTime: 0.16, backswing: 0.14 }},
    { name: 'Marine',    hp: 48,  speed: 160, radius: 12,
      attack: { type: 'hitscan', cd: 0.30, damage: 9,  range: 291, backswing: 0.12 }},
    { name: 'Hydra',     hp: 60,  speed: 155, radius: 13,
      attack: { type: 'hitscan', cd: 0.50, damage: 14, range: 364, backswing: 0.18 }},
    { name: 'Vulture',   hp: 76,  speed: 235, radius: 13,
      attack: { type: 'bullet', cd: 1.10, projSpeed: 500, damage: 28, range: 407, life: 1.0, backswing: 0.22 }},
    { name: 'Templar',   hp: 82,  speed: 140, radius: 14,
      attack: { type: 'chain',  cd: 1.20, range: 524, jumps: 3, damage: 24, jumpRange: 320, backswing: 0.30 }},
    { name: 'Reaver',    hp: 110, speed: 125, radius: 16,
      attack: { type: 'aoe',   cd: 2.80, radius: 64, damage: 140, backswing: 0.45 }},
    { name: 'Wraith',    hp: 70,  speed: 185, radius: 12, flying: true,
      attack: { type: 'homing',cd: 0.70, projSpeed: 300, damage: 26, range: 349, life: 2.0, turn: 3.5, backswing: 0.20 }},
    { name: 'Ultralisk', hp: 145, speed: 170, radius: 18,
      attack: { type: 'cleave',cd: 0.60, radius: 70, damage: 32, backswing: 0.22 }},
    // Additional unit types
    { name: 'Firebat',   hp: 95,  speed: 160, radius: 14,
      attack: { type: 'aoe',   cd: 0.55, radius: 44, damage: 26, backswing: 0.18 }},
    { name: 'Dragoon',   hp: 100, speed: 140, radius: 14,
      attack: { type: 'bullet',cd: 0.86, projSpeed: 520, damage: 20, range: 480, life: 0.9, backswing: 0.25 }},
    { name: 'Mutalisk',  hp: 80,  speed: 220, radius: 12, flying: true,
      attack: { type: 'chain', cd: 0.65, range: 420, jumps: 2, damage: 12, jumpRange: 260, backswing: 0.20 }},
    { name: 'Siege',     hp: 125, speed: 120, radius: 16,
      attack: { type: 'splash',cd: 1.80, projSpeed: 420, damage: 70, splash: 64, life: 2.0, backswing: 0.35 }},
    { name: 'Archon',    hp: 160, speed: 155, radius: 18,
      attack: { type: 'cleave',cd: 0.75, radius: 100, damage: 36, backswing: 0.28 }}
    ,
    // New units for faction trees
    { name: 'Zealot',    hp: 120, speed: 170, radius: 14,
      attack: { type: 'cleave', cd: 0.50, radius: 55, damage: 20, backswing: 0.18 }},
    { name: 'Guardian',  hp: 160, speed: 120, radius: 16, flying: true,
      attack: { type: 'splash', cd: 1.60, projSpeed: 320, damage: 38, splash: 56, life: 2.2, range: 520, backswing: 0.35 }},
    { name: 'Devourer',  hp: 220, speed: 150, radius: 18, flying: true,
      attack: { type: 'burst', cd: 0.85, count: 3, spread: 0.22, projSpeed: 380, damage: 16, splash: 24, life: 1.1, range: 480, backswing: 0.28 }},
    { name: 'Battlecruiser', hp: 320, speed: 120, radius: 20, flying: true,
      attack: { type: 'homing', cd: 1.10, projSpeed: 280, damage: 30, life: 3.0, range: 460, turn: 2.5, backswing: 0.35 }},
    { name: 'Carrier',   hp: 300, speed: 140, radius: 20, flying: true,
      attack: { type: 'burst', cd: 1.20, count: 4, spread: 0.15, projSpeed: 420, damage: 8, life: 0.9, range: 460, backswing: 0.30 }}
  ];
  const EVOLVE_KILLS_TIER1 = 70;   // requirement to evolve from Tier 1 (slower early game)
  const EVOLVE_KILLS_TIERN = 220;  // requirement near late tiers (significantly longer climb)
  // Factions are mapped to unit names within TIERS
  const FACTIONS = {
    zerg:    ['Zergling','Hydra','Mutalisk','Ultralisk','Guardian','Devourer'],
    terran:  ['Marine','Firebat','Vulture','Siege','Wraith','Battlecruiser'],
    protoss: ['Zealot','Dragoon','Templar','Reaver','Archon','Carrier'],
  };
  function tiersLen(ctrl){ const list = FACTIONS[ctrl?.faction||'zerg']; return (list&&list.length)||TIERS.length; }
  function getUnitDefByName(name){ for (const t of TIERS){ if (t.name===name) return t; } return TIERS[0]; }
  function getUnitNameFor(ctrl, tier){ const list = FACTIONS[ctrl?.faction||'zerg'] || FACTIONS.zerg; const idx = Math.min(tier, Math.max(0, list.length-1)); return list[idx]; }
  function getUnitDef(p){ const ctrl = getController(p); const name = getUnitNameFor(ctrl, p.tier||0); return getUnitDefByName(name); }
  function killsToEvolveNeeded(ctrl){
    const maxEvolveTier = Math.max(0, tiersLen(ctrl) - 2);
    const t = Math.max(0, Math.min(maxEvolveTier, ctrl.tier||0));
    let u = maxEvolveTier > 0 ? (t / maxEvolveTier) : 0;
    // ease-in curve so later tiers require disproportionately more kills
    u = u * u; // quadratic ease-in
    return Math.round(lerp(EVOLVE_KILLS_TIER1, EVOLVE_KILLS_TIERN, u));
  }
  const TOP_TIER_EXTRA_KILLS_TO_WIN = 3; // unused now (win is by last bunker standing)
  const NUM_BOTS = 3; // fewer sides to keep unit counts readable
  const UNITS_PER_SIDE = 6; // units per controller (human or AI)
  const UNIT_VS_UNIT_DMG_MULT = 1.0; // baseline multiplier for unit vs unit damage
  const UNIT_DAMAGE_MULT = 0.7; // global outgoing damage scale for all unit-sourced attacks
  const BASE_RADIUS = 42;
  const BASE_DEFENSE_RANGE = 160; // base turret range
  const BASE_DPS = 30; // reduced turret DPS
  const BASE_VS_EARLY_MULT = 1.1; // early tiers deal slightly more vs bunker (easier to damage)
  const SPAWN_INTERVAL = 1.0; // seconds per unit spawn (fixed)
  const UNIT_CAP = 64; // per side (increased)
  const TIME_SCALE = 1/3; // global slow down
  const BASE_MAX_HP = 6000; // very tanky bunkers
  const BASE_INCOMING_EARLY_MULT = 0.6; // early tiers deal reduced damage to bunker
  const BASE_RING_OUTER_GAP = 200; // extra space from bases to arena edge (bigger = bases farther from vertical edges)
  const WORLD_SCALE = 2.0; // zoom out by making world 2x larger than viewport
  const ATTACK_RANGE_MULT = 0.35; // globally reduce perceived attack ranges further
  const MAX_ATTACK_RANGE = 260;   // tighter hard cap on decision range
  const ARENA_MARGIN = 24; // keep entities away from outer canvas edges a bit

  // --- Economy / Upgrades ---
  const GOLD_PER_KILL = 5;
  const GOLD_PASSIVE_PER_SEC = 1.0;
  const GOLD_PER_BASE_DAMAGE = 0.02; // per HP damaged on enemy bunker
  const GOLD_ON_WIN = 100; // bonus when others are eliminated (not strictly needed)

  const UPGRADE_COSTS = {
    cap: 40,
    unitHp: 50,
    unitDmg: 45,
    baseDps: 50,
    baseHp: 50,
  };
  const UPGRADE_INCR = {
    cap: 5,
    unitHp: 0.10, // +10%
    unitDmg: 0.10, // +10%
    baseDps: 5,    // +5 DPS
    baseHp: 500,   // +500 HP
  };

  // ---------- UPGRADES PANEL ----------
  // Build after constants are available
  const shop = document.createElement('div');
  Object.assign(shop.style, {
    position: 'absolute', right: '10px', bottom: (bottomBar.clientHeight+10)+'px',
    background: 'rgba(12,14,18,0.95)', color:'#e7eaee', border:'1px solid #2a3340',
    borderRadius:'8px', padding:'10px', display:'none', zIndex:'12', minWidth:'220px'
  });
  shop.id = 'evolvesShop';
  function shopButton(label, onClick){
    const btn = document.createElement('button');
    btn.textContent = label;
    Object.assign(btn.style, { display:'block', width:'100%', margin:'6px 0', padding:'6px 8px', background:'#1c2530', color:'#e7eaee', border:'1px solid #364150', borderRadius:'6px', cursor:'pointer' });
    btn.addEventListener('click', onClick);
    return btn;
  }
  const shopTitle = document.createElement('div'); shopTitle.textContent = 'Upgrades (U)'; shopTitle.style.fontWeight='600'; shop.appendChild(shopTitle);
  const shopGold = document.createElement('div'); shopGold.style.fontSize='12px'; shopGold.style.opacity='0.9'; shop.appendChild(shopGold);
  const btnCap = shopButton(`+${UPGRADE_INCR.cap} Unit Cap — ${UPGRADE_COSTS.cap}g`, ()=>buyUpgrade('cap'));
  const btnHp = shopButton(`Unit HP +10% — ${UPGRADE_COSTS.unitHp}g`, ()=>buyUpgrade('unitHp'));
  const btnDmg = shopButton(`Unit Damage +10% — ${UPGRADE_COSTS.unitDmg}g`, ()=>buyUpgrade('unitDmg'));
  const btnBaseDps = shopButton(`Base DPS +${UPGRADE_INCR.baseDps} — ${UPGRADE_COSTS.baseDps}g`, ()=>buyUpgrade('baseDps'));
  const btnBaseHp = shopButton(`Base HP +${UPGRADE_INCR.baseHp} — ${UPGRADE_COSTS.baseHp}g`, ()=>buyUpgrade('baseHp'));
  shop.appendChild(btnCap); shop.appendChild(btnHp); shop.appendChild(btnDmg); shop.appendChild(btnBaseDps); shop.appendChild(btnBaseHp);
  root.appendChild(shop);
  const shopToggle = document.createElement('button');
  shopToggle.textContent = 'Upgrades (U)';
  Object.assign(shopToggle.style, { background:'#1c2530', color:'#e7eaee', border:'1px solid #364150', padding:'6px 10px', borderRadius:'6px', cursor:'pointer' });
  bottomBar.insertBefore(shopToggle, restartBtn);
  function toggleShop(){ shop.style.display = shop.style.display==='none' ? 'block' : 'none'; }
  shopToggle.addEventListener('click', toggleShop);

  // ---------- UTIL ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const len = (x,y) => Math.hypot(x,y);
  const norm = (x,y) => { const l = Math.hypot(x,y)||1; return [x/l, y/l]; };
  const rnd = (a,b) => a + Math.random()*(b-a);
  const rndInt = (a,b) => Math.floor(a + Math.random()*(b-a+1));
  const choice = (arr) => arr[Math.floor(Math.random()*arr.length)];
  const nowSec = () => performance.now()/1000;
  function circleIntersect(ax,ay,ar, bx,by,br) {
    return (ax-bx)*(ax-bx) + (ay-by)*(ay-by) <= (ar+br)*(ar+br);
  }
  function dist(ax,ay,bx,by){return Math.hypot(ax-bx, ay-by);}
  function angleOf(dx,dy){return Math.atan2(dy,dx);}  

  // ---------- GAME STATE ----------
  const state = {
    time: 0,
    dt: 0,
    realDt: 0,
    width: 1280,
    height: 720,
    worldWidth: 1280,
    worldHeight: 720,
    view: { scale: 1, offX: 0, offY: 0 },
    worldInitialized: false,
    players: [],
    projectiles: [],
    effects: [],
    winner: null,
    running: true,
    arena: null,
    timeScale: TIME_SCALE,
  };

  function resizeCanvas() {
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const rectW = root.clientWidth;
    const rectH = root.clientHeight - topBar.clientHeight - bottomBar.clientHeight;
    state.width = Math.max(640, rectW);
    state.height = Math.max(360, rectH);
    // initialize world size once; thereafter, keep the same world and just change the view transform
    if (!state.worldInitialized) {
      state.worldWidth = Math.round(state.width * WORLD_SCALE);
      state.worldHeight = Math.round(state.height * WORLD_SCALE);
      state.worldInitialized = true;
    }
    const viewScale = Math.min(state.width / state.worldWidth, state.height / state.worldHeight);
    const viewOffX = (state.width / viewScale - state.worldWidth) * 0.5;
    const viewOffY = (state.height / viewScale - state.worldHeight) * 0.5;
    state.view = { scale: viewScale, offX: viewOffX, offY: viewOffY };

    canvas.width = Math.floor(state.width * dpr);
    canvas.height = Math.floor(state.height * dpr);
    canvas.style.width = state.width + 'px';
    canvas.style.height = state.height + 'px';
    // set transform to include zoom and centering
    ctx.setTransform(dpr*viewScale, 0, 0, dpr*viewScale, dpr*viewScale*viewOffX, dpr*viewScale*viewOffY);
  }
  window.addEventListener('resize', resizeCanvas);

  // ---------- INPUT ----------
  const keys = new Set();
  let mouse = {x: 0, y: 0, down: false, button: 0};
  let queuedAttackMove = false; // press 'A' to issue attack‑move on next RMB
  window.addEventListener('keydown', (e)=>{
    if (e.repeat) return;
    keys.add(e.key.toLowerCase());
    if (e.key === ' '){ e.preventDefault(); }
    if (e.key.toLowerCase() === 'r') restart();
    if (e.key.toLowerCase() === 'a') { queuedAttackMove = true; }
    if (e.key.toLowerCase() === 's') { stopSelectedOrders(); }
    if (e.key.toLowerCase() === 'u') { const shopEl=document.getElementById('evolvesShop'); if (shopEl) shopEl.style.display = shopEl.style.display==='none'?'block':'none'; }
    if (e.key.toLowerCase() === 'h') { holdSelected(); }
    if (e.key.toLowerCase() === 'p') { state.running = !state.running; }
    if (e.key === '-' || e.key === '_'){ state.timeScale = Math.max(0.05, +(state.timeScale*0.85).toFixed(3)); }
    if (e.key === '=' || e.key === '+'){ state.timeScale = Math.min(3, +(state.timeScale*1.18).toFixed(3)); }
  });
  window.addEventListener('keyup', (e)=>{
    keys.delete(e.key.toLowerCase());
  });
  canvas.addEventListener('mousemove', (e)=>{
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    // convert to world coords using view transform
    const sc = state.view.scale, ox = state.view.offX, oy = state.view.offY;
    mouse.x = cssX / sc - ox;
    mouse.y = cssY / sc - oy;
    if (dragSel.active){ dragSel.x2 = mouse.x; dragSel.y2 = mouse.y; }
  });
  canvas.addEventListener('mousedown', (e)=>{ mouse.down = true; mouse.button = e.button; handleMouseDown(e); });
  canvas.addEventListener('mouseup', (e)=>{ mouse.down = false; handleMouseUp(e); });
  canvas.addEventListener('mouseleave', ()=>{ mouse.down = false; if (dragSel.active) finalizeSelection(); });
  window.addEventListener('mouseup', (e)=>{ if (e.button===0 && dragSel.active) finalizeSelection(); });
  window.addEventListener('blur', ()=>{ if (dragSel.active) dragSel.active = false; });
  canvas.addEventListener('contextmenu', (e)=>{ e.preventDefault(); });
  restartBtn.addEventListener('click', ()=> restart());

  // ---------- ENTITIES ----------
  // Controllers own units. controller.id indexes into state.controllers
  let nextId = 1;
  function newPlayer(name, color, human=false, owner=0) {
    const tier = 0;
    return {
      id: nextId++,
      name, color, human,
      owner, // controller id
      x: rnd(ARENA_MARGIN, state.worldWidth-ARENA_MARGIN),
      y: rnd(ARENA_MARGIN, state.worldHeight-ARENA_MARGIN),
      vx: 0, vy: 0,
      radius: 12,
      maxHp: 50, hp: 50,
      speed: 160,
      tier,
      kills: 0, deaths: 0, levelKills: 0,
      cd: 0,
      dead: false, respawnAt: 0,
      dash: null, // {timeLeft, dx, dy, hitIds: Set}
      order: null, // {type:'move'|'amove'|'attack', x,y, targetId?}
      auto: null, // {anchorX, anchorY, leash, targetId, lastSeen}
      aimX: 0, aimY: 0,
      attackLock: 0,
    };
  }

  function newController(name, color, human=false) {
    return {
      id: state.controllers.length,
      name, color, human,
      aiTimer: 0,
      base: { x: 0, y: 0, r: BASE_RADIUS, maxHp: BASE_MAX_HP, hp: BASE_MAX_HP, alive: true },
      spawnTimer: 0,
      spawnInterval: SPAWN_INTERVAL,
      unitCap: UNIT_CAP,
      attackThreshold: 12, // default; strategy may override
      eliminated: false,
      // evolution progress per controller
      tier: 0,
      kills: 0,
      deaths: 0,
      levelKills: 0,
      rally: null,
      behavior: null,
      flankSign: Math.random()<0.5?-1:1,
      lastIssueTime: 0,
      waveIndex: 0,
      // economy / upgrades
      gold: 0,
      goldPassiveTimer: 0,
      unitHPScale: 1.0,
      unitDMGScale: 1.0,
      baseDpsBonus: 0,
    };
  }

  function resetTierStats(p) {
    const t = getUnitDef(p);
    p.radius = t.radius;
    const ctrl = getController(p);
    const hpScale = ctrl ? (ctrl.unitHPScale||1.0) : 1.0;
    p.maxHp = Math.round(t.hp * hpScale);
    p.hp = Math.min(p.maxHp, p.hp>0 ? p.hp : p.maxHp);
    p.speed = t.speed;
    p.cd = 0;
    p.dash = null;
  }

  function evolve(p) {
    if (p.tier >= TIERS.length-1) return;
    p.tier++;
    p.levelKills = 0;
    resetTierStats(p);
  }
  function devolve(p) {
    if (p.tier > 0) p.tier--;
    p.levelKills = 0;
    resetTierStats(p);
  }

  function spawnSafe(p) {
    // spawn near owner's base with jitter, avoiding overlaps
    const ctrl = getController(p);
    const cx = ctrl?.base?.x ?? state.worldWidth*0.5;
    const cy = ctrl?.base?.y ?? state.worldHeight*0.5;
    const tries = 50;
    for (let i=0;i<tries;i++){
      const a = Math.random()*Math.PI*2; const d = BASE_RADIUS + 30 + Math.random()*60;
      const x = clamp(cx + Math.cos(a)*d, ARENA_MARGIN, state.worldWidth-ARENA_MARGIN);
      const y = clamp(cy + Math.sin(a)*d, ARENA_MARGIN, state.worldHeight-ARENA_MARGIN);
      const far = state.players.every(o => o===p || o.dead || dist(x,y,o.x,o.y) > o.radius + p.radius + 8);
      if (far){ p.x=x; p.y=y; return; }
    }
    p.x = clamp(cx + rnd(-80,80), ARENA_MARGIN, state.worldWidth-ARENA_MARGIN);
    p.y = clamp(cy + rnd(-80,80), ARENA_MARGIN, state.worldHeight-ARENA_MARGIN);
  }

  function addProjectile(pr) { state.projectiles.push(pr); }
  function addEffect(eff) { state.effects.push(eff); }

  // helpers
  const getController = (unit) => state.controllers[unit.owner];
  const sameTeam = (a,b) => a.owner === b.owner;
  const isEnemy = (a,b) => a.owner !== b.owner;
  function getAttackRange(p){
    const atk = getUnitDef(p).attack;
    if (atk.type === 'bullet' || atk.type==='burst' || atk.type==='splash' || atk.type==='homing' || atk.type==='hitscan'){
      const base = (atk.range != null)
        ? (atk.range)
        : ((atk.projSpeed||400) * (atk.life||1.0) * 0.95);
      return Math.min(MAX_ATTACK_RANGE, base * ATTACK_RANGE_MULT);
    }
    if (atk.type==='dash'){
      // Melee trigger range should not be scaled so Zerglings reliably engage
      return Math.min(MAX_ATTACK_RANGE, (atk.range || 80));
    }
    if (atk.type==='chain'){
      return Math.min(MAX_ATTACK_RANGE, (atk.range||60) * ATTACK_RANGE_MULT);
    }
    if (atk.type === 'aoe' || atk.type==='cleave') return (atk.radius||60)+p.radius*0.5; // leave melee/aoe as-is
    return 140;
  }
  function autoAcquireTarget(me, radius){
    let best=null, bd=Infinity; radius = radius||getAttackRange(me);
    for (const o of state.players){ if (o.dead || o.id===me.id || !isEnemy(me,o)) continue; const d=dist(me.x,me.y,o.x,o.y); if (d<bd && d<=radius){ bd=d; best=o; } }
    return best;
  }

  function adjustPointOutsideBases(px, py, margin=8){
    let x = px, y = py; let changed = true; let guard=0;
    while (changed && guard<6){
      changed = false; guard++;
      for (const c of state.controllers){ const b=c.base; if (!b?.alive) continue; const dx=x-b.x, dy=y-b.y; let d=Math.hypot(dx,dy);
        const minD = b.r + margin; if (d < minD){ if (d<0.0001){ x += 0.01; d = Math.hypot(x-b.x, y-b.y); }
          const nx = (x-b.x)/d, ny=(y-b.y)/d; x = b.x + nx*minD; y = b.y + ny*minD; changed=true; }
      }
    }
    return [x,y];
  }
  function keepOutsideBases(p){
    for (const c of state.controllers){ const b=c.base; if (!b?.alive) continue; const dx=p.x-b.x, dy=p.y-b.y; let d=Math.hypot(dx,dy); const minD=b.r + p.radius + 1;
      if (d < minD){ if (d<0.0001){ const ang=Math.random()*Math.PI*2; p.x=b.x+Math.cos(ang)*minD; p.y=b.y+Math.sin(ang)*minD; }
        else { const nx=dx/d, ny=dy/d; p.x = b.x + nx*minD; p.y = b.y + ny*minD; }
      }
    }
  }
  function resolveUnitCollisions(iters=1){
    const arr = state.players.filter(p=>!p.dead);
    for (let k=0;k<iters;k++){
      for (let i=0;i<arr.length;i++){
        const a = arr[i];
        for (let j=i+1;j<arr.length;j++){
          const b = arr[j];
          let dx=b.x-a.x, dy=b.y-a.y; let d=Math.hypot(dx,dy);
          const af = getUnitDef(a).flying === true;
          const bf = getUnitDef(b).flying === true;
          const sumR = a.radius + b.radius + 0.5;
          // flying overlap allowance: smaller minimum distance when at speed, light separation when idle
          const movingA = Math.hypot(a.vx||0, a.vy||0) > 5;
          const movingB = Math.hypot(b.vx||0, b.vy||0) > 5;
          let minD = sumR;
          let softness = 1.0;
          if (af && bf){
            if (movingA || movingB){
              minD = sumR * 0.3; // allow significant overlap in motion
              softness = 0.0;    // skip pushing while moving
            } else {
              minD = sumR * 0.6; // closer-than-normal packing when idle
              softness = 0.35;   // gentle push to slowly spread out
            }
          }
          if (d < minD){
            if (softness === 0.0) continue; // allow overlap while moving (flying)
            if (d<0.0001){ const ang=Math.random()*Math.PI*2; dx=Math.cos(ang); dy=Math.sin(ang); d=1; }
            const nx=dx/d, ny=dy/d; const push=(minD-d)*0.5*softness; a.x -= nx*push; a.y -= ny*push; b.x += nx*push; b.y += ny*push;
            a.x = clamp(a.x, ARENA_MARGIN, state.worldWidth-ARENA_MARGIN); a.y = clamp(a.y, ARENA_MARGIN, state.worldHeight-ARENA_MARGIN);
            b.x = clamp(b.x, ARENA_MARGIN, state.worldWidth-ARENA_MARGIN); b.y = clamp(b.y, ARENA_MARGIN, state.worldHeight-ARENA_MARGIN);
          }
        }
      }
    }
    for (const p of arr){ keepOutsideBases(p); }
  }

  function fireBullet(owner, dirx, diry, opts) {
    const t = TIERS[owner.tier];
    const spd = opts.projSpeed || t.attack.projSpeed || 420;
    const maxRange = getAttackRange(owner);
    const ttlCap = Math.max(0.1, (maxRange) / spd);
    const ttl = Math.min(opts.life || 1.2, ttlCap);
    addProjectile({
      type: 'bullet', owner: owner.id,
      x: owner.x + dirx*(owner.radius+2),
      y: owner.y + diry*(owner.radius+2),
      vx: dirx*spd, vy: diry*spd,
      r: 4, ttl,
      dmg: opts.damage || t.attack.damage || 14,
      splash: opts.splash || 0,
    });
  }

  function fireBurst(owner, aimx, aimy) {
    const atk = getUnitDef(owner).attack;
    const dx = aimx-owner.x, dy = aimy-owner.y; const [nx,ny] = norm(dx,dy);
    const baseAng = angleOf(nx,ny);
    for (let i=0;i<atk.count;i++){
      const a = baseAng + (i - (atk.count-1)/2) * atk.spread;
      fireBullet(owner, Math.cos(a), Math.sin(a), { projSpeed: atk.projSpeed, damage: atk.damage, life: atk.life, splash: atk.splash });
    }
  }

  function fireSplash(owner, aimx, aimy) {
    const atk = getUnitDef(owner).attack;
    const dx = aimx-owner.x, dy = aimy-owner.y; const [nx,ny] = norm(dx,dy);
    const spd = atk.projSpeed;
    const maxRange = getAttackRange(owner);
    const ttlCap = Math.max(0.1, (maxRange) / Math.max(1, spd));
    const ttl = Math.min(atk.life || 1.2, ttlCap);
    addProjectile({
      type: 'splash', owner: owner.id,
      x: owner.x + nx*(owner.radius+2), y: owner.y + ny*(owner.radius+2),
      vx: nx*spd, vy: ny*spd,
      r: 6, ttl, dmg: atk.damage, splash: atk.splash
    });
  }

  function fireHoming(owner, aimx, aimy) {
    const atk = getUnitDef(owner).attack;
    const dx = aimx-owner.x, dy = aimy-owner.y; const [nx,ny] = norm(dx,dy);
    const spd = atk.projSpeed;
    const maxRange = getAttackRange(owner);
    const ttlCap = Math.max(0.2, (maxRange) / Math.max(1, spd));
    const ttl = Math.min(atk.life, ttlCap);
    addProjectile({
      type: 'homing', owner: owner.id,
      x: owner.x + nx*(owner.radius+2), y: owner.y + ny*(owner.radius+2),
      vx: nx*spd, vy: ny*spd,
      r: 5, ttl, dmg: atk.damage, splash: 0, turn: atk.turn
    });
  }

  function fireHitscan(owner, aimx, aimy) {
    const atk = getUnitDef(owner).attack;
    const dx = aimx-owner.x, dy = aimy-owner.y; const [nx,ny] = norm(dx,dy);
    const range = getAttackRange(owner);
    let bestT = range, hitX = owner.x + nx*range, hitY = owner.y + ny*range, hitUnit = null, hitBase = null;
    // units
    for (const o of state.players){
      if (o.dead || o.id===owner.id || !isEnemy(owner,o)) continue;
      const vx = o.x - owner.x, vy = o.y - owner.y;
      const t = vx*nx + vy*ny; if (t<=0 || t>bestT) continue;
      // perpendicular distance to ray
      const px = owner.x + nx*t, py = owner.y + ny*t;
      const r = dist(px,py, o.x,o.y);
      if (r <= o.radius){ bestT = t; hitX = px; hitY = py; hitUnit = o; hitBase = null; }
    }
    // bases
    for (const c of state.controllers){
      if (!c.base?.alive) continue; if (c.id===owner.owner) continue;
      const bx = c.base.x, by = c.base.y; const R = c.base.r;
      const vx = bx - owner.x, vy = by - owner.y; const t = vx*nx + vy*ny; if (t<=0 || t>bestT) continue;
      const px = owner.x + nx*t, py = owner.y + ny*t; const r = dist(px,py,bx,by);
      if (r <= R){ bestT = t; hitX = px; hitY = py; hitUnit = null; hitBase = c; }
    }
    // apply damage and draw tracer
    const life = 0.06;
    addEffect({ type:'tracer', x1: owner.x, y1: owner.y, x2: hitX, y2: hitY, ttl: life });
    if (hitUnit){ damagePlayer(hitUnit, atk.damage, owner.id); addEffect({type:'spark', x:hitX, y:hitY, ttl:0.12}); }
    else if (hitBase){ damageBase(hitBase, atk.damage, owner); addEffect({type:'spark', x:hitX, y:hitY, ttl:0.12}); }
  }

  function doChain(owner, aimx, aimy) {
    const atk = getUnitDef(owner).attack;
    // pick first target: closest to aim direction within range
    const dir = Math.atan2(aimy-owner.y, aimx-owner.x);
    const candidates = state.players.filter(o=>!o.dead && o.id!==owner.id && isEnemy(owner, o));
    let first = null; let bestScore = Infinity;
    for (const o of candidates){
      const d = dist(owner.x,owner.y,o.x,o.y);
      if (d>atk.range) continue;
      const ang = Math.atan2(o.y-owner.y, o.x-owner.x);
      const da = Math.abs(Math.atan2(Math.sin(ang-dir), Math.cos(ang-dir)));
      const score = d * (1 + da*0.5);
      if (score < bestScore){ bestScore = score; first = o; }
    }
    if (!first) return;
    const hit = [first];
    let current = first;
    for (let j=0; j<atk.jumps; j++){
      // next nearest not yet hit
      let next = null, nd = Infinity;
      for (const o of candidates){
        if (hit.includes(o)) continue;
        const d = dist(current.x,current.y,o.x,o.y);
        if (d<nd && d<=atk.jumpRange) { nd = d; next = o; }
      }
      if (!next) break;
      hit.push(next); current = next;
    }
    // apply damage and add visual links
    let prevX = owner.x, prevY = owner.y;
    for (const o of hit){
      damagePlayer(o, atk.damage, owner.id);
      const life = 0.22;
      addEffect({type:'link', x1:prevX, y1:prevY, x2:o.x, y2:o.y, ttl:life, life});
      addEffect({type:'spark', x:o.x, y:o.y, ttl:0.18});
      prevX = o.x; prevY = o.y;
    }
  }

  function doAOE(owner) {
    const atk = getUnitDef(owner).attack;
    addEffect({type:'ring', x:owner.x, y:owner.y, r:atk.radius, ttl:0.18});
    for (const o of state.players){
      if (o.id===owner.id || o.dead) continue;
      if (dist(owner.x,owner.y,o.x,o.y) <= atk.radius + o.radius*0.5){
        damagePlayer(o, atk.damage, owner.id);
      }
    }
    for (const c of state.controllers){
      if (c.id===owner.owner || !c.base?.alive) continue;
      if (dist(owner.x,owner.y,c.base.x,c.base.y) <= atk.radius + c.base.r*0.5){
        damageBase(c, atk.damage, owner);
      }
    }
  }

  function doCleave(owner) {
    const atk = getUnitDef(owner).attack;
    // frontal arc 120 degrees
    const aim = Math.atan2(owner.aimY-owner.y, owner.aimX-owner.x);
    addEffect({type:'arc', x:owner.x, y:owner.y, r:atk.radius, a:aim, spread:Math.PI*2/3, ttl:0.12});
    for (const o of state.players){
      if (o.id===owner.id || o.dead) continue;
      const dx=o.x-owner.x, dy=o.y-owner.y; const d = Math.hypot(dx,dy);
      if (d>atk.radius+o.radius*0.5) continue;
      const ang = Math.atan2(dy,dx);
      const da = Math.abs(Math.atan2(Math.sin(ang-aim), Math.cos(ang-aim)));
      if (da <= Math.PI/3) damagePlayer(o, atk.damage, owner.id);
    }
    for (const c of state.controllers){
      if (c.id===owner.owner || !c.base?.alive) continue;
      const dx=c.base.x-owner.x, dy=c.base.y-owner.y; const d = Math.hypot(dx,dy);
      if (d>atk.radius+c.base.r*0.5) continue;
      const ang = Math.atan2(dy,dx);
      const da = Math.abs(Math.atan2(Math.sin(ang-aim), Math.cos(ang-aim)));
      if (da <= Math.PI/3) damageBase(c, atk.damage, owner);
    }
  }

  function startDash(owner, aimx, aimy) {
    const atk = getUnitDef(owner).attack;
    const [nx,ny] = norm(aimx-owner.x, aimy-owner.y);
    owner.dash = { timeLeft: atk.dashTime, dx: nx, dy: ny, hitIds: new Set(), trail: 0.0 };
    // visible slash at dash start
    const ang = Math.atan2(ny, nx);
    addEffect({ type:'slash', x: owner.x, y: owner.y, a: ang, r: owner.radius + 26, spread: Math.PI/2.2, color: owner.color, ttl: 0.12 });
  }

  function applyDash(owner, dt) {
    const atk = getUnitDef(owner).attack;
    if (!owner.dash) return;
    const d = owner.dash;
    const move = atk.dashSpeed * dt;
    // trailing afterimage while zergling dashes
    d.trail -= dt;
    if (d.trail <= 0){
      addEffect({ type:'after', x: owner.x, y: owner.y, r: owner.radius+2, ttl: 0.08 });
      d.trail = 0.028; // fewer afterimages to reduce visual clutter
    }
    owner.x += d.dx * move; owner.y += d.dy * move;
    owner.x = clamp(owner.x, ARENA_MARGIN, state.worldWidth-ARENA_MARGIN);
    owner.y = clamp(owner.y, ARENA_MARGIN, state.worldHeight-ARENA_MARGIN);
    // damage on contact once per target per dash
    let endDash = false;
    for (const o of state.players){
      if (o.id===owner.id || o.dead) continue;
      if (d.hitIds.has(o.id)) continue;
      if (circleIntersect(owner.x,owner.y, owner.radius+6, o.x,o.y,o.radius)){
        d.hitIds.add(o.id);
        damagePlayer(o, atk.damage, owner.id);
        // claw impact
        const ang = Math.atan2(d.dy, d.dx);
        addEffect({ type:'claw', x:o.x, y:o.y, a: ang, r: owner.radius+8, ttl: 0.12 });
        endDash = true;
        break;
      }
    }
    // base collision damage
    if (!endDash) for (const c of state.controllers){
      if (c.id===owner.owner || !c.base?.alive) continue;
      const key = `b${c.id}`;
      if (d.hitIds.has(key)) continue;
      if (circleIntersect(owner.x,owner.y, owner.radius+6, c.base.x, c.base.y, c.base.r)){
        d.hitIds.add(key);
        damageBase(c, atk.damage, owner);
        endDash = true;
        break;
      }
    }
    if (endDash){ owner.dash = null; }
    d.timeLeft -= dt;
    if (d.timeLeft <= 0) owner.dash = null;
  }

  function damagePlayer(target, dmg, attackerId, source='unit') {
    if (target.dead) return;
    let out = dmg;
    if (source === 'unit' && attackerId != null){
      // apply global outgoing tuning and unit-vs-unit scaling
      out *= UNIT_DAMAGE_MULT * UNIT_VS_UNIT_DMG_MULT;
      const atkUnit = state.players.find(u=>u.id===attackerId);
      if (atkUnit){ const cc = getController(atkUnit); if (cc) out *= (cc.unitDMGScale||1.0); }
    }
    if (source === 'base'){
      const early = target.tier <= 2 ? BASE_VS_EARLY_MULT : 1.0;
      out *= early;
    }
    target.hp -= out;
    addEffect({type:'hurt', x:target.x, y:target.y, ttl:0.08});
    if (target.hp <= 0){
      killPlayer(target, attackerId);
    }
  }

  function damageBase(ctrl, dmg, attackerUnit) {
    const b = ctrl.base; if (!b || !b.alive) return;
    let out = dmg;
    if (attackerUnit){
      // early-tier bonus damage into bunker to encourage aggression
      if (attackerUnit.tier <= 2) out *= BASE_INCOMING_EARLY_MULT;
    }
    b.hp -= out;
    if (b.hp < 0) b.hp = 0;
    addEffect({type:'ring', x:b.x, y:b.y, r:Math.max(18, Math.min(36, 36*(out/60))), ttl:0.1});
    if (b.hp <= 0 && b.alive){ b.alive = false; onBunkerDestroyed(ctrl); }
    ctrl.lastUnderAttack = state.time;
    // gold for attacker for damaging base
    if (attackerUnit){ const atkCtrl = getController(attackerUnit); if (atkCtrl){ atkCtrl.gold = (atkCtrl.gold||0) + out * GOLD_PER_BASE_DAMAGE; } }
  }

  function onBunkerDestroyed(ctrl){
    ctrl.eliminated = true;
    // kill or remove all units of this controller
    for (const u of state.players){ if (u.owner===ctrl.id && !u.dead){ u.dead = true; u.hp = 0; u.respawnAt = Infinity; } }
    overlayFlash(`${ctrl.name} bunker destroyed!`);
  }

  function killPlayer(target, attackerId) {
    target.dead = true;
    target.deaths++;
    target.respawnAt = Infinity; // no respawn; replaced by new spawns only
    if (state.selection) state.selection.delete(target.id);
    const killer = state.players.find(p=>p.id===attackerId);
    if (killer){
      killer.kills++;
      const kc = getController(killer);
      if (kc){
        kc.kills++;
        kc.levelKills++;
        kc.gold = (kc.gold||0) + GOLD_PER_KILL;
        // stop movement after kill
        killer.vx = 0; killer.vy = 0;
        if (killer.dash) killer.dash = null;
        if (killer.order && (killer.order.type==='attack' || killer.order.type==='amove')) killer.order = null;
        // controller-level evolve
        if (kc.tier < tiersLen(kc)-1){
          const need = killsToEvolveNeeded(kc);
          if (kc.levelKills >= need){
            kc.tier++;
            kc.levelKills = 0;
            overlayFlash(`${kc.name} evolved to ${getUnitNameFor(kc, kc.tier)}!`);
            // Do not transform existing units; only future spawns/respawns use new tier
          }
        }
      }
    }
    // controller deaths stat
    const tc = getController(target); if (tc) tc.deaths++;
  }

  // ---------- AI ----------
  function chooseTarget(me) {
    let best=null, bd=Infinity;
    for (const o of state.players){
      if (o===me || o.dead || !isEnemy(me,o)) continue; const d=dist(me.x,me.y,o.x,o.y); if (d<bd){bd=d; best=o;}
    }
    if (best) return best;
    // consider enemy bunkers if no unit nearby
    for (const c of state.controllers){
      if (!c.base?.alive || c.id===me.owner) continue;
      const d = dist(me.x,me.y,c.base.x,c.base.y); if (d<bd){ bd=d; best = { x:c.base.x, y:c.base.y, isBase:true, ctrl:c}; }
    }
    return best;
  }
  function steer(me, target, dt) {
    if (!target) return [0,0];
    const dx=target.x-me.x, dy=target.y-me.y;
    const [nx,ny] = norm(dx,dy);
    // simple separation
    let sx=0, sy=0; 
    for (const o of state.players){
      if (o===me || o.dead) continue;
      const d = dist(me.x,me.y,o.x,o.y);
      if (d<40){ const [rx,ry]=norm(me.x-o.x, me.y-o.y); const f = (40-d)/40; sx+=rx*f; sy+=ry*f; }
    }
    const vx = nx*0.8 + sx*0.6, vy = ny*0.8 + sy*0.6;
    const l = Math.hypot(vx,vy)||1; return [vx/l, vy/l];
  }
  function botThink(me, dt) {
    if (me.dead) return;
    const ctrl = getController(me);
    const army = controllerUnits(ctrl.id).length;
    if (army < ctrl.attackThreshold){
      // rally near base
      const dx = ctrl.base.x - me.x, dy = ctrl.base.y - me.y, d = Math.hypot(dx,dy);
      if (d>20){ const [nx,ny]=norm(dx,dy); me.vx = nx*me.speed; me.vy=ny*me.speed; }
      else { me.vx=0; me.vy=0; }
      return;
    }
    const tgt = chooseTarget(me);
    if (tgt){ me.aimX = tgt.x; me.aimY = tgt.y; }
    const [mx,my] = steer(me, tgt, dt);
    const sp = me.speed;
    me.vx = mx*sp; me.vy = my*sp;
    // attack if in cooldown ready
    if (me.cd<=0 && tgt){ performAttack(me, me.aimX, me.aimY); }
  }

  // ---------- HUMAN ORDERS ----------
  state.controllers = [];
  state.selection = new Set();
  state.selectedBaseCtrlId = null; // when selecting your bunker
  let dragSel = {active:false, x1:0, y1:0, x2:0, y2:0};

  function clearSelection(){ state.selection.clear(); state.selectedBaseCtrlId = null; }
  function addToSelection(unit){ if (unit && !unit.dead) state.selection.add(unit.id); }
  function getSelectedUnits(){ const ids = state.selection; return state.players.filter(p=>ids.has(p.id) && !p.dead && getController(p).human); }

  function rectNormalize(r){
    const x = Math.min(r.x1,r.x2), y=Math.min(r.y1,r.y2), w=Math.abs(r.x2-r.x1), h=Math.abs(r.y2-r.y1);
    return {x,y,w,h};
  }
  // ---------- BASES, SPAWNS, CONTROLLER AI ----------
  function controllerUnits(ctrlId){ return state.players.filter(p=>!p.dead && p.owner===ctrlId); }
  function enemyControllers(ctrl){ return state.controllers.filter(c=>c.id!==ctrl.id && !c.eliminated && c.base?.alive); }
  function ringPoint(angle, radiusOffset=0){
    const R = Math.max(80, (state.arena?.r||Math.min(state.worldWidth,state.worldHeight)*0.45) - (BASE_RADIUS+60) + radiusOffset);
    const cx = state.arena?.x || state.worldWidth*0.5; const cy = state.arena?.y || state.worldHeight*0.5;
    return { x: cx + Math.cos(angle)*R, y: cy + Math.sin(angle)*R };
  }
  function angleAt(x,y){ const cx=state.arena?.x||state.worldWidth*0.5; const cy=state.arena?.y||state.worldHeight*0.5; return Math.atan2(y-cy, x-cx); }
  function setRally(ctrl, x, y){ const pt = adjustPointOutsideBases(x,y, BASE_RADIUS+16); ctrl.rally = { x: pt[0], y: pt[1] }; }
  function issueAmove(units, x, y){ const pt = adjustPointOutsideBases(x,y, 18); for (const u of units){ u.order = { type:'amove', x: pt[0], y: pt[1] }; } }
  function issueMove(units, x, y){ const pt = adjustPointOutsideBases(x,y, 18); for (const u of units){ u.order = { type:'move', x: pt[0], y: pt[1] }; } }
  function spawnUnit(ctrl){
    const u = newPlayer(`${ctrl.name}-${Math.floor(Math.random()*1000)}`, ctrl.color, ctrl.human, ctrl.id);
    spawnSafe(u); // uses controller base
    state.players.push(u);
    // set unit tier to controller tier
    u.tier = ctrl.tier; resetTierStats(u);
    if (ctrl.rally){ const [rx,ry]=adjustPointOutsideBases(ctrl.rally.x, ctrl.rally.y, u.radius+6); u.order = { type:'move', x: rx, y: ry }; }
  }

  // Global squad spawn helper (around controller base)
  function spawnSquad(ctrl){
    if (!ctrl || !ctrl.base) return;
    for (let i=0;i<UNITS_PER_SIDE;i++){
      const u = newPlayer(`${ctrl.name}-${i+1}`, ctrl.color, ctrl.human, ctrl.id);
      const a = Math.random()*Math.PI*2; const d = BASE_RADIUS + 30 + Math.random()*60;
      u.x = clamp(ctrl.base.x + Math.cos(a)*d, ARENA_MARGIN, state.worldWidth-ARENA_MARGIN);
      u.y = clamp(ctrl.base.y + Math.sin(a)*d, ARENA_MARGIN, state.worldHeight-ARENA_MARGIN);
      u.tier = ctrl.tier; resetTierStats(u);
      state.players.push(u);
      if (ctrl.rally){ const [rx,ry]=adjustPointOutsideBases(ctrl.rally.x, ctrl.rally.y, u.radius+6); u.order = { type:'move', x: rx, y: ry }; }
    }
  }

  function canAfford(ctrl, cost){ return (ctrl.gold||0) >= cost; }
  function spend(ctrl, cost){ if (!canAfford(ctrl, cost)) return false; ctrl.gold -= cost; return true; }
  function buyUpgrade(kind){
    const ctrl = state.controllers.find(c=>c.human);
    if (!ctrl) return;
    const cost = UPGRADE_COSTS[kind];
    if (!spend(ctrl, cost)) { showToast('Not enough gold'); return; }
    switch(kind){
      case 'cap': ctrl.unitCap += UPGRADE_INCR.cap; showToast(`Unit cap +${UPGRADE_INCR.cap}`); break;
      case 'unitHp': ctrl.unitHPScale = (ctrl.unitHPScale||1)+UPGRADE_INCR.unitHp; showToast('Unit HP +10% (new spawns)'); break;
      case 'unitDmg': ctrl.unitDMGScale = (ctrl.unitDMGScale||1)+UPGRADE_INCR.unitDmg; showToast('Unit Damage +10%'); break;
      case 'baseDps': ctrl.baseDpsBonus = (ctrl.baseDpsBonus||0)+UPGRADE_INCR.baseDps; showToast(`Base DPS +${UPGRADE_INCR.baseDps}`); break;
      case 'baseHp': ctrl.base.maxHp += UPGRADE_INCR.baseHp; ctrl.base.hp += UPGRADE_INCR.baseHp; showToast(`Base HP +${UPGRADE_INCR.baseHp}`); break;
      }
  }

  function selectFaction(faction){
    const human = state.controllers.find(c=>c.human);
    if (!human) return;
    human.faction = faction;
    // set a sensible rally toward nearest enemy
    setDefaultRally(human);
    // spawn initial squad for player
    if (typeof spawnSquad === 'function') spawnSquad(human);
    // hide panel
    factionPanel.style.display='none';
  }
  function initAIStrategy(ctrl){
    if (ctrl.human) return;
    const types = ['turtle','raider','pincer','swarm'];
    ctrl.behavior = choice(types);
    if (ctrl.behavior==='turtle') ctrl.attackThreshold = Math.max(16, Math.floor(ctrl.unitCap*0.6));
    if (ctrl.behavior==='raider') ctrl.attackThreshold = 6;
    if (ctrl.behavior==='pincer') ctrl.attackThreshold = 12;
    if (ctrl.behavior==='swarm') ctrl.attackThreshold = 8;
  }

  function setDefaultRally(ctrl){
    // pick closest enemy bunker and set rally on the side facing it, near our base perimeter
    const enemies = enemyControllers(ctrl);
    if (enemies.length===0) { setRally(ctrl, ctrl.base.x, ctrl.base.y + ctrl.base.r + 140); return; }
    let closest = enemies[0]; let bd = Infinity;
    for (const e of enemies){ const d = dist(ctrl.base.x, ctrl.base.y, e.base.x, e.base.y); if (d<bd){ bd=d; closest=e; } }
    const vx = closest.base.x - ctrl.base.x, vy = closest.base.y - ctrl.base.y; const vlen = Math.hypot(vx,vy)||1;
    const nx = vx/vlen, ny = vy/vlen; const r = ctrl.base.r + 140;
    setRally(ctrl, ctrl.base.x + nx*r, ctrl.base.y + ny*r);
  }

  // Pick an enemy base to focus using a simple heuristic
  function chooseBaseTarget(ctrl){
    const enemies = enemyControllers(ctrl);
    if (enemies.length===0) return null;
    // precompute furthest distance for normalization
    let maxD = 1;
    for (const e of enemies){ const d = dist(ctrl.base.x, ctrl.base.y, e.base.x, e.base.y); if (d>maxD) maxD = d; }
    let best = enemies[0]; let bestScore = Infinity;
    for (const e of enemies){
      const d = dist(ctrl.base.x, ctrl.base.y, e.base.x, e.base.y);
      const defenders = state.players.filter(p=>!p.dead && p.owner===e.id && dist(p.x,p.y, e.base.x, e.base.y) <= BASE_DEFENSE_RANGE + 140).length;
      const hpFrac = Math.max(0.01, (e.base.hp||1) / Math.max(1, e.base.maxHp||1));
      const distFrac = d / maxD;
      const score = hpFrac*1.0 + distFrac*0.35 + (defenders/20)*0.6; // lower score = better target
      if (score < bestScore){ bestScore = score; best = e; }
    }
    return best;
  }

  function issueAttackBase(units, targetCtrl){
    for (const u of units){ u.order = { type:'attack', targetId: `b${targetCtrl.id}` }; }
  }

  function aiControllerThink(ctrl, dt){
    if (ctrl.human || ctrl.eliminated || !ctrl.base?.alive) return;
    ctrl.aiTimer += dt;
    const myUnits = controllerUnits(ctrl.id);
    const enemies = enemyControllers(ctrl);
    if (enemies.length===0) return;
    const nearBaseAngle = angleAt(ctrl.base.x, ctrl.base.y);
    const target = chooseBaseTarget(ctrl);
    const weakest = target;
    const closest = target;
    // defense awareness: collect hostiles around the base
    const threats = [];
    const alertR = BASE_DEFENSE_RANGE + 180;
    for (const p of state.players){ if (p.dead || p.owner===ctrl.id) continue; if (dist(p.x,p.y, ctrl.base.x, ctrl.base.y) <= alertR) threats.push(p); }
    const nearbyHostiles = threats.length;
    const underAttack = (ctrl.lastUnderAttack && (state.time - ctrl.lastUnderAttack) < 5.0);

    // ensure a rally exists and is reasonable (near own base)
    if (!ctrl.rally || isNaN(ctrl.rally.x) || isNaN(ctrl.rally.y) || dist(ctrl.rally.x, ctrl.rally.y, ctrl.base.x, ctrl.base.y) > 800){
      setDefaultRally(ctrl);
    }

    const now = state.time;
    const issueCooldown = 1.2; // minimum seconds between mass orders
    if (now - ctrl.lastIssueTime < issueCooldown) return;

    // Immediate defense: pull most units to defend at the side being threatened
    if (nearbyHostiles>0 || underAttack){
      // focus on nearest hostile to the base
      let focus = null, bd=Infinity;
      for (const p of threats){ const d = dist(ctrl.base.x, ctrl.base.y, p.x, p.y); if (d<bd){ bd=d; focus=p; } }
      // if no explicit threat (underAttack true), face toward arena center but on perimeter
      const fx = focus ? focus.x : (ctrl.base.x + Math.cos(nearBaseAngle)*(ctrl.base.r+160));
      const fy = focus ? focus.y : (ctrl.base.y + Math.sin(nearBaseAngle)*(ctrl.base.r+160));
      // set rally to perimeter on the side of focus
      const vx = fx - ctrl.base.x, vy = fy - ctrl.base.y; const vlen = Math.hypot(vx,vy)||1; const rr = ctrl.base.r + 120;
      setRally(ctrl, ctrl.base.x + vx/vlen*rr, ctrl.base.y + vy/vlen*rr);
      const defenders = myUnits; // all units defend for now; can be split later
      issueAmove(defenders, fx, fy);
      ctrl.lastIssueTime = now;
      return;
    }

    switch (ctrl.behavior){
      case 'turtle': {
        // Hover near own base until large army, then push weakest enemy via a flank waypoint
        if (myUnits.length >= ctrl.attackThreshold){
          const targetAng = angleAt(target.base.x, target.base.y);
          const wp = ringPoint(targetAng + ctrl.flankSign*0.6);
          setRally(ctrl, wp.x, wp.y);
          // if assembled near waypoint, move to target
          const assembled = myUnits.filter(u=> dist(u.x,u.y, wp.x,wp.y) < 220).length > Math.max(6, myUnits.length*0.6);
          if (!assembled){ issueAmove(myUnits, wp.x, wp.y); }
          else {
            // push to base; once within range, switch to direct base attack to focus it down
            const near = myUnits.filter(u=> dist(u.x,u.y, target.base.x, target.base.y) < BASE_DEFENSE_RANGE + 40);
            if (near.length > Math.max(6, myUnits.length*0.5) || (target.base.hp/target.base.maxHp) < 0.25){
              issueAttackBase(myUnits, target);
            } else {
              issueAmove(myUnits, target.base.x, target.base.y);
            }
          }
          ctrl.lastIssueTime = now;
        } else {
          // keep rally near base perimeter, rotating slightly
          if (ctrl.aiTimer>3){ ctrl.aiTimer=0; const ang = nearBaseAngle + ctrl.flankSign*rnd(0.2,0.5); const r = ctrl.base.r + 140; setRally(ctrl, ctrl.base.x + Math.cos(ang)*r, ctrl.base.y + Math.sin(ang)*r); }
        }
      } break;
      case 'raider': {
        // Send small squads periodically to harass around the ring, avoiding direct base defense
        if (ctrl.aiTimer>4){
          ctrl.aiTimer = 0; ctrl.waveIndex++;
          const tAng = angleAt(target.base.x, target.base.y);
          const wp = ringPoint(tAng + (ctrl.waveIndex%2===0? 0.9 : -0.9));
          const squadSize = Math.min(8, Math.max(4, Math.floor(myUnits.length*0.35)));
          const squad = myUnits.slice(0, squadSize);
          issueAmove(squad, wp.x, wp.y);
          // if base is weak, direct squad to attack base instead
          if ((target.base.hp/target.base.maxHp) < 0.35){ issueAttackBase(squad, target); }
          // keep remainder near a rally slightly opposite side
          const r = ctrl.base.r + 140; const ang2 = nearBaseAngle - ctrl.flankSign*0.5; setRally(ctrl, ctrl.base.x + Math.cos(ang2)*r, ctrl.base.y + Math.sin(ang2)*r);
          ctrl.lastIssueTime = now;
        }
      } break;
      case 'pincer': {
        // Split force into two flanks then converge on target
        if (myUnits.length >= ctrl.attackThreshold){
          const tAng = angleAt(target.base.x, target.base.y);
          const left = ringPoint(tAng - 0.8), right = ringPoint(tAng + 0.8);
          const half = Math.ceil(myUnits.length/2);
          issueAmove(myUnits.slice(0,half), left.x, left.y);
          issueAmove(myUnits.slice(half), right.x, right.y);
          // after initial move, on next cycle send all to target
          ctrl.lastIssueTime = now;
        }
        if (ctrl.aiTimer>5 && myUnits.length >= Math.max(8, ctrl.attackThreshold-2)){
          ctrl.aiTimer=0;
          // if we have mass or base is low, commit to direct base attack
          const low = (target.base.hp/target.base.maxHp) < 0.3;
          if (low){ issueAttackBase(myUnits, target); }
          else { issueAmove(myUnits, target.base.x, target.base.y); }
          ctrl.lastIssueTime = now;
        }
      } break;
      case 'swarm': default: {
        // Constant pressure: rally toward center, then send waves
        if (ctrl.aiTimer>2.5){
          ctrl.aiTimer=0;
          // keep rally not too far from base
          const ang = nearBaseAngle + ctrl.flankSign*rnd(0.1,0.35); const r = ctrl.base.r + 160;
          setRally(ctrl, ctrl.base.x + Math.cos(ang)*r, ctrl.base.y + Math.sin(ang)*r);
          const wave = Math.min(myUnits.length, 10 + rndInt(0,6));
          const slice = myUnits.slice(0,wave);
          if ((target.base.hp/target.base.maxHp) < 0.35){ issueAttackBase(slice, target); }
          else { issueAmove(slice, target.base.x, target.base.y); }
          ctrl.lastIssueTime = now;
        }
      } break;
    }
  }
  function baseDefenseTick(ctrl, dt){
    const bx = ctrl.base.x, by = ctrl.base.y;
    let tgt=null, bd=Infinity;
    for (const p of state.players){ if (p.dead || p.owner===ctrl.id) continue; const d=dist(bx,by,p.x,p.y); if (d<=BASE_DEFENSE_RANGE && d<bd){ bd=d; tgt=p; } }
    if (tgt){
      // visible beam (distinct from chain/link effects)
      addEffect({type:'basebeam', x1:bx, y1:by, x2:tgt.x, y2:tgt.y, ttl:0.06});
      // slight falloff so edge hits feel lighter
      const d = Math.max(1, dist(bx,by,tgt.x,tgt.y));
      const falloff = Math.max(0.4, 1 - (d / BASE_DEFENSE_RANGE));
      const dps = (BASE_DPS + (ctrl.baseDpsBonus||0));
      damagePlayer(tgt, dps*dt*falloff, null, 'base');
    }
  }
  function inRect(p, r){ return p.x>=r.x && p.x<=r.x+r.w && p.y>=r.y && p.y<=r.y+r.h; }

  function stopSelectedOrders(){ for (const u of getSelectedUnits()){ u.order=null; u.auto=null; u.vx=0; u.vy=0; } }
  function holdSelected(){ for (const u of getSelectedUnits()){ u.order={type:'hold'}; u.auto=null; u.vx=0; u.vy=0; } }

  function formationOffsets(n){
    const gap = 26; const perRow = Math.ceil(Math.sqrt(n)); const res=[];
    for (let i=0;i<n;i++){ const row=Math.floor(i/perRow), col=i%perRow; const ox=(col-(perRow-1)/2)*gap; const oy=(row-(perRow-1)/2)*gap; res.push([ox,oy]); }
    return res;
  }
  function issueOrdersAt(x,y, kind){
    const selected = getSelectedUnits(); if (selected.length===0) return;
    // if clicking enemy within 24px, make attack order regardless of kind
    const humanOwner = state.controllers.find(c=>c.human)?.id;
    let clickEnemy=null, bd=Infinity;
    for (const o of state.players){ if (o.dead) continue; if (o.owner===humanOwner) continue; const d=dist(x,y,o.x,o.y); if (d<bd && d<60){ bd=d; clickEnemy=o; } }
    // allow direct base clicks too
    if (!clickEnemy){
      for (const c of state.controllers){ if (!c.base?.alive || c.id===humanOwner) continue; const d=dist(x,y,c.base.x,c.base.y); if (d<bd && d<c.base.r+28){ bd=d; clickEnemy = {id:`b${c.id}`, isBase:true}; }
      }
    }
    const type = clickEnemy ? 'attack' : (kind==='amove' ? 'amove' : 'move');
    const offs = formationOffsets(selected.length);
    for (let i=0;i<selected.length;i++){
      const u = selected[i];
      u.auto = null;
      if (type==='attack') { u.order = {type:'attack', targetId: clickEnemy.id}; }
      else { const [tx,ty] = adjustPointOutsideBases(x+offs[i][0], y+offs[i][1], u.radius+6); u.order = {type, x: tx, y: ty}; }
    }
  }

  function handleMouseDown(e){
    // LMB drag to select, RMB to command
    if (e.button===2){ // right click
      const humanCtrl = state.controllers.find(c=>c.human);
      if (humanCtrl && state.selectedBaseCtrlId === humanCtrl.id){
        // set rally point for player's bunker
        const [rx, ry] = adjustPointOutsideBases(mouse.x, mouse.y, BASE_RADIUS + 10);
        humanCtrl.rally = { x: rx, y: ry };
      } else {
        const kind = queuedAttackMove ? 'amove' : 'move';
        issueOrdersAt(mouse.x, mouse.y, kind);
        queuedAttackMove = false;
      }
      return;
    }
    if (e.button===0){
      if (queuedAttackMove){
        // If clicking on a unit, set attack order; otherwise issue attack-move
        const humanOwner = state.controllers.find(c=>c.human)?.id;
        let clickEnemy=null, bd=Infinity;
        for (const o of state.players){ if (o.dead) continue; if (o.owner===humanOwner) continue; const d=dist(mouse.x,mouse.y,o.x,o.y); if (d<bd && d<60){ bd=d; clickEnemy=o; } }
        if (clickEnemy){ issueOrdersAt(mouse.x, mouse.y, 'attack'); }
        else { issueOrdersAt(mouse.x, mouse.y, 'amove'); }
        queuedAttackMove = false;
        return;
      }
      dragSel = {active:true, x1:mouse.x, y1:mouse.y, x2:mouse.x, y2:mouse.y};
    }
  }
  function handleMouseUp(e){ if (e.button===0) finalizeSelection(); }

  function finalizeSelection(){
    if (!dragSel.active) return;
    dragSel.x2 = mouse.x; dragSel.y2 = mouse.y;
    const r = rectNormalize(dragSel);
    const shift = keys.has('shift');
    if (!shift) clearSelection();
    const humanOwner = state.controllers.find(c=>c.human);
    if (r.w<4 && r.h<4){
      // click select nearest friendly
      let best=null, bd=Infinity;
      for (const p of state.players){ if (p.dead || p.owner!==humanOwner.id) continue; const d=dist(mouse.x,mouse.y,p.x,p.y); if (d<bd && d<=p.radius+18){ bd=d; best=p; } }
      if (best) addToSelection(best);
      if (!best && humanOwner && humanOwner.base?.alive){
        const d = dist(mouse.x, mouse.y, humanOwner.base.x, humanOwner.base.y);
        if (d <= humanOwner.base.r + 16){ state.selectedBaseCtrlId = humanOwner.id; }
      }
    } else {
      for (const p of state.players){ if (p.dead || p.owner!==humanOwner.id) continue; if (inRect(p, r)) addToSelection(p); }
    }
    dragSel.active=false;
  }

  // ---------- ATTACK DISPATCH ----------
  function performAttack(p, ax, ay) {
    const atk = getUnitDef(p).attack;
    if (p.cd>0) return;
    if (p.attackLock>0) return; // cannot attack during backswing
    p.aimX = ax; p.aimY = ay;
    switch (atk.type) {
      case 'dash': {
        // If already in contact with a target, perform an instant melee hit instead of dashing
        if (!tryMeleeStrike(p)) startDash(p, ax, ay);
        break;
      }
      case 'bullet': {
        const [nx,ny] = norm(ax-p.x, ay-p.y); fireBullet(p, nx, ny, atk); break;
      }
      case 'burst': fireBurst(p, ax, ay); break;
      case 'splash': fireSplash(p, ax, ay); break;
      case 'chain': doChain(p, ax, ay); break;
      case 'aoe':   doAOE(p); break;
      case 'homing': fireHoming(p, ax, ay); break;
      case 'hitscan': fireHitscan(p, ax, ay); break;
      case 'cleave': doCleave(p); break;
    }
    p.cd = atk.cd;
    p.attackLock = Math.max(p.attackLock||0, (atk.backswing!=null ? atk.backswing : 0.15));
  }

  function tryMeleeStrike(owner){
    const atk = getUnitDef(owner).attack;
    let best=null, bestd=Infinity;
    for (const o of state.players){
      if (o.dead || o.id===owner.id || !isEnemy(owner,o)) continue;
      const d = dist(owner.x,owner.y,o.x,o.y) - (owner.radius + o.radius);
      if (d <= 6 && d < bestd){ best=o; bestd=d; }
    }
    if (best){
      damagePlayer(best, atk.damage, owner.id);
      const ang = Math.atan2(best.y-owner.y, best.x-owner.x);
      addEffect({ type:'claw', x:best.x, y:best.y, a: ang, r: owner.radius+8, ttl: 0.12 });
      addEffect({ type:'slash', x: owner.x, y: owner.y, a: ang, r: owner.radius + 26, spread: Math.PI/2.2, color: owner.color, ttl: 0.12 });
      return true;
    }
    // allow melee to strike bunkers if hugging them
    for (const c of state.controllers){
      if (c.id===owner.owner || !c.base?.alive) continue;
      const b = c.base;
      const d = dist(owner.x,owner.y,b.x,b.y) - (owner.radius + b.r);
      if (d <= 4){ damageBase(c, atk.damage, owner); return true; }
    }
    return false;
  }

  // ---------- UPDATE ----------
  function update(dt) {
    state.time += dt;
    // players
    for (const p of state.players){
      if (p.dead){ continue; }
      const ctrl = getController(p);
      // decrement attack animation lock and clamp
      if (p.attackLock && p.attackLock>0) { p.attackLock -= dt; if (p.attackLock<0) p.attackLock = 0; }
      if (!ctrl){ /* no controller; hold */ p.vx=0; p.vy=0; }
      else if (!ctrl.human && !p.order){
        // AI with no order: if enemy in range, stop and shoot; else move toward rally or run local behavior
        const atkRange = getAttackRange(p);
        const t = autoAcquireTarget(p, atkRange*0.95);
        if (t){ p.vx=0; p.vy=0; if (p.cd<=0){ performAttack(p, t.x, t.y); } }
        else if (ctrl.rally){
          const dx = ctrl.rally.x - p.x, dy = ctrl.rally.y - p.y, d = Math.hypot(dx,dy);
          if (d>10){ const [nx,ny]=norm(dx,dy); p.vx = nx*p.speed; p.vy = ny*p.speed; }
          else { p.vx=0; p.vy=0; }
        } else {
          botThink(p, dt);
        }
      } else {
        // obey orders (used by human and AI when they have an order)
        const order = p.order;
        let ax = null, ay = null;
        const atkRange = getAttackRange(p);
        let target = null;
        if (order){
          if (order.type==='attack'){
            const t = state.players.find(o=>o.id===order.targetId && !o.dead);
            if (t){ target = t; }
            else if (typeof order.targetId === 'string' && String(order.targetId).startsWith('b')){
              const cid = parseInt(String(order.targetId).slice(1),10);
              const bc = state.controllers[cid];
              if (bc && bc.base?.alive){ target = { x: bc.base.x, y: bc.base.y, isBase:true, ctrl: bc }; }
              else { p.order = null; }
            } else { p.order = null; }
          } else if (order.type==='hold'){
            // hold: do not move, but fire at anything already in range
            p.vx=0; p.vy=0;
            target = autoAcquireTarget(p, atkRange*0.95);
          } else {
            // move or amove
            // default movement toward destination
            const dx = order.x - p.x, dy = order.y - p.y, dDest = Math.hypot(dx,dy);
            let movingToDest = true;
            // Attack-move: auto-acquire nearby enemies; pursue a bit, then resume
            if (order.type==='amove'){
              const acquire = Math.max(10, atkRange * 1.05);
              const t = autoAcquireTarget(p, acquire);
              if (t){
                const dT = dist(p.x,p.y, t.x,t.y);
                const chaseMax = Math.max(atkRange*2.0, atkRange + 80);
                if (dT <= chaseMax){
                  target = t;
                  // if not in range, advance toward target to get into range
                  if (dT > atkRange*0.98 && !p.dash){ const [nx,ny]=norm(t.x-p.x, t.y-p.y); p.vx = nx*p.speed; p.vy = ny*p.speed; movingToDest = false; }
                  else { /* in range: handled below by engage block */ movingToDest = false; }
                }
              }
            }
            if (movingToDest){
              if (dDest>6){ const [nx,ny]=norm(dx,dy); p.vx = nx*p.speed; p.vy = ny*p.speed; }
              else { p.vx=0; p.vy=0; if (order.type==='move') p.order=null; }
            }
          }
        } else {
          // no order (humans): auto-engage with a short leash; AI is handled above
          const acquire = Math.max(10, atkRange*1.15);
          const t = autoAcquireTarget(p, acquire);
          if (t){
            target = t;
            if (!p.auto){ p.auto = { anchorX:p.x, anchorY:p.y, leash: Math.min(400, Math.max(100, atkRange*1.7)), targetId:t.id, lastSeen: state.time }; }
            else { p.auto.targetId = t.id; p.auto.lastSeen = state.time; }
            const dT = dist(p.x,p.y,t.x,t.y);
            if (dT > atkRange*0.98 && !p.dash){ const [nx,ny]=norm(t.x-p.x, t.y-p.y); p.vx = nx*p.speed; p.vy = ny*p.speed; }
            else { p.vx=0; p.vy=0; }
          } else if (p.auto){
            // drift back toward anchor, then clear auto
            const dx = p.auto.anchorX - p.x, dy = p.auto.anchorY - p.y; const dA = Math.hypot(dx,dy);
            if (dA > 8){ const [nx,ny]=norm(dx,dy); p.vx = nx*p.speed*0.6; p.vy = ny*p.speed*0.6; }
            else { p.vx=0; p.vy=0; p.auto=null; }
          } else {
            p.vx=0; p.vy=0;
          }
        }
        // attack if target in range (never chase target unless explicit attack order movement handles it)
        if (target){
          ax = target.x; ay = target.y; const d = dist(p.x,p.y,ax,ay);
          // Stop while engaging whenever target is in range (applies to both human and AI)
          if (d <= atkRange*1.02){ p.vx = 0; p.vy = 0; }
          if (p.cd<=0 && p.attackLock<=0 && d<=atkRange){ performAttack(p, ax, ay); }
          // If explicit attack order and target out of range, move toward it a bit
          else if (order && order.type==='attack' && !p.dash && d>Math.max(20, atkRange*0.9)){
            const [nx,ny]=norm(ax-p.x, ay-p.y); p.vx = nx*p.speed; p.vy = ny*p.speed;
          }
        }
      }
      // movement
      if (p.attackLock>0 && !p.dash){ p.vx = 0; p.vy = 0; }
      if (p.dash) { applyDash(p, dt); keepOutsideBases(p); }
      else {
        p.x += p.vx*dt; p.y += p.vy*dt;
        p.x = clamp(p.x, ARENA_MARGIN, state.worldWidth-ARENA_MARGIN);
        p.y = clamp(p.y, ARENA_MARGIN, state.worldHeight-ARENA_MARGIN);
        keepOutsideBases(p);
      }
      if (p.cd>0) p.cd -= dt;
    }

    // resolve inter-unit overlaps so units are not inside each other
    resolveUnitCollisions(1);

    // controllers: spawn and base defense, AI
    for (const ctrl of state.controllers){
      // spawn
      if (!ctrl.eliminated && ctrl.base?.alive){
        // passive gold income
        ctrl.gold = (ctrl.gold||0) + GOLD_PASSIVE_PER_SEC * dt;
        ctrl.spawnTimer += state.realDt; // spawn rate is real-time consistent
        let alive = controllerUnits(ctrl.id).length;
        // spawn in a loop to preserve consistent rate even under lag
        while (ctrl.spawnTimer >= ctrl.spawnInterval && alive < ctrl.unitCap){
          ctrl.spawnTimer -= ctrl.spawnInterval;
          spawnUnit(ctrl);
          alive++;
        }
        // base defense
        baseDefenseTick(ctrl, dt);
      }
      // AI group behavior
      aiControllerThink(ctrl, dt);
    }

    // check win by remaining bunkers
    const aliveCtrls = state.controllers.filter(c=>c.base?.alive && !c.eliminated);
    if (!state.winner && aliveCtrls.length === 1){
      const c = aliveCtrls[0];
      state.winner = c; state.running = false; overlayWin(`${c.name} wins!`, 'Press R to restart');
    }

    // projectiles
    const proj = state.projectiles; const kept = [];
    for (let i=0;i<proj.length;i++){
      const pr = proj[i];
      pr.ttl -= dt; if (pr.ttl<=0){
        if (pr.splash>0) addEffect({type:'explosion', x:pr.x, y:pr.y, r:pr.splash, ttl:0.2});
        continue;
      }
      // homing adjust
      if (pr.type==='homing'){
        let target=null, bd=Infinity;
        for (const p of state.players){ if (p.dead || p.id===pr.owner) continue; const d=dist(pr.x,pr.y,p.x,p.y); if (d<bd){bd=d; target=p;} }
        if (target){
          const desired = Math.atan2(target.y-pr.y, target.x-pr.x);
          const cur = Math.atan2(pr.vy, pr.vx);
          let da = Math.atan2(Math.sin(desired-cur), Math.cos(desired-cur));
          const maxTurn = (pr.turn||4)*dt;
          da = clamp(da, -maxTurn, maxTurn);
          const sp = Math.hypot(pr.vx,pr.vy);
          const ang = cur + da; pr.vx = Math.cos(ang)*sp; pr.vy = Math.sin(ang)*sp;
        }
      }
      pr.x += pr.vx*dt; pr.y += pr.vy*dt;
      // wall clamp
      pr.x = clamp(pr.x, ARENA_MARGIN, state.worldWidth-ARENA_MARGIN);
      pr.y = clamp(pr.y, ARENA_MARGIN, state.worldHeight-ARENA_MARGIN);
      // collisions
      let hit = false; let hitX = pr.x, hitY = pr.y; let hitBaseCtrl = null; let ownerUnit = state.players.find(p=>p.id===pr.owner);
      for (const p of state.players){
        if (p.dead || p.id===pr.owner) continue;
        if (circleIntersect(pr.x,pr.y, pr.r, p.x,p.y,p.radius)){
          damagePlayer(p, pr.dmg, pr.owner);
          hit = true; break;
        }
      }
      // base collision if not yet
      if (!hit){
        for (const c of state.controllers){
          if (!c.base?.alive) continue;
          // don't hit own base
          if (ownerUnit && c.id===ownerUnit.owner) continue;
          if (circleIntersect(pr.x,pr.y, pr.r, c.base.x, c.base.y, c.base.r)){
            damageBase(c, pr.dmg, ownerUnit);
            hit = true; hitBaseCtrl = c; break;
          }
        }
      }
      if (hit){
        if (pr.splash>0){
          addEffect({type:'explosion', x:hitX, y:hitY, r:pr.splash, ttl:0.2});
          for (const p of state.players){
            if (p.dead || p.id===pr.owner) continue;
            const d = dist(hitX,hitY,p.x,p.y);
            if (d<=pr.splash + p.radius*0.5){ damagePlayer(p, pr.dmg, pr.owner); }
          }
          for (const c of state.controllers){
            if (!c.base?.alive) continue;
            if (ownerUnit && c.id===ownerUnit.owner) continue;
            const d = dist(hitX,hitY,c.base.x,c.base.y);
            if (d<=pr.splash + c.base.r*0.5){ damageBase(c, pr.dmg, ownerUnit); }
          }
        }
      } else {
        kept.push(pr);
      }
    }
    state.projectiles = kept;

    // effects
    const eff2 = []; for (const e of state.effects){ e.ttl-=dt; if (e.ttl>0) eff2.push(e);} state.effects = eff2;
  }

  // ---------- RENDER ----------
  function drawGrid() {
    ctx.save();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    const step = 40; const w = state.worldWidth, h = state.worldHeight;
    for (let x=ARENA_MARGIN; x<=w-ARENA_MARGIN; x+=step){ ctx.beginPath(); ctx.moveTo(x,ARENA_MARGIN); ctx.lineTo(x,h-ARENA_MARGIN); ctx.stroke(); }
    for (let y=ARENA_MARGIN; y<=h-ARENA_MARGIN; y+=step){ ctx.beginPath(); ctx.moveTo(ARENA_MARGIN,y); ctx.lineTo(w-ARENA_MARGIN,y); ctx.stroke(); }
    ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=2;
    ctx.strokeRect(ARENA_MARGIN,ARENA_MARGIN, w-ARENA_MARGIN*2, h-ARENA_MARGIN*2);
    ctx.restore();
  }

  function drawEffects() {
    for (const e of state.effects){
      if (e.type==='hurt'){
        // outline ring instead of filled dot to avoid looking like a unit
        ctx.strokeStyle = 'rgba(255,90,90,0.7)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(e.x,e.y,7,0,Math.PI*2); ctx.stroke();
      } else if (e.type==='explosion'){
        ctx.strokeStyle = 'rgba(255,190,60,0.8)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(e.x,e.y, e.r*(1-e.ttl/0.2), 0, Math.PI*2); ctx.stroke();
      } else if (e.type==='ring'){
        ctx.strokeStyle = 'rgba(180,210,255,0.8)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(e.x,e.y, e.r*(1-e.ttl/0.18), 0, Math.PI*2); ctx.stroke();
      } else if (e.type==='link'){
        // bright inner core + soft glow
        ctx.save();
        ctx.strokeStyle = 'rgba(180,230,255,0.9)'; ctx.lineWidth=3;
        ctx.beginPath(); ctx.moveTo(e.x1,e.y1); ctx.lineTo(e.x2,e.y2); ctx.stroke();
        ctx.strokeStyle = 'rgba(120,200,255,0.35)'; ctx.lineWidth=7; ctx.beginPath(); ctx.moveTo(e.x1,e.y1); ctx.lineTo(e.x2,e.y2); ctx.stroke();
        // small traveling bolt along the link
        const life = e.life || 0.2; const t = 1 - Math.max(0, Math.min(1, e.ttl / life));
        const bx = e.x1 + (e.x2 - e.x1) * t; const by = e.y1 + (e.y2 - e.y1) * t;
        ctx.fillStyle = 'rgba(200,240,255,0.95)'; ctx.beginPath(); ctx.arc(bx,by, 3.2, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      } else if (e.type==='spark'){
        // small starburst at impact
        ctx.save();
        ctx.strokeStyle = 'rgba(220,250,255,0.95)'; ctx.lineWidth = 2;
        const r = 8; const arms = 4;
        for (let i=0;i<arms;i++){
          const a = (Math.PI/arms) * i;
          ctx.beginPath(); ctx.moveTo(e.x - Math.cos(a)*r, e.y - Math.sin(a)*r);
          ctx.lineTo(e.x + Math.cos(a)*r, e.y + Math.sin(a)*r); ctx.stroke();
        }
        ctx.restore();
      } else if (e.type==='tracer'){
        // quick, bright tracer for hitscan
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
        ctx.strokeStyle = 'rgba(120,200,255,0.35)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
        ctx.restore();
      } else if (e.type==='basebeam'){
        // bright base beam for clarity
        ctx.save();
        ctx.strokeStyle = 'rgba(120,220,255,0.95)';
        ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
        ctx.strokeStyle = 'rgba(120,220,255,0.35)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
        ctx.restore();
      } else if (e.type==='arc'){
        ctx.strokeStyle = 'rgba(230,255,200,0.9)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(e.x,e.y, e.r*(1-e.ttl/0.12), e.a-e.spread/2, e.a+e.spread/2); ctx.stroke();
      } else if (e.type==='slash'){
        // bold wedge slash
        const pct = Math.max(0, Math.min(1, e.ttl / 0.12));
        const rr = e.r * (1 - pct*0.5);
        ctx.save();
        ctx.strokeStyle = e.color || '#fff6a0';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(e.x, e.y, rr, e.a - (e.spread||0.9)/2, e.a + (e.spread||0.9)/2); ctx.stroke();
        ctx.restore();
      } else if (e.type==='after'){
        // subtle white outline ring so it doesn't resemble a unit
        const base = 0.08; const alpha = Math.max(0, Math.min(1, e.ttl / base)) * 0.25;
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(e.x, e.y, (e.r||10), 0, Math.PI*2); ctx.stroke();
        ctx.restore();
      } else if (e.type==='claw'){
        // three short claw lines emanating from hit point
        ctx.save();
        ctx.strokeStyle = 'rgba(255,120,120,0.95)'; ctx.lineWidth = 2.5;
        const len = 14, spread = 0.28; const angles = [e.a - spread, e.a, e.a + spread];
        for (const a of angles){
          const x2 = e.x + Math.cos(a)*len, y2 = e.y + Math.sin(a)*len;
          ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(x2, y2); ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  function drawPlayers() {
    ctx.font = '12px system-ui, Arial';
    ctx.textAlign = 'center'; ctx.textBaseline='top';
    for (const p of state.players){
      if (p.dead) continue;
      // body
      ctx.beginPath(); ctx.fillStyle=p.color; ctx.arc(p.x,p.y,p.radius,0,Math.PI*2); ctx.fill();
      // outline
      ctx.lineWidth=2; ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.stroke();
      // unit type glyph inside the circle
      (function(){
        const name = TIERS[p.tier].name;
        const map = { Zergling:'Z', Marine:'M', Hydra:'H', Vulture:'V', Templar:'T', Reaver:'R', Wraith:'W', Ultralisk:'U' };
        const glyph = map[name] || (name && name[0] ? name[0].toUpperCase() : '?');
        const size = Math.max(12, Math.floor(p.radius*1.25));
        const prevFont = ctx.font, prevBaseline = ctx.textBaseline, prevAlign = ctx.textAlign;
        ctx.font = `${size}px system-ui, Arial`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = Math.max(2, Math.floor(size*0.18));
        ctx.strokeText(glyph, p.x, p.y+0.5);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(glyph, p.x, p.y+0.5);
        ctx.font = prevFont; ctx.textBaseline = prevBaseline; ctx.textAlign = prevAlign;
      })();
      // selection ring for human-selected units
      if (state.selection.has(p.id)){
        ctx.strokeStyle = 'rgba(250,250,250,0.9)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(p.x,p.y,p.radius+5,0,Math.PI*2); ctx.stroke();
      }
      // healthbar
      const bw= Math.max(36, p.radius*2), bh=6, bx=p.x-bw/2, by=p.y-p.radius-12;
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(bx,by,bw,bh);
      const pct = clamp(p.hp/p.maxHp,0,1);
      ctx.fillStyle='#5ee173'; ctx.fillRect(bx,by,bw*pct,bh);
      // name + tier
      ctx.fillStyle='rgba(231,234,238,0.9)';
      if (state.selection.has(p.id)) ctx.fillText(`${getUnitDef(p).name}`, p.x, p.y+p.radius+6);
      // cooldown ring
      if (p.cd>0){ const atkcd = getUnitDef(p).attack.cd; ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(p.x,p.y,p.radius+4, -Math.PI/2, -Math.PI/2 + (1-Math.min(1,p.cd/Math.max(0.001,atkcd)))*Math.PI*2); ctx.stroke(); }
    }
  }

  function drawProjectiles() {
    for (const pr of state.projectiles){
      if (pr.type==='bullet' || pr.type==='homing'){
        ctx.fillStyle = pr.type==='homing' ? '#a6d1ff' : '#fff';
        ctx.beginPath(); ctx.arc(pr.x,pr.y, pr.r, 0, Math.PI*2); ctx.fill();
      } else if (pr.type==='splash'){
        ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(pr.x,pr.y, pr.r, 0, Math.PI*2); ctx.fill();
      }
    }
  }
  function drawBases(){
    // arena ring
    if (state.arena){
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(state.arena.x, state.arena.y, state.arena.r, 0, Math.PI*2); ctx.stroke();
    }
    for (const ctrl of state.controllers){
      const b = ctrl.base; if (!b) continue;
      const hpPct = clamp((b.hp||0)/(b.maxHp||1), 0, 1);
      const hpColor = hpPct>0.66 ? '#5ee173' : (hpPct>0.33 ? '#ffd166' : '#ff5d5d');
      // range
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(b.x,b.y,BASE_DEFENSE_RANGE,0,Math.PI*2); ctx.stroke();
      // base core
      ctx.fillStyle = ctrl.color; ctx.globalAlpha=0.18; ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
      ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(b.x,b.y,b.r+4,0,Math.PI*2); ctx.stroke();
      // selection ring if selected
      if (state.selectedBaseCtrlId === ctrl.id){ ctx.strokeStyle='rgba(250,250,250,0.95)'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(b.x,b.y,b.r+8,0,Math.PI*2); ctx.stroke(); }
      // HP bar
      const bw = 140, bh = 12; const bx = b.x - bw/2; const by = b.y + b.r + 16;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx,by,bw,bh);
      ctx.fillStyle = hpColor; ctx.globalAlpha=0.9; ctx.fillRect(bx,by,bw*hpPct,bh); ctx.globalAlpha=1;
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth=1; ctx.strokeRect(bx,by,bw,bh);
      // HP text
      ctx.font='14px system-ui, Arial'; ctx.textAlign='center'; ctx.textBaseline='bottom';
      const hpText = `${Math.ceil(b.hp)}/${b.maxHp} (${Math.round(hpPct*100)}%)`;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 3; ctx.strokeText(hpText, b.x, by-3);
      ctx.fillStyle = 'rgba(231,234,238,0.98)'; ctx.fillText(hpText, b.x, by-3);
      // rally indicator
      if (ctrl.rally){
        ctx.strokeStyle = ctrl.color; ctx.lineWidth=1.5; ctx.globalAlpha=0.9; ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(ctrl.rally.x, ctrl.rally.y); ctx.stroke(); ctx.globalAlpha=1;
        // small target symbol
        ctx.strokeStyle = ctrl.color; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(ctrl.rally.x, ctrl.rally.y, 8, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ctrl.rally.x-10, ctrl.rally.y); ctx.lineTo(ctrl.rally.x+10, ctrl.rally.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ctrl.rally.x, ctrl.rally.y-10); ctx.lineTo(ctrl.rally.x, ctrl.rally.y+10); ctx.stroke();
      }
    }
  }

  function drawSelectionOverlay(){
    // Drag box (while selecting)
    if (dragSel.active){
      const r = rectNormalize(dragSel);
      ctx.save();
      ctx.setLineDash([6,4]);
      ctx.strokeStyle='rgba(120,200,255,0.9)';
      ctx.lineWidth=2;
      ctx.strokeRect(r.x,r.y,r.w,r.h);
      ctx.restore();
    }
  }

  function render() {
    // clear full canvas in device pixels, independent of current view transform
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.restore();
    drawGrid();
    drawBases();
    drawEffects();
    drawProjectiles();
    drawPlayers();
    drawSelectionOverlay();
  }

  // ---------- UI ----------
  function updateUI() {
    const selected = getSelectedUnits();
    const humanCtrl = state.controllers.find(c=>c.human);
    const army = humanCtrl ? controllerUnits(humanCtrl.id).length : 0;
    const need = humanCtrl ? (humanCtrl.tier < tiersLen(humanCtrl)-1 ? killsToEvolveNeeded(humanCtrl) : 0) : 0;
    const have = humanCtrl ? humanCtrl.levelKills : 0;
    const gold = humanCtrl ? Math.floor(humanCtrl.gold||0) : 0;
    leftInfo.textContent = humanCtrl
      ? `Gold: ${gold} · Army: ${army}/${humanCtrl.unitCap} · Tier ${humanCtrl.tier+1}/${TIERS.length} (${TIERS[humanCtrl.tier].name}) · Kills ${have}/${need} · Selected ${selected.length}`
      : `Selected ${selected.length}`;

    // public leaderboard with progress bars per controller
    let html = '';
    for (const c of state.controllers){
      const name = c.name;
      const tierStr = `T${c.tier+1}/${tiersLen(c)}`;
      const needC = c.tier < tiersLen(c)-1 ? killsToEvolveNeeded(c) : 0;
      const haveC = c.tier < tiersLen(c)-1 ? c.levelKills : 0;
      const pct = c.tier < tiersLen(c)-1 ? Math.round(100*Math.min(1, haveC/Math.max(1,needC))) : 100;
      html += `
        <div style="display:inline-block; margin:0 10px; min-width:160px; vertical-align:middle;">
          <div style="color:${c.color}; font-weight:600;">${name}</div>
          <div style="font-size:12px; opacity:0.85;">${tierStr} — ${getUnitNameFor(c, c.tier)}</div>
          <div style="position:relative; width:150px; height:8px; background:rgba(255,255,255,0.15); border-radius:5px; overflow:hidden;">
            <div style="position:absolute; left:0; top:0; height:100%; width:${pct}%; background:${c.color};"></div>
          </div>
          <div style="font-size:11px; opacity:0.85;">${c.tier < tiersLen(c)-1 ? `${haveC}/${needC}` : 'MAX'}</div>
        </div>`;
    }
    rightInfo.innerHTML = html;
    // update shop gold label
    if (humanCtrl){ const shopGoldEl = document.querySelector('#evolvesShop div:nth-child(2)'); if (shopGoldEl) shopGoldEl.textContent = `Gold: ${Math.floor(humanCtrl.gold||0)}`; }
    centerInfo.textContent = `Controls: LMB drag · RMB move · A+LMB/RMB attack-move · S stop · H hold · P pause · -/= speed · Select bunker + RMB to set rally · R restart`;
  }

  let overlayTimer = 0;
  function showToast(text, sub='', dur=1.8){
    const box = document.createElement('div');
    Object.assign(box.style, {
      background: 'rgba(20,24,30,0.92)', color: '#e7eaee',
      border: '1px solid rgba(90,110,140,0.5)',
      borderRadius: '8px', padding: '6px 10px',
      fontFamily: 'system-ui, Arial, sans-serif', fontSize: '13px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.35)'
    });
    const t = document.createElement('div'); t.textContent = text; box.appendChild(t);
    if (sub){ const s=document.createElement('div'); s.textContent=sub; s.style.opacity='0.8'; s.style.fontSize='12px'; box.appendChild(s); }
    toastArea.appendChild(box);
    setTimeout(()=>{ if (box.parentNode) toastArea.removeChild(box); }, Math.max(500, dur*1000));
  }
  // overlayFlash now uses a non-blocking toast (no screen darkening)
  function overlayFlash(text){ showToast(text, '', 1.6); }
  function overlayWin(title, sub){
    overlay.style.display = 'flex';
    overlay.style.pointerEvents = 'auto';
    overlayText.textContent = title;
    overlaySub.textContent = sub;
    overlayTimer = Infinity;
  }

  function tickOverlay(){
    if (overlay.style.display !== 'none' && state.time >= overlayTimer){
      overlay.style.display = state.winner ? 'flex' : 'none';
    }
  }

  // ---------- LOOP ----------
  let lastT = 0;
  function frame(t){
    if (!lastT) lastT = t;
    let dtReal = (t - lastT)/1000; lastT = t;
    dtReal = Math.min(0.05, dtReal);
    state.realDt = dtReal;
    if (state.running) update(dtReal * state.timeScale);
    render(); updateUI(); tickOverlay();
    requestAnimationFrame(frame);
  }

  // ---------- INIT/RESTART ----------
  function initGame() {
    state.players.length = 0; state.projectiles.length = 0; state.effects.length = 0; state.winner=null; state.running = true;
    state.controllers.length = 0; state.selection.clear();
    nextId=1;
    // controllers
    const humanCtrl = newController('Player 1', COLORS[0], true); state.controllers.push(humanCtrl);
    for (let i=0;i<NUM_BOTS;i++) state.controllers.push(newController(BOT_NAMES[i% BOT_NAMES.length], COLORS[(i+1)%COLORS.length], false));
    for (const c of state.controllers){ initAIStrategy(c); }
    // placement helpers
    function placeBase(ctrl, cx, cy){
      ctrl.base.x = clamp(cx, ARENA_MARGIN+BASE_RADIUS+4, state.worldWidth-ARENA_MARGIN-BASE_RADIUS-4);
      ctrl.base.y = clamp(cy, ARENA_MARGIN+BASE_RADIUS+4, state.worldHeight-ARENA_MARGIN-BASE_RADIUS-4);
    }
    function spawnSquad(ctrl){
      for (let i=0;i<UNITS_PER_SIDE;i++){
        const u = newPlayer(`${ctrl.name}-${i+1}`, ctrl.color, ctrl.human, ctrl.id);
        const a = Math.random()*Math.PI*2; const d = BASE_RADIUS + 30 + Math.random()*60;
        u.x = clamp(ctrl.base.x + Math.cos(a)*d, ARENA_MARGIN, state.worldWidth-ARENA_MARGIN);
        u.y = clamp(ctrl.base.y + Math.sin(a)*d, ARENA_MARGIN, state.worldHeight-ARENA_MARGIN);
        u.tier = ctrl.tier; resetTierStats(u);
        state.players.push(u);
      }
    }
    function separateBases(iters=80){
      const th = BASE_RADIUS*2 + 24;
      for (let it=0; it<iters; it++){
        let moved = false;
        for (let i=0;i<state.controllers.length;i++){
          const bi = state.controllers[i].base;
          for (let j=i+1;j<state.controllers.length;j++){
            const bj = state.controllers[j].base;
            let dx = bj.x - bi.x, dy = bj.y - bi.y; let d = Math.hypot(dx,dy);
            if (d < th){
              if (d < 0.001){ dx = (Math.random()*2-1); dy=(Math.random()*2-1); d = Math.hypot(dx,dy) || 1; }
              const nx = dx/d, ny = dy/d; const push = (th - d) * 0.5;
              bi.x -= nx*push; bi.y -= ny*push; bj.x += nx*push; bj.y += ny*push; moved = true;
              bi.x = clamp(bi.x, ARENA_MARGIN+BASE_RADIUS+4, state.worldWidth-ARENA_MARGIN-BASE_RADIUS-4);
              bi.y = clamp(bi.y, ARENA_MARGIN+BASE_RADIUS+4, state.worldHeight-ARENA_MARGIN-BASE_RADIUS-4);
              bj.x = clamp(bj.x, ARENA_MARGIN+BASE_RADIUS+4, state.worldWidth-ARENA_MARGIN-BASE_RADIUS-4);
              bj.y = clamp(bj.y, ARENA_MARGIN+BASE_RADIUS+4, state.worldHeight-ARENA_MARGIN-BASE_RADIUS-4);
            }
          }
        }
        if (!moved) break;
      }
    }
    // place bases on a large circle around the arena center, evenly spaced
    const cx0 = state.worldWidth*0.5, cy0 = state.worldHeight*0.5;
    // outer radius from center to drawable edge considering rectangular borders
    const outer = Math.min(state.worldWidth, state.worldHeight)/2 - ARENA_MARGIN;
    // shrink placement radius so bases have visible margin to top/bottom edges
    const R = Math.max(100, outer - BASE_RING_OUTER_GAP);
    // draw arena ring near the outer bound so there is clear outside space around bases
    const arenaR = Math.max(R + BASE_RADIUS + 60, outer - 8);
    state.arena = { x: cx0, y: cy0, r: arenaR };
    const sides = state.controllers.length;
    for (let i=0;i<sides;i++){
      // start human at bottom (pi/2), then distribute
      const ang = (Math.PI/2) + i * (Math.PI*2 / sides);
      const bx = cx0 + Math.cos(ang) * R;
      const by = cy0 + Math.sin(ang) * R;
      placeBase(state.controllers[i], bx, by);
    }
    // assign AI factions and rallies, and spawn AI squads
    const aiFactions = ['zerg','protoss','terran']; let fi=0;
    for (const c of state.controllers){ if (!c.human){ c.faction = aiFactions[fi++ % aiFactions.length]; setDefaultRally(c); spawnSquad(c);} }
    // show faction picker for human and delay spawning until selection
    const human = state.controllers.find(c=>c.human); if (human){ factionPanel.style.display='flex'; }
    overlay.style.display = 'none';
  }

  function restart() { initGame(); }

  // ---------- START ----------
  resizeCanvas(); initGame(); requestAnimationFrame(frame);
})();
