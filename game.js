/* Ctrl-Alt-Roast — V6 (snappier physics) */
(() => {
  const FIU_BLUE = "#081E3F";
  const FIU_GOLD = "#C5960C";
  const DARK = "#0f172a";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const overlay = document.getElementById("overlay");
  const playBtn = document.getElementById("playBtn");
  const howBtn = document.getElementById("howBtn");
  const jumpBtn = document.getElementById("jumpBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const levelEl = document.getElementById("level");
  const coinsEl = document.getElementById("coins");
  const powerNameEl = document.getElementById("powerName");
  const powerTimeEl = document.getElementById("powerTime");
  const toast = document.getElementById("toast");

  let DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

  function resize() {
    const w = canvas.clientWidth;
    const h = Math.floor(w * (16/9));
    canvas.style.height = h + "px";
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize, {passive:true});
  resize();

  const W = () => canvas.clientWidth;
  const H = () => Math.floor(canvas.clientWidth * (16/9));
  const R = (min, max) => Math.random() * (max - min) + min;
  const RI = (min, max) => Math.floor(R(min, max+1));

  const state = {
    running: false, paused: false, lastMs: performance.now(), dtSec: 0, t: 0,
    speed: 3.0, level: 1, score: 0, coins: 0,
    best: Number(localStorage.getItem("car_best") || 0),
    groundY: () => H() - 64,
    obstacles: [], coinsArr: [], particles: [], powerups: [],
    power: {type: null, time: 0}, keysDown: new Set(),
    bg: {back:[], palms:[], front:[]},
    gameOverLock: false,
  };
  bestEl.textContent = state.best;

  const player = { x:48, y:0, w:38, h:30, vy:0, onGround:true, jumpPower:-12.5, gravity:1.0, canDouble:false };
  player.y = state.groundY() - player.h;

  function showToast(msg, t=900){ toast.textContent = msg; toast.classList.add("show"); setTimeout(()=>toast.classList.remove("show"), t); }

  function reset() {
    state.t=0; state.speed=3.0; state.level=1; state.score=0; state.coins=0; state.power={type:null,time:0};
    player.x=48; player.vy=0; player.onGround=true; player.canDouble=false; player.y=state.groundY()-player.h;
    state.obstacles.length=0; state.coinsArr.length=0; state.particles.length=0; state.powerups.length=0;
    state.bg.back.length=0; state.bg.palms.length=0; state.bg.front.length=0;
    initParallax(); spawnInitial(); render(0); updateHUD();
  }

  function start() {
    reset(); overlay.classList.remove("show"); state.running=true; state.paused=false; state.lastMs=performance.now();
    requestAnimationFrame(loop); showToast("Go Ctrl-Alt-Roast! 🐷");
  }

  function pauseToggle(){
    if(!state.running) return;
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? "Resume" : "Pause";
    if (!state.paused){ state.lastMs=performance.now(); requestAnimationFrame(loop); showToast("Resumed"); }
    else { showToast("Paused"); }
  }

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
        if ((obj.x + (obj.w||0)) < -120){
          obj.x = spawnX + Math.random()*80;
        }
      }
    });
  }

  function spawnInitial() {
    for (let i=0;i<3;i++){ scheduleObstacle(RI(900,1500)+i*380, true); scheduleCoinBurst(RI(650,1050)+i*300); }
    schedulePowerup(RI(1400,2200));
  }
  function scheduleObstacle(offsetX, easy=false){
    const type = Math.random()<0.55 ? "grill":"cone"; const w= type==="grill"?40:22; const h= type==="grill"?28:30;
    const gapBoost = easy ? R(90,140) : 0;
    state.obstacles.push({type, x:W()+offsetX+gapBoost, y:state.groundY()-h, w, h, passed:false});
  }
  function scheduleCoinBurst(offsetX){
    const n = RI(3,6), baseX=W()+offsetX, baseY=state.groundY()-RI(110, 170);
    for(let i=0;i<n;i++){ state.coinsArr.push({x:baseX+i*28, y:baseY - Math.sin(i)*10, r:8, taken:false}); }
  }
  function schedulePowerup(offsetX){
    const types=["wings","ghost"]; const type=types[RI(0, types.length-1)];
    state.powerups.push({type, x:W()+offsetX, y:state.groundY()-RI(140,200), r:12, taken:false});
  }
  function levelUp(){ state.level++; state.speed=Math.min(state.speed+0.4, 8.5); showToast(`Level ${state.level}!`); }

  function tryJump(){
    if (!state.running || state.paused) return;
    const wingsActive = state.power.type==="wings" && state.power.time>0;
    if (wingsActive){ player.vy = Math.min(player.vy, -6.5); player.vy += -2.2; return; }
    if (player.onGround){ player.vy = player.jumpPower; player.onGround = false; player.canDouble = true; }
    else if (player.canDouble){ player.vy = player.jumpPower * 0.92; player.canDouble = false; }
  }
  canvas.addEventListener("pointerdown", (e)=> { e.preventDefault(); tryJump(); }, {passive:false});
  jumpBtn.addEventListener("click", tryJump);
  pauseBtn.addEventListener("click", pauseToggle);
  document.addEventListener("keydown", (e)=>{
    const k=e.code;
    if (k==="Space"||k==="ArrowUp"){
      if (e.repeat && state.power.type!=="wings") return;
      if (!state.keysDown.has(k)){ state.keysDown.add(k); e.preventDefault(); tryJump(); }
    } else if (e.key.toLowerCase()==="p"){ pauseToggle(); }
  });
  document.addEventListener("keyup", (e)=>{ const k=e.code; if (k==="Space"||k==="ArrowUp"){ state.keysDown.delete(k); } });
  howBtn?.addEventListener("click", ()=> showToast("Snappy jumps • Double-jump • 10 coins = level up"));
  playBtn?.addEventListener("click", start);

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
    state.obstacles.forEach(o=>{ o.x-=scroll; if(!o.passed && o.x+o.w<player.x){ o.passed=true; state.score+=5; } });
    state.coinsArr.forEach(c=> c.x-=scroll );
    state.powerups.forEach(p=> p.x-=scroll );

    if (state.obstacles.length < (state.level<2?3:5)) scheduleObstacle(RI(420,900), state.level<2);
    if (state.coinsArr.length < 12) scheduleCoinBurst(RI(480,1080));
    if (state.powerups.length < 1 && Math.random()<0.012) schedulePowerup(RI(1000,1700));

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
      card.querySelector("p").innerHTML = `Score: <b>${state.score}</b> • Coins: <b>${state.coins}</b> • Best: <b>${state.best}</b>`;
      card.querySelector("ul").innerHTML = "<li>Tap Play to try again</li><li>Tip: Time jumps; use power-ups</li>";
      document.getElementById("playBtn").textContent = "Play Again";
      state.gameOverLock = false;
    }, 220);
  }

  function clearAll(){ ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.setTransform(DPR,0,0,DPR,0,0); }

  function aabb(a,b){ const pad=3; const bx=b.x+pad, by=b.y+pad, bw=b.w-pad*2, bh=b.h-pad*2; return a.x < bx + bw && a.x + a.w > bx && a.y < by + bh && a.y + a.h > by; }
  function circleHit(rect,c){ const cx=Math.max(rect.x, Math.min(c.x, rect.x+rect.w)); const cy=Math.max(rect.y, Math.min(c.y, rect.y+rect.h)); const dx=c.x-cx, dy=c.y-cy; return dx*dx+dy*dy <= c.r*c.r; }
  function roundedRect(x,y,w,h,r,fill,stroke){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); if(fill){ctx.fillStyle=fill; ctx.fill();} if(stroke){ctx.strokeStyle=stroke; ctx.stroke();} }
  function circle(x,y,r,fill){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); if(fill){ ctx.fillStyle=fill; ctx.fill(); } }

  reset();
})();