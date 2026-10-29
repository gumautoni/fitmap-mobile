# FIT Map — Ciclo 24.3C.2A: outbox transacional criptografado

## Estado

**Apenas fundação interna, sem worker ou endpoints e sem envio real.**
A configuração de e-mail continua desativada. Esta entrega prepara o armazenamento durável para a próxima integração; não conectar ainda nenhum fluxo à API pública.

## Decisão

- `EmailOutboxMessage` grava **somente um payload criptografado e autenticado (Fernet)**, mais metadados de finalidade, prazo, tentativas, estado e chave de idempotência estável.
- O remetente interno deverá persistir o desafio (código apenas HMAC) e chamar `enqueue_outbox_email()` **na mesma transação PostgreSQL** antes de fazer commit. Rollback elimina ambos. O código não deve ser transmitido antes do commit.
- Para criar a mensagem, usar os adaptadores já existentes `build_email_verification_message` e `build_recovery_email`. Não usar o fluxo `issue_recovery_code()` atual para envio real: ele ainda invoca o sender antes de commit e será refatorado.
- A cifra exige `FITMAP_EMAIL_OUTBOX_ENCRYPTION_KEY`: **Fernet key** independente dos segredos de JWT, recuperação e verificação. Gerar localmente: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. Guardar SOMENTE no ambiente do servidor (nunca no Git).
- A cifra é autenticada: chave incorreta ou payload alterado falham sem expor conteúdo. `key_version=1` é reservado para migração/rotação futura. A perda da chave impede a decifragem de mensagens pendentes.
- Apenas o dispatcher confiável poderá decifrar mensagens, imediatamente antes do envio, e **sempre depois do commit**. A mensagem não é enviada automaticamente nesta entrega.
- A chave de idempotência é fixa por linha. O dispatcher futuro deve passá-la ao Resend sem alterar a cada tentativa. O worker futuro deve usar locks/leasing, limites de tentativas, expiração, falhas categorizadas e descartar o ciphertext após entrega/expiração.
- O `outbox` não armazena códigos em plaintext nem mensagens serializadas legíveis. A própria aplicação/depuradores que possuem a chave podem decifrar; limitar o acesso ao banco, chaves e logs.

## Pendências antes de abrir HTTP

1. Despacho seguro com lock/leasing, idempotência Resend, retry curto que respeite expiração e limpeza do payload.
2. Refatorar `issue_recovery_code()` para enfileirar com o desafio na mesma transação, sem envio direto.
3. Integrar `issue_email_verification()` com enqueue e commit, sem retornar secrets a HTTP.
4. Rate limiting por IP e e-mail, respostas anti-enumeração, integração mobile e testes de falha/concorrrência.
5. Regras de rotação da chave, observabilidade sanitizada, políticas de retenção e revogação de filas obsoletas.

## Dependências

Adicionar `cryptography>=46,<47` no pyproject e atualizar `uv.lock` com `uv lock` / `uv sync` na máquina de desenvolvimento, usando o índice de pacotes confiável.
