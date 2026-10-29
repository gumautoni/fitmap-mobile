# FIT Map — Ciclo 24.3A: contrato para entrega de e-mails

## Estado

Fundação **interna e não ativada**. Nenhuma rota pública, serviço externo, credencial,
variável de ambiente, nova dependência, migração ou mudança no mobile nesta entrega.

## Estrutura

- `notifications/email.py`: mensagem imutável e contrato `EmailTransport` sem implementação de produção.
- `notifications/recovery.py`: composição textual em português e adaptador
  `RecoveryCodeEmailAdapter` compatível com a porta `RecoveryCodeSender` do domínio.
- `tests/test_email_delivery.py`: transporte simulado **somente no código de testes**,
  formatação, códigos inválidos, cabeçalhos, fuso horário, representação sem segredos e falhas.

## Regras de segurança

1. O código secreto aparece **somente no corpo destinado ao e-mail**, nunca em logs,
   respostas HTTP, armazenamento de mensagens ou representações de objetos.
2. O transporte real deve receber credenciais apenas no servidor, por configuração
   externa. Nenhuma credencial deve entrar em Git ou no aplicativo.
3. A implementação do domínio em `issue_recovery_code()` envia antes do commit da
   transação; portanto **não conectar esse adaptador a uma rota pública** enquanto
   não houver persistência durável antes da entrega (por exemplo, outbox transacional).
4. Não presumir que usuários atuais possuam `email_verified_at`: o fluxo de
   verificação de e-mail de novos e antigos usuários será implementado separadamente.
5. Antes de ativar endpoints, exigir proteção contra enumeração, limites por IP e
   identificador, controle de falhas de envio, autenticação do domínio de remetente,
   testes integrados e monitoramento sem dados sensíveis.

## Próximos passos

- **24.3B:** confirmação de propriedade de e-mail, incluindo contas existentes.
- **24.3C:** provedor real de envio, domínio autenticado, segredos externos,
  armazenamento durável/outbox e estratégia de reenvio.
- **24.4:** endpoints públicos e telas mobile, apenas após controles de segurança.

## Validação local

A partir de `backend/`, executar `ruff check .`, `ruff format --check .`,
`pyright`, `pytest -q tests/test_email_delivery.py` e `pytest`.
