# FIT Map — Ciclo 24.3B: verificação da propriedade do e-mail

## Estado

Fundação interna, sem rotas HTTP, sem UI e sem envio real de mensagens.
`users.email_verified_at` permanece nulo para todas as contas ainda não verificadas.
Nenhuma conta existente é marcada automaticamente, e o Login atual permanece funcional.

## Contrato e segurança

1. `issue_email_verification` e `confirm_email_verification` devem receber o ID derivado
   exclusivamente da **identidade autenticada no servidor**, nunca de campo arbitrário do cliente.
2. A verificação exige dois elementos: uma sessão autenticada **e** um código recebido na
   caixa postal da conta. O código não autentica o usuário, nem libera recuperação sozinho.
3. Os códigos de seis dígitos ASCII são produzidos por `secrets`, expiram em 10 minutos,
   têm cinco tentativas e são armazenados somente como HMAC-SHA256 com segredo de propósito
   exclusivo, diferente de JWT e de recuperação de senha.
4. Emissão limitada a uma por 60 segundos e três por hora por conta; novos códigos
   invalidam os anteriores. Emissão e confirmação usam bloqueio de linha do usuário
   para serializar solicitações concorrentes.
5. Cada desafio referencia o usuário **e** o e-mail que possuía na emissão. Se o e-mail
   mudar, o código anterior não valida o novo endereço.
6. Uma confirmação válida define `users.email_verified_at` e inutiliza todos os códigos
   de verificação pendentes. Tentativas inválidas devem ter seu contador confirmado no banco.
7. A geração e a persistência estão separadas da entrega. O código retorna apenas a um
   orquestrador interno confiável. **Não enviar antes de commit durável.** O envio real
   requer política de retries/falhas, observabilidade segura e, preferencialmente, outbox.
8. O segredo opcional `FITMAP_AUTH_EMAIL_VERIFICATION_SECRET` é exigido só ao executar a
   operação e deve ter pelo menos 32 bytes. Não salvar segredo em Git nem no mobile.
9. A validação da recuperação por e-mail continuará exigindo `email_verified_at`.
   Não utilizar esta etapa para alterar a política de acesso das contas antigas.

## Próximos requisitos antes de ativar HTTP

- Provedor real com domínio autenticado e credenciais somente no backend.
- Estratégia segura de persistência/entrega, incluindo tratamento de falhas e retries.
- Fluxo autenticado para solicitar/confirmar a verificação, no backend e mobile.
- Rate limiting de rede/IP, testes concorrentes e proteção contra abuso.
- Mensagens claras para contas antigas sem bloqueá-las automaticamente.

## Verificação local

`ruff check .`, `ruff format --check .`, `pyright`,
`pytest -q tests/test_email_verification.py tests/test_email_verification_email.py` e `pytest`.
