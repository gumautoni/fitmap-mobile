# Ciclo 24.5B — Auditoria offline do envio e semântica de retentativas

## Escopo implementado

- Adicionar `python -m fitmap.notifications.worker --preflight`: confere somente configuração local, sem abrir conexão PostgreSQL, sem instanciar transporte Resend, sem chamadas HTTP, sem ler/descriptografar o outbox e sem alterar nenhuma flag.
- Relatório JSON com verificações booleanas e nomes estáticos de pendências operacionais. Nunca imprime chaves, domínio/remetente, usuário, PIN, identificador de mensagem ou payload.
- `configuration_valid=true` significa **somente** que as verificações de software/configuração passaram. **Não significa domínio verificado, entrega comprovada, serviço pronto nem autorização de produção**. Essas condições externas permanecem em `manual_verification_required`.
- Resultado de CLI: saída `0` para configuração conforme; `1` para configuração incompleta; `2` para combinação inválida de argumentos. A combinação de `--preflight` com `--execute` ou `--confirm-send` é rejeitada antes de carregar Settings.
- A CLI existente sem argumentos permanece no modo de inspeção do outbox, somente leitura. A execução real continua exigindo as travas da etapa 24.5A e continua **desativada por padrão**.
- Resend `HTTP 409`: a resposta com código `invalid_idempotent_request` é irrepetível (mesma chave, payload divergente); `concurrent_idempotent_requests` pode ser repetida com **mesmo payload e mesma chave**. Respostas `409` desconhecidas mantêm o comportamento anterior (retryable), sempre limitado pelo dispatcher. O corpo de erro é inspecionado em memória por no máximo 4096 bytes e nunca é registrado.

## Verificações externas obrigatórias antes de qualquer envio real

1. Configurar domínio de envio em Resend e confirmar explicitamente **capacidade de envio verificada** (não apenas recebimento). Revisar os registros DNS solicitados (SPF, DKIM; DMARC recomendado); verificar a propagação no painel.
2. Criar credencial Resend exclusiva para o ambiente, aplicar acesso mínimo quando disponível, definir armazenamento protegido e processo de rotação; não registrar em Git, log, imagem Docker ou aplicativo móvel.
3. Definir remetente de segurança, política de bounces/complaints, observabilidade de falhas, destinatário controlado para teste e validação de aceitação **e** chegada real na caixa de entrada.
4. Provisionar job externo isolado, sem executar no startup da FastAPI, com agendamento/limite e alertas para mensagens falhas, pendentes e expiradas. Avaliar necessidade de rate limiting externo e fila entre ambientes.
5. Auditar configuração de proxy confiável e diferenças temporais no endpoint público de recuperação, políticas de retenção e resposta a incidentes. Sem essas evidências, **não habilitar** as flags de HTTP nem de worker.

## Comando seguro de pré-verificação

No terminal do VS Code, a partir de `backend`:

```powershell
.\.venv\Scripts\python.exe -m fitmap.notifications.worker --preflight
```

Saída possível em ambiente de desenvolvimento: `configuration_valid: false`, com `worker_enabled: false` e `approved_environment: false`. Isso **é esperado** e demonstra que as proteções continuam ativas. A pré-verificação não envia e-mail.

## Referências operacionais

- [Resend — verificações de domínio](https://resend.com/changelog/domain-verification-events)
- [Resend — chaves de idempotência e respostas 409](https://resend.com/changelog/idempotency-keys)
- [Resend — limites de requisições e Retry-After](https://resend.com/changelog/api-rate-limit)

## Pendências para 24.5C

- Evidências de remetente verificado, destinatário de teste e credenciais provisionadas fora do repositório.
- Auditoria de cron/job, métricas e alertas operacionais, ensaio de falha e revisão das diferenças temporais dos endpoints públicos.
- Teste de entrega controlado apenas após autorização explícita. Este ciclo não executa chamadas reais de envio.
