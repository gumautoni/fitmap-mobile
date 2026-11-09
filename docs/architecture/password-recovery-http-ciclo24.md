# Ciclo 24.4C — API de recuperação de senha

## Contrato

- `POST /api/v1/auth/password-recovery/request` (`{ "email": "..." }`): responde sempre `202 {"status":"accepted"}` para solicitações sintaticamente válidas quando a funcionalidade está habilitada, independentemente de a conta existir, estar ativa, ter e-mail confirmado, estar em cooldown ou exceder os limites. Nenhuma credencial ou código aparece na resposta.
- `POST /api/v1/auth/password-recovery/reset` (`{ "email", "code", "password", "confirm_password" }`): retorna `200 {"status":"reset"}` em caso de redefinição, `400 invalid_recovery_code` para prova inválida/expirada/ausente e `429 auth_rate_limited` após exceder os limites compartilhados. Pydantic rejeita entrada malformada com `422`.
- Os códigos são associados à conta, armazenados apenas como HMAC, expiram após dez minutos e toleram no máximo cinco tentativas. Emissão e outbox Fernet são atômicos. A redefinição revoga sessões de autenticação e tokens de atualização; não cria sessão automática.
- Todos os limites são persistentes em PostgreSQL e usam hashes HMAC de IP/identificador. A decisão de limitar é persistida mesmo quando a solicitação não prossegue. O IP deriva apenas do peer ASGI validado; a API não interpreta diretamente `X-Forwarded-For` ou `X-Real-IP`.

## Habilitação e limitações operacionais

- `FITMAP_AUTH_PASSWORD_RECOVERY_ENABLED=false` é o padrão. Com o recurso desligado, ambas as rotas respondem `503 password_recovery_unavailable`.
- Para testes automatizados, o recurso é explicitamente habilitado com segredos temporários separados e outbox criptografado; não há comunicação com provedor real.
- Fora do ambiente `test`, a habilitação exige os segredos independentes de recuperação, rate limit e Fernet, além de provedor Resend configurado. **Esses requisitos são necessários, mas não suficientes para operar em produção**: o despachante permanece manual/sem scheduler; somente habilitar o flag não ativa entrega. É necessário configurar domínio remetente verificado, provedor, job externo seguro para o dispatcher, monitoramento e teste real de envio antes da ativação.
- Respostas HTTP genéricas reduzem enumeração de contas, mas diferenças de tempo entre caminhos com e sem banco/outbox podem continuar observáveis; uma revisão de timing, política de proxy confiável, alertas operacionais e auditoria de produção são etapas futuras.
- Não armazenar segredos reais em Git, não habilitar estas flags no `.env` apenas para testar a API e não rodar o dispatcher no startup da aplicação.
