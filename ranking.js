// =========================================================
// RANKING DO CHAPÉU SALTADOR — Top 5 da temporada
// As pontuações ficam numa planilha do Google da banda.
// A temporada muda a cada 3 meses (jan–mar, abr–jun, jul–set, out–dez)
// e o ranking começa do zero sozinho.
// O ranking público mostra só o APELIDO. Nome, e-mail e telefone
// ficam guardados só na planilha.
// =========================================================
(function () {
  // Endereço do "App da Web" da planilha (termina em /exec).
  // Enquanto estiver vazio, o ranking fica em MODO DE TESTE:
  // só aparece no localhost e guarda tudo só neste navegador.
  const RANKING_URL = 'https://script.google.com/macros/s/AKfycby19bi2q3CxxbNsr3KPkkgLxSecH9mHK2tC9Tl8vwn6p7jFir8rcBGGqzQhv1bOVUHifw/exec';

  const placar = document.getElementById('placar');
  if (!placar) return;

  const testando = !RANKING_URL;
  const emCasa = ['localhost', '127.0.0.1', ''].includes(location.hostname);
  if (testando && !emCasa) { placar.hidden = true; return; }   // site publicado sem planilha: não mostra nada

  const $ = (id) => document.getElementById(id);
  const barraSalvar = $('ranking-salvar'), botao = $('ranking-botao'), trocar = $('ranking-trocar');
  const msg = $('ranking-msg'), lista = $('ranking-lista'), rotuloTemporada = $('ranking-temporada');
  const dialogo = $('ranking-cadastro'), form = $('ranking-form'), erro = $('ranking-erro');

  let ultima = null;       // última partida: { pontos, segundos, salva }
  if (testando) $('ranking-aviso').hidden = false;

  // ---------- jogador lembrado neste aparelho ----------
  function lerJogador() {
    try { return JSON.parse(localStorage.getItem('chapeu-jogador')) || null; } catch (e) { return null; }
  }
  function guardarJogador(j) {
    try { localStorage.setItem('chapeu-jogador', JSON.stringify(j)); } catch (e) {}
  }

  // ---------- temporada (a cada 3 meses) ----------
  function temporada(d) {
    const ano = d.getFullYear(), tri = Math.floor(d.getMonth() / 3);
    const nomes = ['jan–mar', 'abr–jun', 'jul–set', 'out–dez'];
    return {
      id: `${ano}-T${tri + 1}`,
      rotulo: `${nomes[tri]} ${ano}`,
      zeraEm: new Date(ano, tri * 3 + 3, 1).toLocaleDateString('pt-BR'),
    };
  }

  // ---------- conversa com a planilha ----------
  async function pedirTop() {
    if (testando) return testeTop(null);
    const r = await fetch(`${RANKING_URL}?acao=top`);
    return r.json();
  }
  async function mandarPontos(dados) {
    if (testando) return testeSalvar(dados);
    // text/plain evita a "pergunta prévia" (CORS) que o Google não responde
    const r = await fetch(RANKING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(dados),
    });
    return r.json();
  }

  // ---------- MODO DE TESTE: imita a planilha dentro do navegador ----------
  function testeLinhas() {
    try { return JSON.parse(localStorage.getItem('chapeu-ranking-teste')) || []; } catch (e) { return []; }
  }
  function testeTop(email) {
    const t = temporada(new Date());
    const melhor = {};
    testeLinhas().filter((l) => l.temporada === t.id).forEach((l) => {
      const a = melhor[l.email];
      if (!a || l.pontos > a.pontos || (l.pontos === a.pontos && l.quando < a.quando)) melhor[l.email] = l;
    });
    const ordem = Object.values(melhor).sort((a, b) => b.pontos - a.pontos || a.quando - b.quando);
    const resposta = {
      ok: true, temporada: t.rotulo, zeraEm: t.zeraEm,
      top: ordem.slice(0, 5).map((l) => ({ apelido: l.apelido, pontos: l.pontos })),
    };
    if (email) {
      const i = ordem.findIndex((l) => l.email === email);
      resposta.posicao = i + 1; resposta.recordePessoal = i >= 0 ? ordem[i].pontos : 0;
    }
    return resposta;
  }
  function testeSalvar(d) {
    const linhas = testeLinhas(), email = d.email.trim().toLowerCase();
    linhas.push({ temporada: temporada(new Date()).id, apelido: d.apelido.trim(), email, pontos: d.pontos, quando: Date.now() });
    try { localStorage.setItem('chapeu-ranking-teste', JSON.stringify(linhas)); } catch (e) {}
    return testeTop(email);
  }

  // ---------- desenha o Top 5 ----------
  function mostrarTop(r) {
    if (!r || !r.top) return;
    rotuloTemporada.textContent = `Temporada ${r.temporada} · zera em ${r.zeraEm}`;
    lista.replaceChildren();
    for (let i = 0; i < 5; i++) {
      const item = r.top[i];
      const li = document.createElement('li');
      if (!item) li.className = 'vago';
      const pos = document.createElement('span'); pos.className = 'pos'; pos.textContent = `${i + 1}º`;
      const nome = document.createElement('span'); nome.className = 'apelido'; nome.textContent = item ? item.apelido : '—';
      const pts = document.createElement('span'); pts.className = 'pts'; pts.textContent = item ? item.pontos.toLocaleString('pt-BR') : '';
      li.append(pos, nome, pts);
      lista.append(li);
    }
    if (!r.top.length) msgVazio();
  }
  function msgVazio() {
    if (!msg.textContent) msg.textContent = 'Ninguém pontuou ainda nesta temporada. Seja o primeiro!';
  }

  async function carregarTop() {
    try { mostrarTop(await pedirTop()); }
    catch (e) { rotuloTemporada.textContent = 'Não deu para carregar o ranking agora.'; }
  }
  // só busca o ranking quando a pessoa chega perto do jogo
  new IntersectionObserver(([item], obs) => {
    if (item.isIntersecting) { obs.disconnect(); carregarTop(); }
  }, { rootMargin: '400px' }).observe(placar);

  // ---------- fim de partida: oferece salvar ----------
  addEventListener('chapeu:inicio', () => {
    if (dialogo.open) return;
    barraSalvar.hidden = true;
  });
  addEventListener('chapeu:fim', (e) => {
    const { pontos, segundos } = e.detail;
    if (pontos < 1) return;
    ultima = { pontos, segundos, salva: false };
    $('ranking-pontos').textContent = pontos.toLocaleString('pt-BR');
    const j = lerJogador();
    botao.disabled = false;
    botao.textContent = j ? `Salvar como ${j.apelido}` : 'Salvar no ranking';
    trocar.hidden = !j;
    msg.textContent = '';
    barraSalvar.hidden = false;
  });

  botao.addEventListener('click', () => {
    if (!ultima || ultima.salva) return;
    const j = lerJogador();
    if (j) salvar(j); else abrirCadastro(null);
  });
  trocar.addEventListener('click', () => abrirCadastro(null));

  // ---------- cadastro ----------
  function abrirCadastro(j) {
    form.reset(); erro.textContent = '';
    if (j) ['nome', 'apelido', 'email', 'telefone'].forEach((c) => { form[c].value = j[c] || ''; });
    dialogo.querySelector('[data-pontos]').textContent = ultima ? ultima.pontos.toLocaleString('pt-BR') : '0';
    dialogo.showModal();
    form.nome.focus();
  }
  $('ranking-cancelar').addEventListener('click', () => dialogo.close());

  function conferir() {
    const nome = form.nome.value.trim(), apelido = form.apelido.value.trim();
    const email = form.email.value.trim(), tel = form.telefone.value.replace(/\D/g, '');
    if (nome.length < 2) return ['nome', 'Escreva o seu nome.'];
    if (apelido.length < 2 || apelido.length > 15) return ['apelido', 'O apelido precisa ter de 2 a 15 letras.'];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return ['email', 'Confira o e-mail.'];
    if (tel.length < 10 || tel.length > 13) return ['telefone', 'Escreva o telefone com DDD.'];
    if (!form.aceite.checked) return ['aceite', 'Marque que concorda para entrar no ranking.'];
    return null;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const problema = conferir();
    if (problema) { erro.textContent = problema[1]; form[problema[0]].focus(); return; }
    const j = {
      nome: form.nome.value.trim(), apelido: form.apelido.value.trim(),
      email: form.email.value.trim(), telefone: form.telefone.value.trim(),
      novidades: form.novidades.checked,
    };
    const ok = await salvar(j, true);
    if (ok) { guardarJogador(j); dialogo.close(); }
  });

  // ---------- envia a pontuação ----------
  async function salvar(j, peloCadastro) {
    const enviar = dialogo.querySelector('button[type="submit"]');
    botao.disabled = true; enviar.disabled = true;
    msg.textContent = 'Salvando…'; erro.textContent = '';
    try {
      const r = await mandarPontos({
        nome: j.nome, apelido: j.apelido, email: j.email, telefone: j.telefone,
        novidades: !!j.novidades, aceite: true,
        pontos: ultima.pontos, segundos: ultima.segundos,
      });
      if (!r.ok) { const e = new Error(r.erro || 'Não deu para salvar.'); e.doRanking = true; throw e; }
      ultima.salva = true;
      botao.textContent = 'Salvo ✓'; trocar.hidden = true;
      mostrarTop(r);
      msg.textContent = r.posicao && r.posicao <= 5
        ? `Boa, ${j.apelido}! Você está em ${r.posicao}º lugar no Top 5. 🤠`
        : `Pontuação salva! Seu melhor nesta temporada: ${Number(r.recordePessoal).toLocaleString('pt-BR')} pontos (${r.posicao}º lugar).`;
      return true;
    } catch (falha) {
      // mensagens do ranking aparecem como vieram; problemas de internet viram uma frase simples
      const texto = falha && falha.doRanking ? falha.message : 'Não deu para falar com o ranking agora. Tente de novo.';
      if (peloCadastro) { erro.textContent = texto; msg.textContent = ''; } else msg.textContent = texto;
      botao.disabled = false;
      return false;
    } finally {
      enviar.disabled = false;
    }
  }
})();
