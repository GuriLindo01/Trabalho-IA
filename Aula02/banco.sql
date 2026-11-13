-- Aula 02 - Banco de dados da loja (dados fake para testes)
-- Importar no terminal:  sudo mysql < banco.sql
-- Pode importar de novo quando quiser: apaga e recria tudo.

DROP DATABASE IF EXISTS loja_ia;
CREATE DATABASE loja_ia CHARACTER SET utf8mb4;
USE loja_ia;

-- Usuário que a API em Node vai usar para conectar
CREATE USER IF NOT EXISTS 'aluno'@'localhost' IDENTIFIED BY 'aluno123';
GRANT ALL PRIVILEGES ON loja_ia.* TO 'aluno'@'localhost';

CREATE TABLE produtos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  categoria VARCHAR(50) NOT NULL,
  preco DECIMAL(10,2) NOT NULL,
  estoque INT NOT NULL
);

CREATE TABLE clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  cidade VARCHAR(50) NOT NULL
);

CREATE TABLE pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  produto_id INT NOT NULL,
  quantidade INT NOT NULL,
  data_pedido DATE NOT NULL,
  status VARCHAR(20) NOT NULL,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (produto_id) REFERENCES produtos(id)
);

INSERT INTO produtos (nome, categoria, preco, estoque) VALUES
  ('Mouse sem fio',        'Periféricos', 79.90,  25),
  ('Teclado mecânico',     'Periféricos', 249.90, 12),
  ('Headset gamer',        'Áudio',       199.00, 8),
  ('Caixa de som Bluetooth','Áudio',      149.50, 0),
  ('Monitor 24 polegadas', 'Monitores',   899.00, 5),
  ('Webcam Full HD',       'Periféricos', 189.90, 14),
  ('Pen drive 64GB',       'Armazenamento', 39.90, 60),
  ('SSD 480GB',            'Armazenamento', 279.00, 0),
  ('Notebook 15 polegadas','Computadores', 3499.00, 3),
  ('Cadeira gamer',        'Móveis',      1199.00, 2);

INSERT INTO clientes (nome, email, cidade) VALUES
  ('Ana Souza',      'ana.souza@exemplo.com',      'Curitiba'),
  ('Bruno Lima',     'bruno.lima@exemplo.com',     'São Paulo'),
  ('Carla Mendes',   'carla.mendes@exemplo.com',   'Curitiba'),
  ('Diego Rocha',    'diego.rocha@exemplo.com',    'Florianópolis'),
  ('Elisa Martins',  'elisa.martins@exemplo.com',  'Porto Alegre');

INSERT INTO pedidos (cliente_id, produto_id, quantidade, data_pedido, status) VALUES
  (1, 1, 2, '2026-10-02', 'entregue'),
  (1, 5, 1, '2026-10-15', 'entregue'),
  (2, 2, 1, '2026-10-20', 'entregue'),
  (2, 7, 3, '2026-11-01', 'enviado'),
  (3, 9, 1, '2026-11-03', 'enviado'),
  (3, 3, 1, '2026-11-05', 'cancelado'),
  (4, 10, 1, '2026-11-07', 'pendente'),
  (4, 6, 2, '2026-11-08', 'pendente'),
  (5, 1, 1, '2026-11-09', 'pendente'),
  (5, 7, 5, '2026-11-10', 'pendente');
