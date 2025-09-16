/* Ctrl-Alt-Roast — canvas runner V4
   Changes:
   - Slower parallax speeds; improved palm tree art
   - True ghost invincibility (no collisions while active)
   - Double jump (resets on landing)
   - Extra collision fairness; prevent random gameOver
*/

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
    running: false, paused: false, t: 0, dt: 0, last: performance.now(),
    speed: 2.2, level: 1, score: 0, coins: 0,
    best: Number(localStorage.getItem("car_best") || 0),
    groundY: () => H() - 64,
    obstacles: [], coinsArr: [], particles: [], powerups: [],
    power: {type: null, time: 0}, keysDown: new Set(),
  };
  bestEl.textContent = state.best;

  const player = { x:48, y:0, w:38, h:30, vy:0, onGround:true, jumpPower:-11.0, gravity:0.6, canDouble:false };
  player.y = state.groundY() - player.h;

  function showToast(msg, t=1200){ toast.textContent = msg; toast.classList.add("show"); setTimeout(()=>toast.classList.remove("show"), t); }

  function reset() {
    state.t=0; state.speed=2.2; state.level=1; state.score=0; state.coins=0; state.power={type:null,time:0};
    player.x=48; player.vy=0; player.onGround=true; player.canDouble=false; player.y=state.groundY()-player.h;
    state.obstacles.length=0; state.coinsArr.length=0; state.particles.length=0; state.powerups.length=0;
    spawnInitial(); render(0); updateHUD();
  }

  function start() {
    reset(); overlay.classList.remove("show"); state.running=true; state.paused=false; state.last=performance.now();
    requestAnimationFrame(loop); showToast("Go Ctrl-Alt-Roast! 🐷");
  }

  function pauseToggle(){
    if(!state.running) return;
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? "Resume" : "Pause";
    if (!state.paused){ state.last=performance.now(); requestAnimationFrame(loop); showToast("Resumed"); }
    else { showToast("Paused"); }
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
  function levelUp(){ state.level++; state.speed=Math.min(state.speed+0.35, 7.8); showToast(`Level ${state.level}!`); }

  // Input + double jump
  function tryJump(){
    if (!state.running || state.paused) return;
    const wingsActive = state.power.type==="wings" && state.power.time>0;
    if (wingsActive){
      player.vy = Math.min(player.vy, -6.5);
      player.vy += -2.6;
      return;
    }
    if (player.onGround){
      player.vy = player.jumpPower;
      player.onGround = false;
      player.canDouble = true;
    } else if (player.canDouble){
      player.vy = player.jumpPower * 0.9; // slightly shorter
      player.canDouble = false;
    }
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
  howBtn?.addEventListener("click", ()=> showToast("Double-jump enabled • 10 coins = level up • Watch the power timer!"));
  playBtn?.addEventListener("click", start);

  function loop(now){
    if (!state.running || state.paused) return;
    state.dt=(now-state.last)/16.6667; state.last=now; update(state.dt); render(state.dt); requestAnimationFrame(loop);
  }

  function update(dt){
    state.t+=dt;
    const wings = state.power.type==="wings" && state.power.time>0;
    const gravity = wings ? 0.24 : player.gravity;
    player.vy += gravity * dt; player.y += player.vy * dt;

    // Ceiling & ground
    if (player.y<0){ player.y=0; player.vy=Math.max(player.vy,0); }
    const gy=state.groundY()-player.h;
    if (player.y>=gy){ player.y=gy; player.vy=0; if(!player.onGround){ player.onGround=true; player.canDouble=false; } }
    else { player.onGround=false; }

    // Scroll entities
    const scroll=state.speed*3.0*dt; // slightly slower world scroll
    state.obstacles.forEach(o=>{ o.x-=scroll; if(!o.passed && o.x+o.w<player.x){ o.passed=true; state.score+=5; } });
    state.coinsArr.forEach(c=> c.x-=scroll );
    state.powerups.forEach(p=> p.x-=scroll );

    // Spawn
    if (state.obstacles.length < (state.level<2?3:5)) scheduleObstacle(RI(420,900), state.level<2);
    if (state.coinsArr.length < 12) scheduleCoinBurst(RI(480,1080));
    if (state.powerups.length < 1 && Math.random()<0.012) schedulePowerup(RI(1000,1700));

    const ghostActive = state.power.type==="ghost" && state.power.time>0;

    // Collisions
    if (!ghostActive){
      // Only check collisions if not ghost
      for (const o of state.obstacles){
        if (aabb(player, o)){
          return safeGameOver();
        }
      }
    }
    for (const c of state.coinsArr){
      if(!c.taken && circleHit(player,c)){
        c.taken=true; state.coins++; state.score+=3; spawnSparkles(c.x,c.y,FIU_GOLD);
        if (state.coins%10===0) levelUp();
      }
    }
    for (const p of state.powerups){
      if(!p.taken && circleHit(player,p)){
        p.taken=true; activatePower(p.type);
      }
    }

    // Cleanup
    state.obstacles = state.obstacles.filter(o=> o.x+o.w>-60);
    state.coinsArr = state.coinsArr.filter(c=> !c.taken && c.x+c.r>-40);
    state.powerups = state.powerups.filter(p=> !p.taken && p.x+p.r>-40);
    state.particles = state.particles.filter(p=> (p.life-=dt) > 0);

    // Power-up timer (stable)
    if (state.power.type){
      state.power.time -= dt; if (state.power.time<=0){ state.power.type=null; state.power.time=0; showToast("Power-up ended"); }
    }

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

  function activatePower(type){
    state.power.type=type; state.power.time=10;
    showToast(type==="wings"?"Wings! Fly for 10s":"Ghost! Invincible for 10s", 900);
  }

  // Guarded game over
  let gameOverLock = false;
  function safeGameOver(){
    if (gameOverLock) return; // prevent double calls
    gameOverLock = true;
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
      gameOverLock = false; // unlock when overlay shown
    }, 200);
  }

  function clearAll(){ ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.setTransform(DPR,0,0,DPR,0,0); }

  // Background with slower parallax
  function drawBackground(t){
    // Back buildings (slow)
    ctx.save(); ctx.globalAlpha=0.16; ctx.fillStyle=FIU_BLUE;
    const sp1=(t*3.2)%(W()+300);
    for(let i=0;i<8;i++){
      const bw=70+(i%3)*22, bh=80+(i%4)*50, x=(i*160-sp1)-200, y=H()-bh-140;
      ctx.fillRect(x,y,bw,bh);
      ctx.fillStyle="#12305b"; ctx.fillRect(x+Math.floor(bw*0.35), y+10, 8, bh-20); ctx.fillStyle=FIU_BLUE;
    }
    ctx.restore();

    // Palms (medium)
    const sp2=(t*5.4)%(W()+260);
    for(let i=0;i<6;i++){
      const x=(i*200-sp2)-180, y=state.groundY()-100-(i%2)*8;
      drawPalm(x, y, 1.05 + (i%3)*0.12);
    }

    // Front buildings (medium-fast but reduced)
    ctx.save(); ctx.globalAlpha=0.24; ctx.fillStyle="#12305b";
    const sp3=(t*7.5)%(W()+220);
    for(let i=0;i<6;i++){
      const bw=60+(i%2)*30, bh=70+(i%3)*40, x=(i*180-sp3)-180, y=H()-bh-110;
      ctx.fillRect(x,y,bw,bh);
      ctx.fillStyle="#d6e3ff";
      for(let wx=6; wx<bw-6; wx+=14){
        for(let wy=6; wy<bh-6; wy+=16){
          ctx.fillRect(x+wx,y+wy,6,8);
        }
      }
      ctx.fillStyle="#12305b";
    }
    ctx.restore();
  }

  // Improved palm art
  function drawPalm(x, y, s=1){
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    // segmented trunk with slight lean
    ctx.fillStyle = "#8b5a2b";
    for (let i=0;i<7;i++){
      const tx = i*1.2;
      ctx.fillRect(tx, 22+i*10, 10, 10);
    }
    // crown base
    ctx.fillStyle = "#2b6b3e";
    ctx.beginPath(); ctx.arc(8, 22, 8, 0, Math.PI*2); ctx.fill();
    // fronds — layered arcs
    ctx.fillStyle = "#2e8b57";
    for (let k=0;k<6;k++){
      const ang = -Math.PI/2 + k*(Math.PI/5) - 0.6;
      ctx.beginPath();
      ctx.moveTo(8, 22);
      ctx.quadraticCurveTo(8+Math.cos(ang)*50, 22+Math.sin(ang)*18, 8+Math.cos(ang)*70, 22+Math.sin(ang)*28);
      ctx.quadraticCurveTo(12+Math.cos(ang)*34, 26+Math.sin(ang)*14, 8, 22);
      ctx.fill();
    }
    // coconuts (cute)
    ctx.fillStyle = "#6b4f2a";
    ctx.beginPath(); ctx.arc(10, 28, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, 28, 3, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function drawGround(){
    const y=state.groundY();
    ctx.fillStyle="#78c267"; ctx.fillRect(0,y,W(),H()-y);
    ctx.fillStyle="#9e7042"; ctx.fillRect(0,y,W(),10);
    ctx.fillStyle="#815836"; for(let i=0;i<W();i+=28) ctx.fillRect(i,y+10,18,6);
  }

  function drawObstacles(){
    for(const o of state.obstacles){
      if(o.type==="grill"){
        ctx.fillStyle=DARK; roundedRect(o.x,o.y,o.w,o.h,4,DARK);
        ctx.fillStyle=FIU_GOLD; ctx.fillRect(o.x+6,o.y+6,o.w-12,6);
        ctx.fillStyle=DARK; ctx.fillRect(o.x+6,o.y+o.h-4,4,10); ctx.fillRect(o.x+o.w-10,o.y+o.h-4,4,10);
      } else {
        ctx.fillStyle=FIU_GOLD; roundedRect(o.x,o.y,o.w,o.h,4,FIU_GOLD);
        ctx.fillStyle="#fff"; ctx.fillRect(o.x+2,o.y+8,o.w-4,6);
      }
    }
  }

  function drawCoins(){
    for(const c of state.coinsArr){
      ctx.save(); ctx.translate(c.x,c.y); ctx.rotate((state.t/10)%(Math.PI*2));
      circle(0,0,c.r,"#ffefb0");
      ctx.strokeStyle=FIU_GOLD; ctx.lineWidth=3/Math.max(1,window.devicePixelRatio||1); ctx.stroke();
      ctx.fillStyle=FIU_GOLD; ctx.fillRect(-2,-6,4,12);
      ctx.restore();
    }
  }

  function drawPowerups(){
    for(const p of state.powerups){
      ctx.save(); ctx.translate(p.x,p.y);
      if(p.type==="wings"){
        ctx.fillStyle="#e6f2ff";
        ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(16,-10,28,0); ctx.quadraticCurveTo(12,8,0,0); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0,4); ctx.quadraticCurveTo(14,0,24,6); ctx.quadraticCurveTo(10,10,0,4); ctx.fill();
        circle(0,0,3,"#d0e8ff");
      } else {
        ctx.fillStyle="rgba(255,255,255,0.92)";
        roundedRect(-10,-14,20,24,10,"rgba(255,255,255,0.92)","#cbd5e1");
        circle(-4,-4,2,"#111"); circle(4,-4,2,"#111");
      }
      ctx.restore();
    }
  }

  function drawParticles(){
    for(const p of state.particles){
      p.vy+=p.g; p.x+=p.vx; p.y+=p.vy;
      ctx.fillStyle=p.color; ctx.globalAlpha=Math.max(0, Math.min(1, p.life/18));
      ctx.fillRect(p.x,p.y,2,2); ctx.globalAlpha=1;
    }
  }

  function drawPig(x,y,scale=1){
    ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
    if (state.power.type==="ghost" && state.power.time>0) ctx.globalAlpha = 0.6;
    roundedRect(-4,4,44,28,10,"#ffc0cb","#cc8a97"); // body
    if (state.power.type==="wings" && state.power.time>0){
      ctx.fillStyle="#e6f2ff";
      ctx.beginPath(); ctx.moveTo(0,10); ctx.quadraticCurveTo(-24,0,-28,-10); ctx.quadraticCurveTo(-8,0,0,10); ctx.fill();
      ctx.beginPath(); ctx.moveTo(28,10); ctx.quadraticCurveTo(52,0,56,-10); ctx.quadraticCurveTo(36,0,28,10); ctx.fill();
    }
    roundedRect(20,-4,24,22,8,"#ffc0cb","#cc8a97"); // head
    roundedRect(24,-8,8,10,3,"#ffc0cb","#cc8a97");  // ear
    roundedRect(34,4,12,10,4,"#ff99aa","#b36b78");  // snout
    circle(38,9,1.2,"#7a2d3a"); circle(42,9,1.2,"#7a2d3a");
    circle(30,4,2.2,"#111827");                     // eye
    roundedRect(4,30,8,6,2,"#e9a7b3"); roundedRect(20,30,8,6,2,"#e9a7b3");
    ctx.strokeStyle="#e9a7b3"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-2,14); ctx.quadraticCurveTo(-8,14,-6,10); ctx.quadraticCurveTo(-4,6,-8,6); ctx.stroke();
    ctx.restore();
  }

  function render(){
    clearAll();
    drawBackground(state.t);
    drawGround();
    drawObstacles();
    drawCoins();
    drawPowerups();
    drawParticles();
    drawPig(player.x, player.y, 1);
    ctx.fillStyle = FIU_BLUE;
    ctx.font = "800 16px system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
    ctx.fillText(`Score ${state.score}`, 12, 24);
  }

  // Helpers
  function aabb(a,b){
    const pad=3; const bx=b.x+pad, by=b.y+pad, bw=b.w-pad*2, bh=b.h-pad*2;
    return a.x < bx + bw && a.x + a.w > bx && a.y < by + bh && a.y + a.h > by;
  }
  function circleHit(rect,c){
    const cx=Math.max(rect.x, Math.min(c.x, rect.x+rect.w));
    const cy=Math.max(rect.y, Math.min(c.y, rect.y+rect.h));
    const dx=c.x-cx, dy=c.y-cy; return dx*dx+dy*dy <= c.r*c.r;
  }
  function roundedRect(x,y,w,h,r,fill,stroke){
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
    if(fill){ctx.fillStyle=fill; ctx.fill();} if(stroke){ctx.strokeStyle=stroke; ctx.stroke();}
  }
  function circle(x,y,r,fill){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); if(fill){ ctx.fillStyle=fill; ctx.fill(); } }
  function spawnSparkles(x,y,color){ for(let i=0;i<12;i++){ state.particles.push({x,y,vx:(Math.random()*2-1)*1.3,vy:-Math.random()*2.0,g:0.08,life:10+Math.random()*8,color}); } }

  reset();
})();