-- Aula 04 - Tabela de memória do agente
-- Importar no terminal (não precisa de sudo, usa o usuário da aula 02):
--   mysql -u aluno -paluno123 loja_ia < memoria.sql
-- Pode importar de novo: apaga as conversas salvas e recria a tabela.

DROP TABLE IF EXISTS mensagens;

CREATE TABLE mensagens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversa VARCHAR(36) NOT NULL,        -- identifica de qual conversa é a mensagem
  role VARCHAR(10) NOT NULL,            -- 'user' ou 'assistant'
  content TEXT NOT NULL,                -- o texto da mensagem
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (conversa)
);
