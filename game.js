/* Ctrl-Alt-Roast — V9.1 */
(() => {
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('gesturechange', e => e.preventDefault());
  document.addEventListener('gestureend', e => e.preventDefault());
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => { const now = Date.now(); if (now - lastTouchEnd <= 300) { e.preventDefault(); } lastTouchEnd = now; }, {passive:false});

  const toast = document.getElementById("toast");
  window.addEventListener("error", (e) => { if (!toast) return; toast.textContent = "Error: " + e.message; toast.classList.add("show"); setTimeout(()=>toast.classList.remove("show"), 2500); });

  const FIU_BLUE = "#081E3F";
  const FIU_GOLD = "#C5960C";
  const DARK = "#0f172a";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const overlay = document.getElementById("overlay");
  const playBtn = document.getElementById("playBtn");
  const jumpBtn = document.getElementById("jumpBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const levelEl = document.getElementById("level");
  const coinsEl = document.getElementById("coins");
  const powerNameEl = document.getElementById("powerName");
  const powerTimeEl = document.getElementById("powerTime");
  const rotateOverlay = document.getElementById("rotateOverlay");

  let DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const isPortrait = () => window.matchMedia("(orientation: portrait)").matches || window.innerHeight >= window.innerWidth;

  function resizeCanvasToCSS() {
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.floor(rect.width);
    const cssH = Math.floor(rect.height);
    canvas.width = Math.floor(cssW * DPR);
    canvas.height = Math.floor(cssH * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  const ro = new ResizeObserver(resizeCanvasToCSS);
  ro.observe(canvas);
  window.addEventListener("orientationchange", ()=> setTimeout(()=>{ DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1)); resizeCanvasToCSS(); updateOrientationGate(true); }, 250));
  window.addEventListener("resize", ()=> setTimeout(resizeCanvasToCSS, 50));
  resizeCanvasToCSS();

  const W = () => Math.floor(canvas.getBoundingClientRect().width);
  const H = () => Math.floor(canvas.getBoundingClientRect().height);
  const R = (min, max) => Math.random() * (max - min) + min;

  const state = {
    running: false, paused: false, lastMs: performance.now(), dtSec: 0, t: 0,
    speed: 3.0, level: 1, score: 0, coins: 0,
    best: Number(localStorage.getItem("car_best") || 0),
    groundY: () => H() - 64,
    obstacles: [], coinsArr: [], powerups: [],
    power: {type: null, time: 0}, keysDown: new Set(),
    bg: {back:[], palms:[], front:[]},
    pausedByOrientation: false,
    gameOverLock: false,
  };
  bestEl.textContent = state.best;

  const player = { x:48, y:0, w:38, h:30, vy:0, onGround:true, jumpPower:-12.0, gravity:0.9, canDouble:false };
  function resetPlayer(){ player.x=48; player.vy=0; player.onGround=true; player.canDouble=false; player.y=state.groundY()-player.h; }
  resetPlayer();

  function showToast(msg, t=1000){ toast.textContent = msg; toast.classList.add("show"); setTimeout(()=>toast.classList.remove("show"), t); }

  function updateOrientationGate(fromRotate=false){
    const ok = isPortrait();
    if (!ok){
      rotateOverlay.classList.remove("hidden");
      rotateOverlay.setAttribute("aria-hidden","false");
      if (state.running && !state.paused){
        state.paused = true;
        state.pausedByOrientation = true;
        pauseBtn.textContent = "Resume";
        if (fromRotate) showToast("Paused (landscape)");
      }
    } else {
      rotateOverlay.classList.add("hidden");
      rotateOverlay.setAttribute("aria-hidden","true");
      if (state.pausedByOrientation){
        showToast("Back to portrait — tap Resume");
      }
    }
  }
  updateOrientationGate();

  document.addEventListener("visibilitychange", ()=>{
    if (document.hidden && state.running && !state.paused){ state.paused = true; pauseBtn.textContent = "Resume"; showToast("Paused"); }
  });

  function reset() {
    state.t=0; state.speed=3.0; state.level=1; state.score=0; state.coins=0; state.power={type:null,time:0};
    resetPlayer();
    state.obstacles.length=0; state.coinsArr.length=0; state.powerups.length=0;
    state.bg.back.length=0; state.bg.palms.length=0; state.bg.front.length=0;
    state.pausedByOrientation = false;
    initParallax(); spawnInitial(); render();
  }

  function start() {
    reset(); overlay.classList.remove("show");
    state.running=true; state.paused=false; pauseBtn.textContent = "Pause";
    state.lastMs=performance.now();
    requestAnimationFrame(loop);
    showToast("Go Ctrl-Alt-Roast! 🐷");
  }

  document.addEventListener("keydown", (e)=>{
    if (!isPortrait()) return;
    if ((e.code==="Space"||e.code==="ArrowUp") && overlay.classList.contains("show")) { e.preventDefault(); start(); }
  });
  canvas.addEventListener("pointerdown",(e)=>{ if (!isPortrait()) return; if (overlay.classList.contains("show")) { e.preventDefault(); start(); } }, {passive:false});
  playBtn.addEventListener("click", ()=>{ if (!isPortrait()) return; start(); });

  function pauseToggle(){
    if(!state.running) return;
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? "Resume" : "Pause";
    if (!state.paused){ state.lastMs=performance.now(); requestAnimationFrame(loop); showToast("Resumed"); state.pausedByOrientation=false; }
    else { showToast("Paused"); }
  }
  jumpBtn.addEventListener("click", ()=>{ if (!state.running || state.paused || !isPortrait()) return; tryJump(); });
  pauseBtn.addEventListener("click", ()=>{ if (!isPortrait()) return; pauseToggle(); });

  document.addEventListener("keydown", (e)=>{
    const k=e.code;
    if (!isPortrait()) return;
    if (k==="Space"||k==="ArrowUp"){
      if (overlay.classList.contains("show")) return;
      if (e.repeat && state.power.type!=="wings") return;
      if (!state.keysDown.has(k)){ state.keysDown.add(k); e.preventDefault(); tryJump(); }
    } else if (e.key && e.key.toLowerCase()==="p"){ pauseToggle(); }
  });
  document.addEventListener("keyup", (e)=>{ const k=e.code; if (k==="Space"||k==="ArrowUp"){ state.keysDown.delete(k); } });

  function initParallax(){
    const w=W();
    let x= -50;
    while (x < w + 400){
      const bw = 70 + (Math.random()*40|0);
      const bh = 90 + (Math.random()*70|0);
      state.bg.back.push({x, y:H()-bh-150, w:bw, h:bh, speed: 18});
      x += bw + 60;
    }
    x = -80;
    while (x < w + 400){
      state.bg.palms.push({x, y: state.groundY()-100 - (Math.random()*10|0), s: 1 + Math.random()*0.2, speed: 28});
      x += 140 + (Math.random()*80|0);
    }
    x = -80;
    while (x < w + 400){
      const bw = 60 + (Math.random()*40|0);
      const bh = 70 + (Math.random()*60|0);
      state.bg.front.push({x, y:H()-bh-110, w:bw, h:bh, speed: 36});
      x += bw + 80;
    }
  }
  function updateParallax(dtSec){
    const layers = [state.bg.back, state.bg.palms, state.bg.front];
    layers.forEach((arr)=>{
      let rightEdge = -Infinity;
      for (const obj of arr){
        obj.x -= obj.speed * dtSec;
        rightEdge = Math.max(rightEdge, obj.x + (obj.w||0) + (obj.s? 60:0));
      }
      const spawnX = Math.max(rightEdge, W()) + 40;
      for (const obj of arr){
        const width = (obj.w||60);
        if ((obj.x + width) < -120){
          obj.x = spawnX + Math.random()*80;
        }
      }
    });
  }

  function spawnInitial() {
    for (let i=0;i<3;i++){ scheduleObstacle(900+i*380, true); scheduleCoinBurst(650+i*300); }
    schedulePowerup(1400);
  }
  function scheduleObstacle(offsetX, easy=false){
    const type = Math.random()<0.55 ? "grill":"cone"; const w= type==="grill"?40:22; const h= type==="grill"?28:30;
    const gapBoost = easy ? 120 : 0;
    state.obstacles.push({type, x:W()+offsetX+gapBoost, y:state.groundY()-h, w, h, passed:false});
  }
  function scheduleCoinBurst(offsetX){
    const n = 5, baseX=W()+offsetX, baseY=state.groundY()-140;
    for(let i=0;i<n;i++){ state.coinsArr.push({x:baseX+i*28, y:baseY - Math.sin(i)*10, r:8, taken:false}); }
  }
  function schedulePowerup(offsetX){
    const type = Math.random()<0.5 ? "wings":"ghost";
    state.powerups.push({type, x:W()+offsetX, y:state.groundY()-160, r:12, taken:false});
  }
  function levelUp(){ state.level++; state.speed=Math.min(state.speed+0.35, 8.0); showToast(`Level ${state.level}!`); }

  function tryJump(){
    const wingsActive = state.power.type==="wings" && state.power.time>0;
    if (wingsActive){ player.vy = Math.min(player.vy, -6.2); player.vy += -2.0; return; }
    if (player.onGround){ player.vy = player.jumpPower; player.onGround = false; player.canDouble = true; }
    else if (player.canDouble){ player.vy = player.jumpPower * 0.92; player.canDouble = false; }
  }

  function loop(nowMs){
    if (!state.running || state.paused) return;
    state.dtSec = (nowMs - state.lastMs) / 1000;
    if (state.dtSec > 0.1) state.dtSec = 0.1;
    state.lastMs = nowMs;
    update(state.dtSec);
    render();
    requestAnimationFrame(loop);
  }

  function update(dtSec){
    state.t += dtSec;
    updateParallax(dtSec);

    const wings = state.power.type==="wings" && state.power.time>0;
    const gravity = wings ? 0.5 : player.gravity;
    player.vy += gravity * (dtSec*60);
    player.y  += player.vy * (dtSec*60);

    if (player.y<0){ player.y=0; player.vy=Math.max(player.vy,0); }
    const gy=state.groundY()-player.h;
    if (player.y>=gy){ player.y=gy; player.vy=0; if(!player.onGround){ player.onGround=true; player.canDouble=false; } }
    else { player.onGround=false; }

    const scroll=state.speed*60*dtSec;
    for (const o of state.obstacles){ o.x-=scroll; if(!o.passed && o.x+o.w<player.x){ o.passed=true; state.score+=5; } }
    for (const c of state.coinsArr){ c.x-=scroll; }
    for (const p of state.powerups){ p.x-=scroll; }

    if (state.obstacles.length < (state.level<2?3:5)) scheduleObstacle(420 + Math.random()*480, state.level<2);
    if (state.coinsArr.length < 12) scheduleCoinBurst(480 + Math.random()*600);
    if (state.powerups.length < 1 && Math.random()<0.012) schedulePowerup(1000 + Math.random()*700);

    const ghostActive = state.power.type==="ghost" && state.power.time>0;
    if (!ghostActive){ for (const o of state.obstacles){ if (aabb(player, o)) return gameOver(); } }
    for (const c of state.coinsArr){ if(!c.taken && circleHit(player,c)){ c.taken=true; state.coins++; state.score+=3; if (state.coins%10===0) levelUp(); } }
    for (const p of state.powerups){ if(!p.taken && circleHit(player,p)){ p.taken=true; activatePower(p.type); } }

    state.obstacles = state.obstacles.filter(o=> o.x+o.w>-60);
    state.coinsArr = state.coinsArr.filter(c=> !c.taken && c.x+c.r>-40);
    state.powerups = state.powerups.filter(p=> !p.taken && p.x+p.r>-40);

    if (state.power.type){ state.power.time -= dtSec; if (state.power.time<=0){ state.power.type=null; state.power.time=0; showToast("Power-up ended"); } }

    updateHUD();
  }

  function updateHUD(){
    scoreEl.textContent=String(state.score);
    bestEl.textContent=String(state.best);
    levelEl.textContent=String(state.level);
    coinsEl.textContent=String(state.coins);
    if (state.power.type){ powerNameEl.textContent= state.power.type==="wings"?"Wings":"Ghost"; powerTimeEl.textContent=`(${Math.ceil(state.power.time)}s)`; }
    else { powerNameEl.textContent="—"; powerTimeEl.textContent=""; }
  }

  function activatePower(type){ state.power.type=type; state.power.time=10; showToast(type==="wings"?"Wings! 10s":"Ghost! 10s", 800); }

  function gameOver(){
    if (state.gameOverLock) return;
    state.gameOverLock = true;
    state.running=false; state.paused=false; state.keysDown.clear();
    if (state.score>state.best){ state.best=state.score; localStorage.setItem("car_best", String(state.best)); showToast("New Best! 🎉"); }
    else { showToast("Oink! Try again 🐽"); }
    setTimeout(()=>{
      overlay.classList.add("show");
      const card = overlay.querySelector(".card");
      card.querySelector("h2").textContent = "Game Over!";
      const p = document.createElement("p");
      p.innerHTML = `Score: <b>${state.score}</b> • Coins: <b>${state.coins}</b> • Best: <b>${state.best}</b>`;
      const buttons = card.querySelector(".overlay-buttons");
      card.insertBefore(p, buttons);
      document.getElementById("playBtn").textContent = "Play Again";
      state.gameOverLock = false;
    }, 220);
  }

  function aabb(a,b){ const pad=3; const bx=b.x+pad, by=b.y+pad, bw=b.w-pad*2, bh=b.h-pad*2; return a.x < bx + bw && a.x + a.w > bx && a.y < by + bh && a.y + a.h > by; }
  function circleHit(rect,c){ const cx=Math.max(rect.x, Math.min(c.x, rect.x+rect.w)); const cy=Math.max(rect.y, Math.min(c.y, rect.y+rect.h)); const dx=c.x-cx, dy=c.y-cy; return dx*dx+dy*dy <= c.r*c.r; }
  function roundedRect(x,y,w,h,r,fill,stroke){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); if(fill){ctx.fillStyle=fill; ctx.fill();} if(stroke){ctx.strokeStyle=stroke; ctx.stroke();} }
  function circle(x,y,r,fill){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); if(fill){ ctx.fillStyle=fill; ctx.fill(); } }

  function clearAll(){ ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.setTransform(DPR,0,0,DPR,0,0); }
  function drawParallax(){
    ctx.save(); ctx.globalAlpha=0.16; ctx.fillStyle="#081E3F";
    for(const b of state.bg.back){ ctx.fillRect(b.x,b.y,b.w,b.h); ctx.fillStyle="#12305b"; ctx.fillRect(b.x+Math.floor(b.w*0.35), b.y+10, 8, b.h-20); ctx.fillStyle="#081E3F"; }
    ctx.restore();
    for(const p of state.bg.palms){ drawPalm(p.x,p.y,p.s); }
    ctx.save(); ctx.globalAlpha=0.24; ctx.fillStyle="#12305b";
    for(const b of state.bg.front){ ctx.fillRect(b.x,b.y,b.w,b.h); ctx.fillStyle="#d6e3ff"; for(let wx=6; wx<b.w-6; wx+=14){ for(let wy=6; wy<b.h-6; wy+=16){ ctx.fillRect(b.x+wx,b.y+wy,6,8); } } ctx.fillStyle="#12305b"; }
    ctx.restore();
  }
  function drawPalm(x, y, s=1){
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = "#8b5a2b"; for (let i=0;i<7;i++){ const tx=i*1.2; ctx.fillRect(tx, 22+i*10, 10, 10); }
    ctx.fillStyle = "#2b6b3e"; ctx.beginPath(); ctx.arc(8, 22, 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#2e8b57";
    for (let k=0;k<6;k++){ const ang=-Math.PI/2 + k*(Math.PI/5) - 0.6;
      ctx.beginPath(); ctx.moveTo(8,22);
      ctx.quadraticCurveTo(8+Math.cos(ang)*50, 22+Math.sin(ang)*18, 8+Math.cos(ang)*70, 22+Math.sin(ang)*28);
      ctx.quadraticCurveTo(12+Math.cos(ang)*34, 26+Math.sin(ang)*14, 8,22); ctx.fill();
    }
    ctx.fillStyle = "#6b4f2a"; ctx.beginPath(); ctx.arc(10, 28, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, 28, 3, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
  function drawGround(){ const y=state.groundY(); ctx.fillStyle="#78c267"; ctx.fillRect(0,y,W(),H()-y); ctx.fillStyle="#9e7042"; ctx.fillRect(0,y,W(),10); ctx.fillStyle="#815836"; for(let i=0;i<W();i+=28) ctx.fillRect(i,y+10,18,6); }
  function drawObstacles(){ for(const o of state.obstacles){ if(o.type==="grill"){ ctx.fillStyle=DARK; roundedRect(o.x,o.y,o.w,o.h,4,DARK); ctx.fillStyle=FIU_GOLD; ctx.fillRect(o.x+6,o.y+6,o.w-12,6); ctx.fillStyle=DARK; ctx.fillRect(o.x+6,o.y+o.h-4,4,10); ctx.fillRect(o.x+o.w-10,o.y+o.h-4,4,10);} else { ctx.fillStyle=FIU_GOLD; roundedRect(o.x,o.y,o.w,o.h,4,FIU_GOLD); ctx.fillStyle="#fff"; ctx.fillRect(o.x+2,o.y+8,o.w-4,6);} } }
  function drawCoins(){ for(const c of state.coinsArr){ ctx.save(); ctx.translate(c.x,c.y); ctx.beginPath(); ctx.arc(0,0,c.r,0,Math.PI*2); ctx.fillStyle="#ffefb0"; ctx.fill(); ctx.strokeStyle=FIU_GOLD; ctx.lineWidth=3/Math.max(1,window.devicePixelRatio||1); ctx.stroke(); ctx.fillStyle=FIU_GOLD; ctx.fillRect(-2,-6,4,12); ctx.restore(); } }
  function drawPowerups(){ for(const p of state.powerups){ ctx.save(); ctx.translate(p.x,p.y); if(p.type==="wings"){ ctx.fillStyle="#e6f2ff"; ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(16,-10,28,0); ctx.quadraticCurveTo(12,8,0,0); ctx.fill(); ctx.beginPath(); ctx.moveTo(0,4); ctx.quadraticCurveTo(14,0,24,6); ctx.quadraticCurveTo(10,10,0,4); ctx.fill(); ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fillStyle="#d0e8ff"; ctx.fill(); } else { ctx.fillStyle="rgba(255,255,255,0.92)"; roundedRect(-10,-14,20,24,10,"rgba(255,255,255,0.92)","#cbd5e1"); ctx.fillStyle="#111"; ctx.beginPath(); ctx.arc(-4,-4,2,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(4,-4,2,0,Math.PI*2); ctx.fill(); } ctx.restore(); } }
  function drawPig(x,y,scale=1){ ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale); if (state.power.type==="ghost" && state.power.time>0) ctx.globalAlpha = 0.6; roundedRect(-4,4,44,28,10,"#ffc0cb","#cc8a97"); if (state.power.type==="wings" && state.power.time>0){ ctx.fillStyle="#e6f2ff"; ctx.beginPath(); ctx.moveTo(0,10); ctx.quadraticCurveTo(-24,0,-28,-10); ctx.quadraticCurveTo(-8,0,0,10); ctx.fill(); ctx.beginPath(); ctx.moveTo(28,10); ctx.quadraticCurveTo(52,0,56,-10); ctx.quadraticCurveTo(36,0,28,10); ctx.fill(); } roundedRect(20,-4,24,22,8,"#ffc0cb","#cc8a97"); roundedRect(24,-8,8,10,3,"#ffc0cb","#cc8a97"); roundedRect(34,4,12,10,4,"#ff99aa","#b36b78"); ctx.beginPath(); ctx.arc(38,9,1.2,0,Math.PI*2); ctx.fillStyle="#7a2d3a"; ctx.fill(); ctx.beginPath(); ctx.arc(42,9,1.2,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(30,4,2.2,0,Math.PI*2); ctx.fillStyle="#111827"; ctx.fill(); roundedRect(4,30,8,6,2,"#e9a7b3"); roundedRect(20,30,8,6,2,"#e9a7b3"); ctx.strokeStyle="#e9a7b3"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-2,14); ctx.quadraticCurveTo(-8,14,-6,10); ctx.quadraticCurveTo(-4,6,-8,6); ctx.stroke(); ctx.restore(); }

  function render(){ clearAll(); drawParallax(); drawGround(); drawObstacles(); drawCoins(); drawPowerups(); drawPig(player.x, player.y, 1); ctx.fillStyle = FIU_BLUE; ctx.font = "800 14px system-ui,-apple-system,Segoe UI,Roboto,sans-serif"; ctx.fillText(`Score ${state.score}`, 12, 20); }
  function clearAll(){ ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.setTransform(DPR,0,0,DPR,0,0); }

  reset(); updateOrientationGate();

  // Expose start on UI
  document.getElementById("playBtn").addEventListener("click", ()=>{ if (!isPortrait()) return; start(); });
  canvas.addEventListener("pointerdown",(e)=>{ if (!isPortrait()) return; if (overlay.classList.contains("show")) { e.preventDefault(); start(); } }, {passive:false});

  function loop(nowMs){
    if (!state.running || state.paused) return;
    state.dtSec = (nowMs - state.lastMs) / 1000; if (state.dtSec > 0.1) state.dtSec = 0.1; state.lastMs = nowMs;
    update(state.dtSec); render(); requestAnimationFrame(loop);
  }
  function pauseToggle(){ if(!state.running) return; state.paused = !state.paused; pauseBtn.textContent = state.paused ? "Resume" : "Pause"; if (!state.paused){ state.lastMs=performance.now(); requestAnimationFrame(loop);} }
  pauseBtn.addEventListener("click", ()=>{ if (!isPortrait()) return; pauseToggle(); });
  jumpBtn.addEventListener("click", ()=>{ if (!state.running || state.paused || !isPortrait()) return; tryJump(); });

  document.addEventListener("keydown", (e)=>{
    const k=e.code; if (!isPortrait()) return;
    if ((k==="Space"||k==="ArrowUp") && overlay.classList.contains("show")) { e.preventDefault(); start(); return; }
    if (k==="Space"||k==="ArrowUp"){ if (state.paused) return; if (e.repeat && state.power.type!=="wings") return; e.preventDefault(); tryJump(); }
    if (e.key && e.key.toLowerCase()==="p"){ pauseToggle(); }
  });

  // The remaining functions are same as above (update, collisions, spawns)
  function tryJump(){ const wingsActive = state.power.type==="wings" && state.power.time>0; if (wingsActive){ player.vy = Math.min(player.vy, -6.2); player.vy += -2.0; return; } if (player.onGround){ player.vy = player.jumpPower; player.onGround = false; player.canDouble = true; } else if (player.canDouble){ player.vy = player.jumpPower * 0.92; player.canDouble = false; } }
  function update(dtSec){
    state.t += dtSec; updateParallax(dtSec);
    const wings = state.power.type==="wings" && state.power.time>0; const gravity = wings ? 0.5 : player.gravity;
    player.vy += gravity * (dtSec*60); player.y  += player.vy * (dtSec*60);
    if (player.y<0){ player.y=0; player.vy=Math.max(player.vy,0); }
    const gy=state.groundY()-player.h; if (player.y>=gy){ player.y=gy; player.vy=0; if(!player.onGround){ player.onGround=true; player.canDouble=false; } } else { player.onGround=false; }
    const scroll=state.speed*60*dtSec;
    for (const o of state.obstacles){ o.x-=scroll; if(!o.passed && o.x+o.w<player.x){ o.passed=true; state.score+=5; } }
    for (const c of state.coinsArr){ c.x-=scroll; }
    for (const p of state.powerups){ p.x-=scroll; }
    if (state.obstacles.length < (state.level<2?3:5)) scheduleObstacle(420 + Math.random()*480, state.level<2);
    if (state.coinsArr.length < 12) scheduleCoinBurst(480 + Math.random()*600);
    if (state.powerups.length < 1 && Math.random()<0.012) schedulePowerup(1000 + Math.random()*700);
    const ghostActive = state.power.type==="ghost" && state.power.time>0;
    if (!ghostActive){ for (const o of state.obstacles){ if (aabb(player, o)) return gameOver(); } }
    for (const c of state.coinsArr){ if(!c.taken && circleHit(player,c)){ c.taken=true; state.coins++; state.score+=3; if (state.coins%10===0) levelUp(); } }
    for (const p of state.powerups){ if(!p.taken && circleHit(player,p)){ p.taken=true; activatePower(p.type); } }
    state.obstacles = state.obstacles.filter(o=> o.x+o.w>-60);
    state.coinsArr = state.coinsArr.filter(c=> !c.taken && c.x+c.r>-40);
    state.powerups = state.powerups.filter(p=> !p.taken && p.x+p.r>-40);
    if (state.power.type){ state.power.time -= dtSec; if (state.power.time<=0){ state.power.type=null; state.power.time=0; showToast("Power-up ended"); } }
    updateHUD();
  }
  function updateHUD(){ scoreEl.textContent=String(state.score); bestEl.textContent=String(state.best); levelEl.textContent=String(state.level); coinsEl.textContent=String(state.coins); if (state.power.type){ powerNameEl.textContent= state.power.type==="wings"?"Wings":"Ghost"; powerTimeEl.textContent=`(${Math.ceil(state.power.time)}s)`; } else { powerNameEl.textContent="—"; powerTimeEl.textContent=""; } }
  function activatePower(type){ state.power.type=type; state.power.time=10; showToast(type==="wings"?"Wings! 10s":"Ghost! 10s", 800); }
  function gameOver(){ if (state.gameOverLock) return; state.gameOverLock = true; state.running=false; state.paused=false; state.keysDown.clear(); if (state.score>state.best){ state.best=state.score; localStorage.setItem("car_best", String(state.best)); showToast("New Best! 🎉"); } else { showToast("Oink! Try again 🐽"); } setTimeout(()=>{ overlay.classList.add("show"); const card = overlay.querySelector(".card"); card.querySelector("h2").textContent = "Game Over!"; const p = document.createElement("p"); p.innerHTML = `Score: <b>${state.score}</b> • Coins: <b>${state.coins}</b> • Best: <b>${state.best}</b>`; const buttons = card.querySelector(".overlay-buttons"); card.insertBefore(p, buttons); document.getElementById("playBtn").textContent = "Play Again"; state.gameOverLock = false; }, 220); }
  function levelUp(){ state.level++; state.speed=Math.min(state.speed+0.35, 8.0); showToast(`Level ${state.level}!`); }
  function scheduleObstacle(offsetX, easy=false){ const type = Math.random()<0.55 ? "grill":"cone"; const w= type==="grill"?40:22; const h= type==="grill"?28:30; const gapBoost = easy ? 120 : 0; state.obstacles.push({type, x:W()+offsetX+gapBoost, y:state.groundY()-h, w, h, passed:false}); }
  function scheduleCoinBurst(offsetX){ const n = 5, baseX=W()+offsetX, baseY=state.groundY()-140; for(let i=0;i<n;i++){ state.coinsArr.push({x:baseX+i*28, y:baseY - Math.sin(i)*10, r:8, taken:false}); } }
  function schedulePowerup(offsetX){ const type = Math.random()<0.5 ? "wings":"ghost"; state.powerups.push({type, x:W()+offsetX, y:state.groundY()-160, r:12, taken:false}); }
  function initParallax(){ const w=W(); let x= -50; while (x < w + 400){ const bw = 70 + (Math.random()*40|0); const bh = 90 + (Math.random()*70|0); state.bg.back.push({x, y:H()-bh-150, w:bw, h:bh, speed: 18}); x += bw + 60; } x = -80; while (x < w + 400){ state.bg.palms.push({x, y: state.groundY()-100 - (Math.random()*10|0), s: 1 + Math.random()*0.2, speed: 28}); x += 140 + (Math.random()*80|0); } x = -80; while (x < w + 400){ const bw = 60 + (Math.random()*40|0); const bh = 70 + (Math.random()*60|0); state.bg.front.push({x, y:H()-bh-110, w:bw, h:bh, speed: 36}); x += bw + 80; } }
  function updateParallax(dtSec){ const layers = [state.bg.back, state.bg.palms, state.bg.front]; layers.forEach((arr)=>{ let rightEdge = -Infinity; for (const obj of arr){ obj.x -= obj.speed * dtSec; rightEdge = Math.max(rightEdge, obj.x + (obj.w||0) + (obj.s? 60:0)); } const spawnX = Math.max(rightEdge, W()) + 40; for (const obj of arr){ const width = (obj.w||60); if ((obj.x + width) < -120){ obj.x = spawnX + Math.random()*80; } } }); }
})();