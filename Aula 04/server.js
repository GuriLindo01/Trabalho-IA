// ---------- BLOCO 1: configuração ----------
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORTA = 3003;
const URL_OLLAMA = 'http://localhost:11434/api/chat';
const MODELO = 'qwen2.5:3b';
const LIMITE_HISTORICO = 20;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PROMPT_SISTEMA = `Você é o atendente virtual de uma loja de informática.
Responda sempre em português, de forma curta.
Para qualquer pergunta sobre produtos, clientes ou pedidos, use sempre uma ferramenta antes de responder.
Nunca invente dados: responda apenas com o que as ferramentas devolverem.
Liste todos os itens que a ferramenta devolver, sem pular nenhum.
Se a ferramenta devolver uma lista vazia, diga que a loja não tem.
Lembre do que o cliente já disse nesta conversa (nome, preferências) e use isso nas respostas.`;

// ---------- BLOCO 2: banco e funções de memória ----------
const banco = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'escola',
  database: 'loja_ia'
});

async function lerHistorico(conversa) {
  const [linhas] = await banco.query(
    `SELECT role, content FROM (
       SELECT id, role, content FROM mensagens
       WHERE conversa = ? ORDER BY id DESC LIMIT ?
     ) AS ultimas ORDER BY id`,
    [conversa, LIMITE_HISTORICO]
  );
  return linhas;
}

async function salvarMensagem(conversa, role, content) {
  await banco.query(
    'INSERT INTO mensagens (conversa, role, content) VALUES (?, ?, ?)',
    [conversa, role, content]
  );
}

async function apagarHistorico(conversa) {
  await banco.query('DELETE FROM mensagens WHERE conversa = ?', [conversa]);
}

async function apagarUltimaResposta(conversa) {
  const [linhas] = await banco.query(
    'SELECT id, role FROM mensagens WHERE conversa = ? ORDER BY id DESC LIMIT 1',
    [conversa]
  );
  if (linhas.length > 0 && linhas[0].role === 'assistant') {
    await banco.query('DELETE FROM mensagens WHERE id = ?', [linhas[0].id]);
  }
}

// ---------- BLOCO 3: funções e ferramentas ----------
const funcoes = {
  listar_produtos: async (args) => {
    let sql = 'SELECT * FROM produtos WHERE 1 = 1';
    const valores = [];
    if (args.categoria) {
      sql += ' AND categoria = ?';
      valores.push(args.categoria);
    }
    if (args.sem_estoque) sql += ' AND estoque = 0';
    const [linhas] = await banco.query(sql, valores);
    return linhas;
  },
  listar_clientes: async (args) => {
    if (args.cidade) {
      const [linhas] = await banco.query('SELECT * FROM clientes WHERE cidade = ?', [args.cidade]);
      return linhas;
    }
    const [linhas] = await banco.query('SELECT * FROM clientes');
    return linhas;
  },
  listar_pedidos: async (args) => {
    const [linhas] = await banco.query(`
      SELECT
        pedidos.id,
        clientes.nome AS cliente,
        produtos.nome AS produto,
        pedidos.quantidade,
        produtos.preco * pedidos.quantidade AS total,
        DATE_FORMAT(pedidos.data_pedido, '%Y-%m-%d') AS data_pedido,
        pedidos.status
      FROM pedidos
      JOIN clientes ON clientes.id = pedidos.cliente_id
      JOIN produtos ON produtos.id = pedidos.produto_id
      WHERE ? IS NULL OR pedidos.status = ?
      ORDER BY pedidos.id
    `, [args.status || null, args.status || null]);
    return linhas;
  }
};

const ferramentas = [
  {
    type: 'function',
    function: {
      name: 'listar_produtos',
      description: 'Lista os produtos da loja com nome, categoria, preço e estoque. Estoque 0 significa produto em falta.',
      parameters: {
        type: 'object',
        properties: {
          categoria: {
            type: 'string',
            description: 'Opcional. Filtra por categoria: Periféricos, Áudio, Monitores, Armazenamento, Computadores ou Móveis.'
          },
          sem_estoque: {
            type: 'boolean',
            description: 'Opcional. Use true para trazer só os produtos em falta (estoque 0).'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'listar_clientes',
      description: 'Lista os clientes da loja com nome, email e cidade.',
      parameters: {
        type: 'object',
        properties: {
          cidade: {
            type: 'string',
            description: 'Opcional. Traz só os clientes desta cidade.'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'listar_pedidos',
      description: 'Lista os pedidos com nome do cliente, produto, quantidade, total, data e status.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pendente', 'enviado', 'entregue', 'cancelado'],
            description: 'Opcional. Traz só os pedidos com este status.'
          }
        }
      }
    }
  }
];

// ---------- BLOCO 4: laço do agente e geração de título ----------
async function rodarAgente(mensagens) {
  const usadas = [];

  for (let volta = 0; volta < 5; volta++) {
    const resposta = await fetch(URL_OLLAMA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODELO, messages: mensagens, tools: ferramentas, stream: false })
    });
    if (!resposta.ok) throw new Error('Ollama respondeu HTTP ' + resposta.status);

    const mensagem = (await resposta.json()).message;
    mensagens.push(mensagem);

    if (!mensagem.tool_calls) {
      return { resposta: mensagem.content, ferramentas: usadas };
    }

    for (const chamada of mensagem.tool_calls) {
      const nome = chamada.function.name;
      const funcao = funcoes[nome];
      const resultado = funcao
        ? await funcao(chamada.function.arguments || {})
        : { erro: 'Ferramenta ' + nome + ' não existe' };

      console.log('Ferramenta:', nome, JSON.stringify(chamada.function.arguments));
      usadas.push(nome);
      mensagens.push({ role: 'tool', tool_name: nome, content: JSON.stringify(resultado) });
    }
  }

  return { resposta: 'Não consegui chegar a uma resposta.', ferramentas: usadas };
}

