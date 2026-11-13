// Servidor mínimo em Node: entrega os 3 arquivos da página.
// Rodar: node server.js  -> abrir http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORTA = 3000;

// Só estes arquivos são entregues; qualquer outro endereço dá 404.
const arquivos = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/script.js': ['script.js', 'text/javascript; charset=utf-8']
};

http.createServer((req, res) => {
  const arquivo = arquivos[req.url];
  if (!arquivo) {
    res.writeHead(404);
    res.end('Não encontrado');
    return;
  }
  res.writeHead(200, { 'Content-Type': arquivo[1] });
  res.end(fs.readFileSync(path.join(__dirname, arquivo[0])));
}).listen(PORTA, () => {
  console.log('Abra http://localhost:' + PORTA);
});
