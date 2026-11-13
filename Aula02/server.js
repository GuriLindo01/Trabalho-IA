
const express = require('express');
const mysql = require('mysql2/promise'); 

const app = express();
const PORTA = 3002; 


const banco = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'escola',
  database: 'loja_ia'
});

app.get('/', (req, res) => {
  res.json({
    mensagem: 'API da loja no ar',
    rotas: ['/produtos', '/produtos/1', '/produtos?categoria=Áudio', '/clientes', '/pedidos']
  });
});


app.get('/produtos', async (req, res) => {
  const categoria = req.query.categoria;
  if (categoria) {
    const [linhas] = await banco.query('SELECT * FROM produtos WHERE categoria = ?', [categoria]);
    return res.json(linhas);
  }
  const [linhas] = await banco.query('SELECT * FROM produtos');
  res.json(linhas);
});

app.get('/produtos/:id', async (req, res) => {
  const [linhas] = await banco.query('SELECT * FROM produtos WHERE id = ?', [req.params.id]);
  if (linhas.length === 0) {
    return res.status(404).json({ erro: 'Produto não encontrado' });
  }
  res.json(linhas[0]);
});

// Lista clientes
app.get('/clientes', async (req, res) => {
  const [linhas] = await banco.query('SELECT * FROM clientes');
  res.json(linhas);
});


app.get('/pedidos', async (req, res) => {
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
    ORDER BY pedidos.id
  `);
  res.json(linhas);
});


app.use((erro, req, res, next) => {
  console.error(erro.message);
  res.status(500).json({ erro: 'Falha no servidor: ' + erro.message });
});

app.listen(PORTA, () => {
  console.log('API no ar: http://localhost:' + PORTA);
});

