# Ciclo 24.5C — Teste controlado de uma mensagem Resend

## Implementado

- CLI isolada `python -m fitmap.notifications.delivery_trial`: **somente pré-verificação offline por padrão**. Não consulta banco, não constrói provedor e não abre rede. Retorna somente booleanos e nomes estáticos de verificações manuais; não imprime endereço, remetente ou chave.
- A rotina `send_trial_once` permite, quando **explicitamente habilitada e invocada**, uma única solicitação HTTPS através do transporte Resend existente, sem acesso ao outbox e sem códigos, senhas ou identificadores de conta no texto.
- O modo de envio é restrito a `FITMAP_ENVIRONMENT=staging`, `FITMAP_EMAIL_TRIAL_ENABLED=true`, `FITMAP_EMAIL_PROVIDER=resend`, credencial/remetente válidos e `FITMAP_EMAIL_TRIAL_RECIPIENT` previamente autorizado. **Exige worker desativado e ambos os endpoints públicos de recuperação/verificação desativados.**
- Para enviar, exige todos os parâmetros `--send`, `--to` **idêntico à allowlist**, `--trial-id` UUID (chave de idempotência estável) e `--confirm-send SEND_ONE_TEST_EMAIL`. Não faz retentativas automáticas nem grava dados no banco.
- O retorno `provider_accepted=true` indica que o Resend aceitou a requisição. **Não comprova entrega**, nem leitura, nem posicionamento na caixa de entrada.
- Não existe inicialização em FastAPI, cron, workflow CI, automação ou chamada deste comando nos scripts de teste/instalação.

## Comando seguro (sem envio)

```powershell
cd C:\dev\fitmap-current\backend
.\.venv\Scripts\python.exe -m fitmap.notifications.delivery_trial
```

No ambiente atual (development, provedor desativado), o retorno `configuration_valid: false` é **esperado**. O código de saída `1` indica falta de requisitos, não um erro do projeto.

## Checklist antes do primeiro envio real (etapa operacional posterior)

1. Criar/verificar domínio de **envio** no painel Resend e revisar SPF, DKIM e DMARC. Verificação parcial de recebimento não basta.
2. Criar chave exclusiva com **Sending access** restrito ao domínio; armazenar fora do Git, do celular e dos logs. Revogar/rotacionar quando necessário.
3. Confirmar posse e consentimento para a caixa de teste, separada de contas de usuários. Não usar códigos reais.
4. Usar ambiente staging isolado, habilitar apenas as duas configurações de trial em segredo no servidor, manter worker e endpoints públicos desligados.
5. Após autorização explícita, executar um único teste. Conferir eventos no painel Resend e a chegada efetiva na caixa de entrada (incluindo spam/quarentena). Não confundir aceitação API com entrega.
6. Desligar `FITMAP_EMAIL_TRIAL_ENABLED` após o teste e registrar apenas resultado/tempo em documentação sem destinatário ou credencial.

**Não execute o envio nesta etapa 24.5C automaticamente.** O objetivo desta entrega é preparar e testar offline o mecanismo, não provisionar credenciais ou verificar um domínio que ainda não foi apresentado.

## Referências

- Resend — domain verification events: https://resend.com/changelog/domain-verification-events
- Resend — sending access API keys: https://resend.com/changelog/new-api-key-permissions
- Resend — idempotency keys: https://resend.com/changelog/idempotency-keys
- Resend — delivery status: https://resend.com/guides/email/users-never-got-login-code
