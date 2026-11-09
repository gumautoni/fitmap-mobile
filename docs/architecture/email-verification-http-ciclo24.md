# Ciclo 24.4B — Verificação de e-mail via API

- Rotas `POST /api/v1/auth/email-verification/request` e `/confirm`, **ambas autenticadas com access token e sessão ativa**.
- `FITMAP_AUTH_EMAIL_VERIFICATION_ENABLED=false` por padrão: não ativa serviço de e-mail; clientes recebem `503` se tentar utilizar antes da operação estar pronta.
- Habilitação exige segredos independentes de HMAC e Fernet. Fora de testes também exige configuração explícita do provedor Resend. **O despachante não inicia automaticamente**; antes de ativar em qualquer ambiente real é necessário configurar e operar seu executor separado, domínio de envio verificado, segredos e observabilidade.
- Não há `user_id` nem e-mail nos payloads; a identidade vem exclusivamente do access token validado e da sessão persistida.
- Origem de rede deriva de `request.client.host` (peer ASGI); ignora `X-Forwarded-For`. Quando houver proxy reverso, validar topologia e confiança em cabeçalhos no servidor/proxy, nunca diretamente na aplicação.
- Limites persistentes por IP e UUID usam o serviço do Ciclo 24.4A; suas atualizações são **confirmadas mesmo quando o limite retorna 429**. Não são aplicados limites apenas em memória.
- `request` responde sempre `202 {"status":"accepted"}` quando há tentativa permitida por limite, inclusive para cooldown e e-mail já verificado. Não informa nem retorna códigos, e a emissão/outbox é transacional.
- `confirm` aceita somente seis dígitos ASCII. Comparação e contador de tentativas são persistidos mesmo diante de `400 invalid_verification_code`. Sucesso retorna `200 {"status":"verified"}` ou `already_verified`.
- Não existe chamada de rede, envio de código, inicialização de worker ou alteração da `main` nesta entrega.
- Testes HTTP usam apenas segredos efêmeros e configuração `environment=test`, com limpeza dirigida de usuários e contadores gerados pelo caso.
- Ainda faltam ativação operacional do provedor/dispatcher e fluxo mobile de interface, a serem tratados em etapas posteriores.
