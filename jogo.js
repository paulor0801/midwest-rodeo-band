// =========================================================
// CHAPÉU SALTADOR — joguinho da Midwest Rodeo Band
// O chapéu pula sozinho quando você aperta ESPAÇO / ↑
// (no PC) ou toca na tela (no celular).
// Desvie dos fardos, barris e bolas de feno e pegue as estrelas.
// =========================================================
(function () {
  const canvas = document.getElementById('jogo-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Tamanho "de mentira" do jogo; o desenho é esticado para caber na tela
  const W = 600, H = 260, CHAO = H - 42;

  // ---------- ajustes do jogo (pode mexer!) ----------
  const GRAVIDADE = 2300;
  const PULO = -780;
  const VELOCIDADE_INICIAL = 300;
  const VELOCIDADE_MAXIMA = 760;
  const ACELERACAO = 9;          // quanto a velocidade aumenta por segundo
  // ---------------------------------------------------

  let estado = 'pronto';          // pronto | jogando | fim
  let visivel = false, segurando = false;
  let velocidade, pontos, obstaculos, estrelas, distanciaProx, deslocamento, tempoFim;
  const chapeu = { x: 90, y: 0, vy: 0, giro: 0, noChao: true, w: 58, h: 30 };

  let recorde = 0;
  try { recorde = Number(localStorage.getItem('chapeu-recorde')) || 0; } catch (e) {}

  // Montanhas do fundo (sorteadas uma vez só)
  const montanhas = [0, 1].map((camada) => {
    const pts = []; let x = 0;
    while (x < W * 2 + 100) { pts.push([x, 70 + camada * 35 + Math.random() * 45]); x += 50 + Math.random() * 70; }
    return pts;
  });

  // ---------- tela nítida (celular com tela "retina") ----------
  function ajustarTela() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.width * (H / W) * dpr);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    desenhar();
  }

  function reiniciar() {
    velocidade = VELOCIDADE_INICIAL; pontos = 0; deslocamento = 0;
    obstaculos = []; estrelas = []; distanciaProx = 260;
    chapeu.y = CHAO - chapeu.h; chapeu.vy = 0; chapeu.giro = 0; chapeu.noChao = true;
  }

  // ---------- comandos ----------
  function apertar() {
    if (estado === 'pronto') { reiniciar(); estado = 'jogando'; }
    else if (estado === 'fim') { if (performance.now() - tempoFim < 400) return; reiniciar(); estado = 'jogando'; }
    segurando = true;
    if (chapeu.noChao) { chapeu.vy = PULO; chapeu.noChao = false; }
  }
  function soltar() {
    segurando = false;
    if (chapeu.vy < -320) chapeu.vy = -320;   // soltou rápido = pulo baixinho
  }

  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); apertar(); });
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', soltar);
  addEventListener('keydown', (e) => {
    if (!visivel || !(e.code === 'Space' || e.code === 'ArrowUp')) return;
    e.preventDefault();             // não deixa a página rolar
    if (!e.repeat) apertar();
  });
  addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') soltar(); });

  // Pausa sozinho quando o jogo sai da tela
  new IntersectionObserver(([item]) => {
    visivel = item.isIntersecting;
    if (!visivel && estado === 'jogando') { estado = 'pronto'; desenhar(); }
  }, { threshold: 0.4 }).observe(canvas);

  // ---------- criação de obstáculos ----------
  function novoObstaculo() {
    const tipo = ['fardo', 'fardo', 'barril', 'feno'][Math.floor(Math.random() * 4)];
    const o = { tipo, x: W + 20 };
    if (tipo === 'fardo')  { o.w = 46; o.h = 34; }
    if (tipo === 'barril') { o.w = 32; o.h = 46; }
    if (tipo === 'feno')   { o.w = 30; o.h = 30; o.giro = 0; o.salto = 0; }
    o.y = CHAO - o.h;
    obstaculos.push(o);
    // às vezes um fardo duplo
    if (tipo === 'fardo' && velocidade > 420 && Math.random() < 0.3) {
      obstaculos.push({ tipo: 'fardo', x: o.x + 44, w: 46, h: 34, y: CHAO - 34 });
    }
    // às vezes uma estrela no ar, depois do obstáculo
    if (Math.random() < 0.45) estrelas.push({ x: o.x + 150 + Math.random() * 80, y: CHAO - 95 - Math.random() * 35, pega: false });
    distanciaProx = velocidade * (0.75 + Math.random() * 0.75) + 120;
  }

  function bateu(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ---------- regras do jogo, a cada quadro ----------
  function atualizar(dt) {
    velocidade = Math.min(VELOCIDADE_MAXIMA, velocidade + ACELERACAO * dt);
    const passo = velocidade * dt;
    deslocamento += passo;
    pontos += passo / 12;

    // chapéu
    chapeu.vy += GRAVIDADE * dt * (segurando || chapeu.vy > 0 ? 1 : 1.4);
    chapeu.y += chapeu.vy * dt;
    if (chapeu.y >= CHAO - chapeu.h) { chapeu.y = CHAO - chapeu.h; chapeu.vy = 0; chapeu.noChao = true; chapeu.giro = 0; }
    else chapeu.giro += dt * 9;

    // obstáculos
    distanciaProx -= passo;
    if (distanciaProx <= 0) novoObstaculo();
    obstaculos.forEach((o) => {
      o.x -= passo * (o.tipo === 'feno' ? 1.15 : 1);
      if (o.tipo === 'feno') { o.giro -= dt * 10; o.salto += dt * 9; o.y = CHAO - o.h - Math.abs(Math.sin(o.salto)) * 14; }
    });
    obstaculos = obstaculos.filter((o) => o.x + o.w > -20);

    // estrelas
    estrelas.forEach((s) => { s.x -= passo; });
    estrelas = estrelas.filter((s) => s.x > -20 && !s.pega);

    // colisões (caixa do chapéu um pouco menor, para ser justo)
    const caixa = { x: chapeu.x + 8, y: chapeu.y + 6, w: chapeu.w - 16, h: chapeu.h - 8 };
    for (const o of obstaculos) {
      if (bateu(caixa, { x: o.x + 3, y: o.y + 3, w: o.w - 6, h: o.h - 3 })) { fimDeJogo(); return; }
    }
    for (const s of estrelas) {
      if (bateu(caixa, { x: s.x - 12, y: s.y - 12, w: 24, h: 24 })) { s.pega = true; pontos += 25; }
    }
  }

  function fimDeJogo() {
    estado = 'fim'; tempoFim = performance.now(); segurando = false;
    if (Math.floor(pontos) > recorde) {
      recorde = Math.floor(pontos);
      try { localStorage.setItem('chapeu-recorde', recorde); } catch (e) {}
    }
  }

  // ---------- desenhos ----------
  function fundo() {
    const ceu = ctx.createLinearGradient(0, 0, 0, CHAO);
    ceu.addColorStop(0, '#22142a'); ceu.addColorStop(0.55, '#7a2e2a'); ceu.addColorStop(1, '#e09a45');
    ctx.fillStyle = ceu; ctx.fillRect(0, 0, W, CHAO);

    // sol
    ctx.fillStyle = 'rgba(255, 210, 120, .9)';
    ctx.beginPath(); ctx.arc(470, CHAO - 30, 46, 0, Math.PI * 2); ctx.fill();

    // montanhas (andam mais devagar = sensação de profundidade)
    ['#3b1f24', '#251418'].forEach((cor, i) => {
      const off = (deslocamento * (0.08 + i * 0.12)) % (W);
      ctx.fillStyle = cor; ctx.beginPath(); ctx.moveTo(-off, CHAO);
      montanhas[i].forEach(([x, y]) => ctx.lineTo(x - off, y + 40));
      ctx.lineTo(W * 2 - off, CHAO); ctx.closePath(); ctx.fill();
    });

    // cerca
    const offC = (deslocamento * 0.5) % 60;
    ctx.fillStyle = '#1a0f0c';
    for (let x = -offC; x < W + 60; x += 60) ctx.fillRect(x, CHAO - 34, 5, 34);
    ctx.fillRect(0, CHAO - 28, W, 3); ctx.fillRect(0, CHAO - 16, W, 3);

    // chão de terra
    ctx.fillStyle = '#5a3418'; ctx.fillRect(0, CHAO, W, H - CHAO);
    ctx.fillStyle = '#d9a443'; ctx.fillRect(0, CHAO, W, 3);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    const offT = deslocamento % 40;
    for (let x = -offT; x < W; x += 40) { ctx.fillRect(x, CHAO + 14, 14, 3); ctx.fillRect(x + 20, CHAO + 28, 8, 3); }
  }

  function desenharChapeu() {
    const c = chapeu, cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(c.giro);
    // sombra da aba
    ctx.fillStyle = '#3d2412';
    ctx.beginPath(); ctx.ellipse(0, 9, 29, 7, 0, 0, Math.PI * 2); ctx.fill();
    // copa
    ctx.fillStyle = '#7a4a24';
    ctx.beginPath();
    ctx.moveTo(-16, 8); ctx.quadraticCurveTo(-18, -12, -8, -14);
    ctx.quadraticCurveTo(0, -9, 8, -14); ctx.quadraticCurveTo(18, -12, 16, 8);
    ctx.closePath(); ctx.fill();
    // faixa vermelha
    ctx.fillStyle = '#b8322a'; ctx.fillRect(-16, 1, 32, 5);
    // aba
    ctx.fillStyle = '#8f5a2c';
    ctx.beginPath(); ctx.ellipse(0, 8, 29, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d9a443'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  }

  function desenharObstaculo(o) {
    if (o.tipo === 'fardo') {
      ctx.fillStyle = '#d8a845'; ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = '#a77a22'; ctx.lineWidth = 1;
      for (let y = o.y + 6; y < o.y + o.h; y += 6) { ctx.beginPath(); ctx.moveTo(o.x + 2, y); ctx.lineTo(o.x + o.w - 2, y); ctx.stroke(); }
      ctx.fillStyle = '#6b3a1c'; ctx.fillRect(o.x + 10, o.y, 3, o.h); ctx.fillRect(o.x + o.w - 13, o.y, 3, o.h);
    } else if (o.tipo === 'barril') {
      ctx.fillStyle = '#7b4321';
      ctx.beginPath(); ctx.roundRect(o.x, o.y, o.w, o.h, 7); ctx.fill();
      ctx.fillStyle = '#2b2b2b'; ctx.fillRect(o.x, o.y + 8, o.w, 4); ctx.fillRect(o.x, o.y + o.h - 12, o.w, 4);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(o.x + 6, o.y + 3, 4, o.h - 6);
    } else {
      ctx.save(); ctx.translate(o.x + o.w / 2, o.y + o.h / 2); ctx.rotate(o.giro);
      ctx.strokeStyle = '#b48a4a'; ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) { ctx.rotate(Math.PI / 3.5); ctx.beginPath(); ctx.ellipse(0, 0, 15, 8, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    }
  }

  function desenharEstrela(s) {
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(performance.now() / 600);
    ctx.fillStyle = '#ffd36b'; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 5 : 12, a = i * Math.PI / 5; ctx.lineTo(Math.sin(a) * r, -Math.cos(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function texto(t, x, y, tam, cor, alinhar) {
    ctx.font = `600 ${tam}px Oswald, Arial, sans-serif`;
    ctx.fillStyle = cor; ctx.textAlign = alinhar || 'center'; ctx.fillText(t, x, y);
  }

  function desenhar() {
    if (!obstaculos) reiniciar();
    fundo();
    estrelas.forEach(desenharEstrela);
    obstaculos.forEach(desenharObstaculo);
    desenharChapeu();

    texto(`PONTOS ${String(Math.floor(pontos)).padStart(5, '0')}`, W - 14, 26, 15, '#f4ede2', 'right');
    texto(`RECORDE ${String(recorde).padStart(5, '0')}`, W - 14, 46, 12, '#d9a443', 'right');

    if (estado !== 'jogando') {
      ctx.fillStyle = 'rgba(10,10,10,.55)'; ctx.fillRect(0, 0, W, H);
      if (estado === 'pronto') {
        texto('CHAPÉU SALTADOR', W / 2, H / 2 - 18, 30, '#f4ede2');
        texto('Toque na tela ou aperte ESPAÇO para pular', W / 2, H / 2 + 14, 15, '#d9a443');
      } else {
        texto('CAIU DO CAVALO!', W / 2, H / 2 - 22, 30, '#f4ede2');
        texto(`${Math.floor(pontos)} pontos`, W / 2, H / 2 + 6, 17, '#d9a443');
        texto('Toque ou aperte ESPAÇO para tentar de novo', W / 2, H / 2 + 34, 14, '#cfc6b8');
      }
    }
  }

  // ---------- relógio do jogo ----------
  let antes = performance.now();
  function quadro(agora) {
    const dt = Math.min((agora - antes) / 1000, 0.033); antes = agora;
    if (estado === 'jogando') { atualizar(dt); desenhar(); }
    requestAnimationFrame(quadro);
  }

  addEventListener('resize', ajustarTela);
  if (document.fonts) document.fonts.ready.then(desenhar);
  reiniciar(); ajustarTela();
  requestAnimationFrame(quadro);
})();
