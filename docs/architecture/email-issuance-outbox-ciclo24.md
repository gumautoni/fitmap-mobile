# FIT Map — Ciclo 24.3C.2C: emissão transacional dos códigos

## Estado

**Camada interna, desativada em HTTP/mobile e sem envio automático.**
Nenhum cadastro, login ou token atual é modificado. O dispatcher é separado.

## Operações

- `queue_email_verification(db_session, authenticated_user_id, settings, now)`
  usa o domínio atual para gerar um desafio e enfileira a mensagem criptografada
  no **mesmo banco e na mesma transação**. O ID deve vir da sessão autenticada.
- `queue_password_recovery(db_session, user_id, settings, now)` reutiliza o
  domínio de recuperação com um `RecoveryCodeSender` que **nunca envia por rede**:
  ele apenas compõe a mensagem e a salva cifrada no outbox. Assim, não existe
  envio físico antes do commit, apesar do nome legado `IssueStatus.SENT`.
- As duas operações retornam somente `queued`, `ineligible` ou `rate_limited`;
  nunca retornam códigos secretos. Uma tentativa elegível só fica disponível
  para o dispatcher quando o **chamador confirma a transação**.
- Cada execução usa um `SAVEPOINT` para cancelar a criação do desafio e a
  invalidação de códigos anteriores se falhar a encriptação/enfileiramento.
  O `SAVEPOINT` **não substitui o commit da transação externa**.

## Restrições de segurança antes de ligar HTTP

1. Não usar `issue_recovery_code()` com transporte real. O chamador futuro
   deve usar `queue_password_recovery()` e confirmar o commit antes de executar
   o dispatcher. O emissor original permanece por compatibilidade dos testes.
2. Solicitação de verificação: usuário derivado apenas de sessão autenticada.
   Recuperação: resolver internamente a conta sem expor se ela existe/é elegível.
3. Falta: controle IP/rede e identificador, proteção contra enumeração,
   configuração do provedor e de segredos exclusivamente no servidor,
   operacionalização do worker, e testes concorrentes e de ponta a ponta.
4. Não iniciar envio automático sem revisão do gerenciamento dos segredos,
   expiração, retry e retenção do outbox.

## Validação local

`ruff check .`, `ruff format --check .`, `pyright`,
`pytest -q tests/test_email_issuance_outbox.py` e `pytest -q`.