async function gerarTitulo(textoCliente, respostaAgente) {
  try {
    const resposta = await fetch(URL_OLLAMA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODELO,
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'Você cria títulos curtos para conversas de chat. Responda APENAS com um título de 2 a 4 palavras em português que resuma o tema. Sem aspas, sem ponto final e sem explicações.'
          },
          {
            role: 'user',
            content: `Cliente: ${textoCliente}\nAtendente: ${respostaAgente}`
          }
        ]
      })
    });
    if (!resposta.ok) return null;

    const dados = await resposta.json();
    const titulo = dados.message?.content
      ?.replace(/["'.!?]/g, '')
      .trim();

    return titulo || null;
  } catch {
    return null;
  }
}

// ---------- BLOCO 5: validação ----------
function idValido(conversa) {
  return typeof conversa === 'string' && conversa.length > 0 && conversa.length <= 36;
}

function entradaValida(conversa, texto) {
  return idValido(conversa)
    && typeof texto === 'string' && texto.trim().length > 0 && texto.length <= 2000;
}

// ---------- BLOCO 6: rotas ----------
app.get('/historico/:conversa', async (req, res) => {
  if (!idValido(req.params.conversa)) {
    return res.status(400).json({ erro: 'ID de conversa inválido.' });
  }
  res.json(await lerHistorico(req.params.conversa));
});

app.delete('/historico/:conversa', async (req, res) => {
  if (!idValido(req.params.conversa)) {
    return res.status(400).json({ erro: 'ID de conversa inválido.' });
  }
  await apagarHistorico(req.params.conversa);
  res.json({ ok: true });
});

app.post('/chat', async (req, res) => {
  const { conversa, texto } = req.body;
  if (!entradaValida(conversa, texto)) {
    return res.status(400).json({ erro: 'Envie conversa e texto.' });
  }

  const historico = await lerHistorico(conversa);
  const textoHistorico = historico
    .map((m) => (m.role === 'user' ? 'Cliente: ' : 'Atendente: ') + m.content)
    .join('\n');

  const mensagens = [
    { role: 'system', content: PROMPT_SISTEMA + (historico.length ? '\n\nConversa até agora:\n' + textoHistorico : '') },
    { role: 'user', content: texto }
  ];

  const resultado = await rodarAgente(mensagens);
  await salvarMensagem(conversa, 'user', texto);
  await salvarMensagem(conversa, 'assistant', resultado.resposta);

  let titulo = null;
  if (historico.length === 0) {
    titulo = await gerarTitulo(texto, resultado.resposta);
  }

  res.json({ ...resultado, titulo });
});

// Apaga a última resposta do assistente e gera uma nova para a mesma pergunta
app.post('/regenerar', async (req, res) => {
  const { conversa } = req.body;
  if (!idValido(conversa)) {
    return res.status(400).json({ erro: 'ID de conversa inválido.' });
  }

  await apagarUltimaResposta(conversa);

  const historico = await lerHistorico(conversa);
  if (historico.length === 0 || historico[historico.length - 1].role !== 'user') {
    return res.status(400).json({ erro: 'Nenhuma mensagem encontrada para repetir.' });
  }

  const ultimaPergunta = historico.pop();
  const textoHistorico = historico
    .map((m) => (m.role === 'user' ? 'Cliente: ' : 'Atendente: ') + m.content)
    .join('\n');

  const mensagens = [
    { role: 'system', content: PROMPT_SISTEMA + (historico.length ? '\n\nConversa até agora:\n' + textoHistorico : '') },
    { role: 'user', content: ultimaPergunta.content }
  ];

  const resultado = await rodarAgente(mensagens);
  await salvarMensagem(conversa, 'assistant', resultado.resposta);

  res.json(resultado);
});

app.use((erro, req, res, next) => {
  console.error(erro.message);
  res.status(500).json({ erro: 'Falha no servidor: ' + erro.message });
});

app.listen(PORTA, () => {
  console.log('Agente com memória no ar: http://localhost:' + PORTA);
});