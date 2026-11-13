const chat = document.getElementById('chat');
const form = document.getElementById('form');
const pergunta = document.getElementById('pergunta');
const enviar = document.getElementById('enviar');
const nova = document.getElementById('nova');

// Elementos da barra lateral
const listaChats = document.getElementById('lista-chats');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const toggleSidebar = document.getElementById('toggle-sidebar');

// Ícones SVG
const ICONE_EDITAR = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
`;

const ICONE_EXCLUIR = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
`;

const ICONE_REPETIR = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
  </svg>
`;

// Sugestões exibidas na tela inicial de boas-vindas
const SUGESTOES_INICIAIS = [
  {
    titulo: 'Consultar estoque',
    subtitulo: 'Ver produtos da categoria Áudio',
    prompt: 'Quais produtos de Áudio vocês têm disponíveis?'
  },
  {
    titulo: 'Pedidos pendentes',
    subtitulo: 'Acompanhar entregas em aberto',
    prompt: 'Quais pedidos estão com status pendente?'
  },
  {
    titulo: 'Produtos em falta',
    subtitulo: 'Checar itens zerados no banco',
    prompt: 'Quais produtos estão sem estoque no momento?'
  },
  {
    titulo: 'Testar memória',
    subtitulo: 'Salvar meu nome e preferência',
    prompt: 'Oi! Meu nome é Lucas e gosto de periféricos.'
  }
];

let conversas = JSON.parse(localStorage.getItem('conversas')) || [];
let conversa = localStorage.getItem('conversa');
let ocupando = false;

if (!conversa) {
  conversa = crypto.randomUUID();
  localStorage.setItem('conversa', conversa);
}

if (!conversas.some(c => c.id === conversa)) {
  conversas.unshift({ id: conversa, titulo: 'Nova conversa', renomeado: false });
  salvarListaConversas();
}

function salvarListaConversas() {
  localStorage.setItem('conversas', JSON.stringify(conversas));
}

function mostrarBoasVindas() {
  chat.textContent = '';

  const container = document.createElement('div');
  container.className = 'welcome-screen';
  container.innerHTML = `
    <div class="welcome-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2a4 4 0 0 1 4 4v2h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2V6a4 4 0 0 1 4-4z"/>
        <circle cx="9" cy="13" r="1"/>
        <circle cx="15" cy="13" r="1"/>
      </svg>
    </div>
    <h2>Olá! Como posso ajudar hoje?</h2>
    <p>Sou o atendente virtual da loja. Posso consultar produtos, clientes e pedidos no banco de dados e lembrar do que você me contar nesta conversa.</p>
    <div class="suggestions-grid"></div>
  `;

  const grid = container.querySelector('.suggestions-grid');
  for (const sug of SUGESTOES_INICIAIS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'suggestion-chip';
    btn.innerHTML = `${sug.titulo}<span>${sug.subtitulo}</span>`;

    btn.addEventListener('click', () => enviarMensagem(sug.prompt));
    grid.appendChild(btn);
  }

  chat.appendChild(container);
}

function extrairTemaLocal(texto) {
  let limpo = texto.trim();
  const ruidos = /^(oi|olá|ola|bom dia|boa tarde|boa noite|e aí|eai|tudo bem|por favor|me ajuda a|me ajude a|pode me ajudar a|como faço para|como fazer|quero saber sobre|quero saber|gostaria de saber|preciso de|me explica|explique|fale sobre)[,\s?!.-]*/i;

  let anterior;
  do {
    anterior = limpo;
    limpo = limpo.replace(ruidos, '').trim();
  } while (limpo !== anterior && limpo.length > 0);

  if (!limpo) limpo = texto.trim();

  limpo = limpo.charAt(0).toUpperCase() + limpo.slice(1);
  limpo = limpo.replace(/[?!.]+$/, '');

  if (limpo.length > 32) {
    limpo = limpo.slice(0, 32).replace(/\s+\S*$/, '') + '...';
  }
  return limpo;
}

function definirTituloConversa(id, novoTitulo, forcar = false) {
  const item = conversas.find(c => c.id === id);
  if (!item || !novoTitulo) return;

  if (forcar || (!item.renomeado && (item.titulo === 'Nova conversa' || item.titulo === 'Gerando título...'))) {
    item.titulo = novoTitulo;
    salvarListaConversas();
    renderizarSidebar();
  }
}

function ativarModoRenomear(li, spanTitulo, acoesDiv, item) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'chat-rename-input';
  input.value = item.titulo;
  input.maxLength = 60;

  let finalizado = false;

  const concluir = (salvar) => {
    if (finalizado) return;
    finalizado = true;

    if (salvar) {
      const novoTitulo = input.value.trim();
      if (novoTitulo) {
        item.titulo = novoTitulo;
        item.renomeado = true;
        salvarListaConversas();
      }
    }
    renderizarSidebar();
  };

  input.addEventListener('click', (e) => e.stopPropagation());

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      concluir(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      concluir(false);
    }
  });

  input.addEventListener('blur', () => concluir(true));

  spanTitulo.replaceWith(input);
  acoesDiv.style.display = 'none';
  input.focus();
  input.select();
}

async function excluirConversa(id) {
  try {
    await fetch('/historico/' + id, { method: 'DELETE' });
  } catch (erro) {
    console.error('Erro ao apagar do banco:', erro);
  }

  conversas = conversas.filter(c => c.id !== id);

  if (id === conversa) {
    if (conversas.length > 0) {
      conversa = conversas[0].id;
    } else {
      conversa = crypto.randomUUID();
      conversas.push({ id: conversa, titulo: 'Nova conversa', renomeado: false });
    }
    localStorage.setItem('conversa', conversa);
    carregarHistorico();
  }

  salvarListaConversas();
  renderizarSidebar();
}

function renderizarSidebar() {
  if (!listaChats) return;
  listaChats.textContent = '';

  for (const item of conversas) {
    const li = document.createElement('li');
    li.className = 'chat-item' + (item.id === conversa ? ' active' : '');

    const spanTitulo = document.createElement('span');
    spanTitulo.className = 'chat-title';
    spanTitulo.textContent = item.titulo;
    spanTitulo.title = item.titulo;

    spanTitulo.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      ativarModoRenomear(li, spanTitulo, acoesDiv, item);
    });

    const acoesDiv = document.createElement('div');
    acoesDiv.className = 'chat-actions';

    const btnRenomear = document.createElement('button');
    btnRenomear.type = 'button';
    btnRenomear.className = 'btn-chat-action rename';
    btnRenomear.title = 'Renomear conversa';
    btnRenomear.innerHTML = ICONE_EDITAR;
    btnRenomear.addEventListener('click', (e) => {
      e.stopPropagation();
      ativarModoRenomear(li, spanTitulo, acoesDiv, item);
    });

    const btnExcluir = document.createElement('button');
    btnExcluir.type = 'button';
    btnExcluir.className = 'btn-chat-action delete';
    btnExcluir.title = 'Excluir conversa';
    btnExcluir.innerHTML = ICONE_EXCLUIR;
    btnExcluir.addEventListener('click', (e) => {
      e.stopPropagation();
      excluirConversa(item.id);
    });

    acoesDiv.appendChild(btnRenomear);
    acoesDiv.appendChild(btnExcluir);

    li.appendChild(spanTitulo);
    li.appendChild(acoesDiv);

    li.addEventListener('click', () => {
      if (item.id === conversa) return;
      conversa = item.id;
      localStorage.setItem('conversa', conversa);
      renderizarSidebar();
      carregarHistorico();
      fecharSidebarMobile();
    });

    listaChats.appendChild(li);
  }
}

// Adiciona o botão "Repetir" apenas na última resposta do assistente
function atualizarBotaoRegenerar() {
  document.querySelectorAll('.msg-footer').forEach(el => el.remove());

  const respostas = document.querySelectorAll('.assistant-row');
  if (respostas.length === 0) return;

  const ultimaRow = respostas[respostas.length - 1];
  const footer = document.createElement('div');
  footer.className = 'msg-footer';

  const btnRegenerar = document.createElement('button');
  btnRegenerar.type = 'button';
  btnRegenerar.className = 'btn-regenerar';
  btnRegenerar.title = 'Gerar resposta novamente';
  btnRegenerar.innerHTML = `${ICONE_REPETIR} Repetir`;
  btnRegenerar.disabled = ocupando;

  btnRegenerar.addEventListener('click', () => regenerarUltimaResposta(ultimaRow));

  footer.appendChild(btnRegenerar);
  ultimaRow.appendChild(footer);
}

function mostrarMensagemUsuario(texto) {
  document.querySelector('.welcome-screen')?.remove();

  const row = document.createElement('div');
  row.className = 'msg-row user-row';

  const btnRepetir = document.createElement('button');
  btnRepetir.type = 'button';
  btnRepetir.className = 'btn-repeat-user';
  btnRepetir.title = 'Repetir esta mensagem';
  btnRepetir.innerHTML = ICONE_REPETIR;
  btnRepetir.addEventListener('click', () => enviarMensagem(texto));

  const balao = document.createElement('div');
  balao.className = 'msg user';
  balao.textContent = texto;

  row.appendChild(btnRepetir);
  row.appendChild(balao);
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

function mostrarMensagemAssistente(texto) {
  document.querySelector('.welcome-screen')?.remove();

  const row = document.createElement('div');
  row.className = 'msg-row assistant-row';

  const balao = document.createElement('div');
  balao.className = 'msg assistant';
  balao.textContent = texto;

  row.appendChild(balao);
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;

  return { row, balao };
}

function mostrarFerramentas(row, listaFerramentas) {
  if (!listaFerramentas || listaFerramentas.length === 0) return;
  const div = document.createElement('div');
  div.className = 'ferramentas';
  div.textContent = 'Consultou: ' + listaFerramentas.join(', ');

  const footer = row.querySelector('.msg-footer');
  if (footer) {
    row.insertBefore(div, footer);
  } else {
    row.appendChild(div);
  }
  chat.scrollTop = chat.scrollHeight;
}

function definirEstadoCarregando(carregando) {
  ocupando = carregando;
  enviar.disabled = carregando;
  document.querySelectorAll('.btn-regenerar').forEach(btn => {
    btn.disabled = carregando;
  });
}

// Pede para a IA refazer a última resposta sem duplicar a pergunta no banco
async function regenerarUltimaResposta(row) {
  if (ocupando) return;

  const balao = row.querySelector('.msg.assistant');
  row.querySelector('.ferramentas')?.remove();
  balao.textContent = 'Pensando...';
  definirEstadoCarregando(true);

  try {
    const resposta = await fetch('/regenerar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversa })
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro);

    balao.textContent = dados.resposta;
    mostrarFerramentas(row, dados.ferramentas);
  } catch (erro) {
    balao.textContent = 'Erro: ' + erro.message;
  }

  definirEstadoCarregando(false);
  pergunta.focus();
}

async function enviarMensagem(textoParam) {
  const texto = (textoParam ?? pergunta.value).trim();
  if (!texto || ocupando) return;

  const chatAtual = conversas.find(c => c.id === conversa);
  const precisaDeTitulo = chatAtual && !chatAtual.renomeado && chatAtual.titulo === 'Nova conversa';

  if (precisaDeTitulo) {
    definirTituloConversa(conversa, 'Gerando título...');
  }

  mostrarMensagemUsuario(texto);
  if (textoParam === undefined) {
    pergunta.value = '';
  }

  definirEstadoCarregando(true);
  const { row, balao } = mostrarMensagemAssistente('Pensando...');

  try {
    const resposta = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversa: conversa, texto: texto })
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro);

    balao.textContent = dados.resposta;
    mostrarFerramentas(row, dados.ferramentas);

    if (precisaDeTitulo) {
      const tituloFinal = dados.titulo ? dados.titulo.trim() : extrairTemaLocal(texto);
      definirTituloConversa(conversa, tituloFinal);
    }
  } catch (erro) {
    balao.textContent = 'Erro: ' + erro.message;
    if (precisaDeTitulo) {
      definirTituloConversa(conversa, extrairTemaLocal(texto));
    }
  }

  definirEstadoCarregando(false);
  atualizarBotaoRegenerar();
  pergunta.focus();
}

// Busca no MySQL o histórico do ID ativo e redesenha a tela
async function carregarHistorico() {
  chat.textContent = '';
  try {
    const resposta = await fetch('/historico/' + conversa);
    const mensagens = await resposta.json();
    if (!resposta.ok) throw new Error(mensagens.erro);

    if (mensagens.length === 0) {
      mostrarBoasVindas();
      return;
    }

    for (const m of mensagens) {
      if (m.role === 'user') {
        mostrarMensagemUsuario(m.content);
      } else {
        mostrarMensagemAssistente(m.content);
      }
    }

    atualizarBotaoRegenerar();

    const primeiraUser = mensagens.find(m => m.role === 'user');
    if (primeiraUser) {
      definirTituloConversa(conversa, extrairTemaLocal(primeiraUser.content));
    }
  } catch (erro) {
    mostrarMensagemAssistente('Erro ao carregar o histórico: ' + erro.message);
  }
}

nova.addEventListener('click', () => {
  conversa = crypto.randomUUID();
  localStorage.setItem('conversa', conversa);

  conversas.unshift({ id: conversa, titulo: 'Nova conversa', renomeado: false });
  salvarListaConversas();
  renderizarSidebar();

  mostrarBoasVindas();
  fecharSidebarMobile();
  pergunta.focus();
});

form.addEventListener('submit', (evento) => {
  evento.preventDefault();
  enviarMensagem();
});

// Controle do menu lateral no celular
function fecharSidebarMobile() {
  sidebar?.classList.remove('open');
  overlay?.classList.remove('open');
}

toggleSidebar?.addEventListener('click', () => {
  sidebar?.classList.toggle('open');
  overlay?.classList.toggle('open');
});

overlay?.addEventListener('click', fecharSidebarMobile);

// Inicialização
renderizarSidebar();
carregarHistorico();