// Endereço do Ollama rodando na própria máquina
const URL_OLLAMA = 'http://localhost:11434/api/chat';
const MODELO = 'qwen2.5:3b';

// O modelo não lembra de nada sozinho: a cada pergunta
// enviamos a conversa inteira de novo.
const mensagens = [
    { role: 'system', content: 'Você é um assistente que responde em português, de forma curta e clara.' }
];

const chat = document.getElementById('chat');
const form = document.getElementById('form');
const pergunta = document.getElementById('pergunta');
const enviar = document.getElementById('enviar');

function mostrar(role, texto) {
    const div = document.createElement('div');
    div.className = 'msg ' + role;
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
    mostrar('user', texto);
    pergunta.value = '';
    enviar.disabled = true;
    const balao = mostrar('assistant', 'Pensando...');

    try {
        const resposta = await fetch(URL_OLLAMA, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: MODELO, messages: mensagens, stream: false })
        });

        if (!resposta.ok) throw new Error('HTTP ' + resposta.status);

        const dados = await resposta.json();
        mensagens.push(dados.message);
        balao.textContent = dados.message.content;
    } catch (erro) {
        mensagens.pop(); // pergunta sem resposta não fica no histórico
        balao.textContent = 'Erro ao falar com o Ollama: ' + erro.message + '. O Ollama está rodando?';
    }

    enviar.disabled = false;
    pergunta.focus();
});