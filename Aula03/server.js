
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORTA = 3002;
const URL_OLLAMA = 'http://localhost:11434/api/chat';
const MODELO = 'qwen2.5:3b';

// Mesmo banco e usuário da aula 02. O agente lê o MySQL direto, sem API no meio.
const banco = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'escola',
  database: 'loja_ia'
});

app.use(express.json()); // para ler o JSON que a página envia
app.use(express.static(path.join(__dirname, 'public'))); // entrega html, css e js

const PROMPT_SISTEMA = `Você é o atendente virtual de uma loja de informática.
Responda sempre em português, de forma curta.
Para qualquer pergunta sobre produtos, clientes ou pedidos, use sempre uma ferramenta antes de responder.
Nunca invente dados: responda apenas com o que as ferramentas devolverem.
Liste todos os itens que a ferramenta devolver, sem pular nenhum.
Se a ferramenta devolver uma lista vazia, diga que a loja não tem.
Se a pergunta não for sobre a loja, diga que só pode ajudar com assuntos da loja.`;

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

// ---------- o laço do agente ----------

//   1. Manda a conversa + lista de ferramentas para o modelo.
//   2. Modelo respondeu texto?  -> acabou, devolve o texto.
//   3. Modelo pediu ferramenta? -> executa, guarda o resultado na
//      conversa com role 'tool' e volta ao passo 1.
// O limite de 5 voltas impede o modelo de ficar pedindo ferramenta
// para sempre (acontece com modelo pequeno).

async function rodarAgente(mensagens) {
  const usadas = []; // nomes das ferramentas usadas, para mostrar na tela

  for (let volta = 0; volta < 5; volta++) {
    const resposta = await fetch(URL_OLLAMA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODELO, messages: mensagens, tools: ferramentas, stream: false, options: { temperature: 0 } })
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


app.post('/chat', async (req, res) => {
  const recebidas = Array.isArray(req.body.mensagens) ? req.body.mensagens : [];
  const conversa = recebidas
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content }));

  if (conversa.length === 0) {
    return res.status(400).json({ erro: 'Envie pelo menos uma mensagem.' });
  }

  const mensagens = [{ role: 'system', content: PROMPT_SISTEMA }, ...conversa];
  res.json(await rodarAgente(mensagens));
});

// Erros (Ollama desligado, MySQL desligado...) chegam aqui
app.use((erro, req, res, next) => {
  console.error(erro.message);
  res.status(500).json({ erro: 'Falha no servidor: ' + erro.message });
});

app.listen(PORTA, () => {
  console.log('Agente no ar: http://localhost:' + PORTA);
});

