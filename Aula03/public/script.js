// AULA 03 - GABARITO DO PROFESSOR - JS da página
// PROFESSOR: partir do script.js da aula 01. Só 3 coisas mudam:
//   1. A página chama o NOSSO servidor (/chat), não mais o Ollama.
//   2. O prompt de sistema saiu daqui e foi para o servidor.
//   3. Mostramos quais ferramentas o agente usou.

// A conversa continua guardada aqui e é reenviada inteira a cada pergunta.
const mensagens = [];

const chat = document.getElementById('chat');
const form = document.getElementById('form');
const pergunta = document.getElementById('pergunta');
const enviar = document.getElementById('enviar');

function mostrar(classe, texto) {
  const div = document.createElement('div');
  div.className = classe;
  div.textContent = texto;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const texto = pergunta.value.trim();
  if (!texto) return;

  mensagens.push({ role: 'user', content: texto });
  mostrar('msg user', texto);
  pergunta.value = '';
  enviar.disabled = true;
  const balao = mostrar('msg assistant', 'Pensando...');

  try {
    const resposta = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagens: mensagens })
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro);

    mensagens.push({ role: 'assistant', content: dados.resposta });
    balao.textContent = dados.resposta;

    // PROFESSOR: deixa visível para o aluno quando o agente consultou a API
    if (dados.ferramentas.length > 0) {
      mostrar('ferramentas', 'Consultou: ' + dados.ferramentas.join(', '));
    }
  } catch (erro) {
    mensagens.pop(); // pergunta sem resposta não fica no histórico
    balao.textContent = 'Erro: ' + erro.message;
  }
  enviar.disabled = false;
  pergunta.focus();
});
