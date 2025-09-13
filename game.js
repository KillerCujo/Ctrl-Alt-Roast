/* Ctrl-Alt-Roast — simple canvas runner (mobile-friendly)
   Keys: Space/Up to jump; tap/touch to jump. Pause with P or button.
   Uses no external assets—shapes only.  (c) 2025
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
  const toast = document.getElementById("toast");

  let DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

  function resize() {
    const w = canvas.clientWidth;
    const h = Math.floor(w * (16/9)); // keep aspect
    canvas.style.height = h + "px";
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize, {passive:true});
  resize();

  // Game world metrics (virtual units based on CSS pixel size)
  const W = () => canvas.clientWidth;
  const H = () => Math.floor(canvas.clientWidth * (16/9));

  // Util random
  const R = (min, max) => Math.random() * (max - min) + min;
  const RI = (min, max) => Math.floor(R(min, max+1));

  // State
  const state = {
    running: false,
    paused: false,
    t: 0,
    dt: 0,
    last: performance.now(),
    speed: 4.2,
    level: 1,
    score: 0,
    best: Number(localStorage.getItem("car_best") || 0),
    groundY: () => H() - 64,
    obstacles: [],
    coins: [],
    particles: []
  };
  bestEl.textContent = state.best;

  // Player (the pig)
  const player = {
    x: 48, y: 0, w: 42, h: 34,
    vy: 0,
    onGround: true,
    jumpPower: -10.8,
    gravity: 0.55,
    jumpQueued: false
  };
  player.y = state.groundY() - player.h;

  function drawPig(x, y, scale=1) {
    // Cute pig built from shapes
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // body
    roundedRect(-4, 4, 44, 28, 10, "#ffc0cb", "#cc8a97");
    // head
    roundedRect(20, -4, 24, 22, 8, "#ffc0cb", "#cc8a97");
    // ear
    roundedRect(24, -8, 8, 10, 3, "#ffc0cb", "#cc8a97");
    // snout
    roundedRect(34, 4, 12, 10, 4, "#ff99aa", "#b36b78");
    circle(38, 9, 1.2, "#7a2d3a");
    circle(42, 9, 1.2, "#7a2d3a");
    // eye
    circle(30, 4, 2.2, "#111827");
    // leggies
    roundedRect(4, 30, 8, 6, 2, "#e9a7b3");
    roundedRect(20, 30, 8, 6, 2, "#e9a7b3");
    // tail
    ctx.strokeStyle = "#e9a7b3"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-2, 14); ctx.quadraticCurveTo(-8, 14, -6, 10); ctx.quadraticCurveTo(-4, 6, -8, 6); ctx.stroke();

    ctx.restore();
  }

  function roundedRect(x, y, w, h, r, fill, stroke){
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
    if (fill){ ctx.fillStyle = fill; ctx.fill(); }
    if (stroke){ ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function circle(x,y,r, fill){
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
    if(fill){ ctx.fillStyle = fill; ctx.fill(); }
  }

  function showToast(msg, t=1400){
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(()=>toast.classList.remove("show"), t);
  }

  function reset() {
    state.t = 0;
    state.speed = 4.2;
    state.level = 1;
    state.score = 0;
    player.x = 48;
    player.vy = 0;
    player.onGround = true;
    player.y = state.groundY() - player.h;
    state.obstacles.length = 0;
    state.coins.length = 0;
    state.particles.length = 0;
    spawnInitial();
    render(0); // draw initial frame
  }

  function start() {
    reset();
    overlay.classList.remove("show");
    state.running = true;
    state.paused = false;
    state.last = performance.now();
    loop(state.last);
    showToast("Go Ctrl-Alt-Roast! 🐷");
  }

  function pauseToggle(){
    if(!state.running) return;
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? "Resume" : "Pause";
    if (!state.paused){
      state.last = performance.now();
      loop(state.last);
      showToast("Resumed");
    } else {
      showToast("Paused");
    }
  }

  // Entities
  function spawnInitial() {
    // few floor decorations / no obstacles in first second
    for (let i=0;i<3;i++){
      scheduleObstacle(RI(600, 1200) + i*260);
      scheduleCoinBurst(RI(500, 900) + i*220);
    }
  }

  function scheduleObstacle(offsetX) {
    const type = Math.random() < 0.55 ? "grill" : "cone";
    const w = type === "grill" ? 40 : 22;
    const h = type === "grill" ? 28 : 30;
    state.obstacles.push({
      type,
      x: W() + offsetX,
      y: state.groundY() - h,
      w, h, passed:false
    });
  }

  function scheduleCoinBurst(offsetX) {
    const n = RI(3,5);
    const baseX = W() + offsetX;
    const baseY = state.groundY() - RI(100, 160);
    for(let i=0;i<n;i++){
      state.coins.push({
        x: baseX + i*28,
        y: baseY - Math.sin(i)*10,
        r: 8,
        taken:false
      });
    }
  }

  function levelUp(){
    state.level++;
    state.speed += 0.4;
    showToast(`Level ${state.level}!`);
  }

  // Input
  function jump(){
    if (!state.running || state.paused) return;
    if (player.onGround){
      player.vy = player.jumpPower;
      player.onGround = false;
    } else {
      // small air tweak
      if (player.vy > -3){
        player.vy += -1.2;
      }
    }
  }
  canvas.addEventListener("pointerdown", (e)=> {
    e.preventDefault();
    jump();
  });
  jumpBtn.addEventListener("click", jump);
  pauseBtn.addEventListener("click", pauseToggle);
  document.addEventListener("keydown", (e)=>{
    if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); jump(); }
    if (e.key.toLowerCase() === "p") pauseToggle();
  });

  playBtn.addEventListener("click", ()=> start());
  howBtn.addEventListener("click", ()=>{
    showToast("Tap to jump • Avoid grills • Grab gold!");
  });

  // Game Loop
  function loop(now){
    if (!state.running || state.paused) return;
    state.dt = (now - state.last) / 16.6667; // normalize to ~60fps steps
    state.last = now;
    update(state.dt);
    render(state.dt);
    requestAnimationFrame(loop);
  }

  function update(dt){
    state.t += dt;

    // Gravity and motion
    player.vy += player.gravity * dt;
    player.y += player.vy * dt;

    // Ground collision
    const gy = state.groundY() - player.h;
    if (player.y >= gy){
      player.y = gy;
      player.vy = 0;
      player.onGround = true;
    }

    // Scroll obstacles and coins
    state.obstacles.forEach(o=>{
      o.x -= state.speed * 3.2 * dt;
      if (!o.passed && o.x + o.w < player.x){
        o.passed = true;
        state.score += 5;
        if (state.score % 30 === 0) levelUp();
      }
    });
    state.coins.forEach(c=>{
      c.x -= state.speed * 3.2 * dt;
    });

    // Spawn new entities
    if (state.obstacles.length < 4){
      scheduleObstacle(RI(320, 720));
    }
    if (state.coins.length < 10){
      scheduleCoinBurst(RI(380, 980));
    }

    // Collisions
    for (const o of state.obstacles){
      if (aabb(player, o)){
        gameOver();
        return;
      }
    }
    for (const c of state.coins){
      if (!c.taken && circleHit(player, c)){
        c.taken = true;
        state.score += 3;
        spawnSparkles(c.x, c.y, FIU_GOLD);
      }
    }

    // Clean up off-screen
    state.obstacles = state.obstacles.filter(o => o.x + o.w > -60);
    state.coins = state.coins.filter(c => !c.taken && c.x + c.r > -40);
    state.particles = state.particles.filter(p => (p.life -= dt) > 0);

    // Update HUD
    scoreEl.textContent = state.score.toString();
    bestEl.textContent = state.best.toString();
    levelEl.textContent = state.level.toString();
  }

  function aabb(a, b){
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function circleHit(rect, c){
    const cx = Math.max(rect.x, Math.min(c.x, rect.x + rect.w));
    const cy = Math.max(rect.y, Math.min(c.y, rect.y + rect.h));
    const dx = c.x - cx;
    const dy = c.y - cy;
    return (dx*dx + dy*dy) <= (c.r*c.r);
  }

  function spawnSparkles(x, y, color){
    for(let i=0;i<12;i++){
      state.particles.push({
        x, y,
        vx: R(-1.3, 1.3),
        vy: R(-2.0, -0.2),
        g: 0.08,
        life: R(10, 18),
        color
      });
    }
  }

  function gameOver(){
    state.running = false;
    state.paused = false;
    if (state.score > state.best){
      state.best = state.score;
      localStorage.setItem("car_best", String(state.best));
      showToast("New Best! 🎉");
    } else {
      showToast("Oink! Try again 🐽");
    }
    setTimeout(()=>{
      overlay.classList.add("show");
      const card = overlay.querySelector(".card");
      card.querySelector("h2").textContent = "Game Over!";
      card.querySelector("p").innerHTML = `Score: <b>${state.score}</b> • Best: <b>${state.best}</b>`;
      card.querySelector("ul").innerHTML = "<li>Tap Play to try again</li><li>Tip: Jump a tad early for grills</li>";
      document.getElementById("playBtn").textContent = "Play Again";
    }, 500);
  }

  function drawGround(){
    const y = state.groundY();
    ctx.fillStyle = "#6dbb5a";
    ctx.fillRect(0, y, W(), H()-y);
    // track
    ctx.fillStyle = "#9e7042";
    ctx.fillRect(0, y, W(), 10);
    ctx.fillStyle = "#815836";
    for (let i=0;i<W();i+=28){
      ctx.fillRect(i, y+10, 18, 6);
    }
  }

  function drawBackground(t){
    // faint FIU skyline blocks
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = FIU_BLUE;
    for (let i=0;i<6;i++){
      const bw = 60 + (i%3)*20;
      const bh = 60 + (i%4)*40;
      const x = (i*140 - (t*10 % (W()+200))) - 100;
      const y = H()-bh-100;
      ctx.fillRect(x, y, bw, bh);
    }
    ctx.restore();

    // floating clouds
    ctx.save();
    ctx.globalAlpha = 0.9;
    for (let i=0;i<4;i++){
      const x = (i*180 - (t*12 % (W()+220))) - 120;
      const y = 40 + (i%2)*30;
      drawCloud(x, y);
    }
    ctx.restore();
  }

  function drawCloud(x, y){
    ctx.fillStyle = "#fff";
    circle(x, y, 12, "#fff");
    circle(x+14, y-6, 14, "#fff");
    circle(x+28, y, 12, "#fff");
    ctx.fillRect(x-4, y, 36, 10);
  }

  function drawObstacles(){
    for (const o of state.obstacles){
      if (o.type === "grill"){
        // tailgate grill
        ctx.fillStyle = DARK;
        roundedRect(o.x, o.y, o.w, o.h, 4, DARK);
        ctx.fillStyle = FIU_GOLD;
        ctx.fillRect(o.x+6, o.y+6, o.w-12, 6);
        // legs
        ctx.fillStyle = DARK;
        ctx.fillRect(o.x+6, o.y+o.h-4, 4, 10);
        ctx.fillRect(o.x+o.w-10, o.y+o.h-4, 4, 10);
        // smoke
        ctx.strokeStyle = "rgba(0,0,0,.2)";
        ctx.beginPath(); ctx.moveTo(o.x+10, o.y-6); ctx.bezierCurveTo(o.x+6, o.y-14, o.x+14, o.y-16, o.x+12, o.y-24); ctx.stroke();
      } else {
        // safety cone
        ctx.fillStyle = FIU_GOLD;
        roundedRect(o.x, o.y, o.w, o.h, 4, FIU_GOLD);
        ctx.fillStyle = "#fff";
        ctx.fillRect(o.x+2, o.y+8, o.w-4, 6);
      }
    }
  }

  function drawCoins(){
    for (const c of state.coins){
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate((state.t/10) % (Math.PI*2));
      circle(0,0,c.r,"#ffefb0");
      ctx.strokeStyle = FIU_GOLD;
      ctx.lineWidth = 3/Math.max(1, window.devicePixelRatio || 1);
      ctx.stroke();
      ctx.fillStyle = FIU_GOLD;
      ctx.fillRect(-2, -6, 4, 12);
      ctx.restore();
    }
  }

  function drawParticles(){
    for (const p of state.particles){
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life/18));
      ctx.fillRect(p.x, p.y, 2, 2);
      ctx.globalAlpha = 1;
    }
  }

  function render(){
    ctx.clearRect(0, 0, W(), H());
    drawBackground(state.t);
    drawGround();
    drawObstacles();
    drawCoins();
    drawParticles();
    drawPig(player.x, player.y, 1);
    ctx.fillStyle = FIU_BLUE;
    ctx.font = "800 16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(`Score ${state.score}`, 12, 24);
  }

  // Helpers
  function aabb(a, b){
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function circleHit(rect, c){
    const cx = Math.max(rect.x, Math.min(c.x, rect.x + rect.w));
    const cy = Math.max(rect.y, Math.min(c.y, rect.y + rect.h));
    const dx = c.x - cx;
    const dy = c.y - cy;
    return (dx*dx + dy*dy) <= (c.r*c.r);
  }

  // Kickoff in idle mode (show overlay)
  reset();

})();