# Ciclo 24.5A — Processamento manual do outbox

## Comportamento

- `python -m fitmap.notifications.worker` **apenas consulta as contagens por estado** (`pending`, `processing`, `accepted`, `failed`, `expired`). Não faz commit, não descriptografa conteúdos, não envia mensagens e não retorna destinatários, códigos ou IDs.
- A função `dispatch_email_batch` reutiliza o dispatcher PostgreSQL existente com *lease*, `FOR UPDATE SKIP LOCKED`, limite de tentativas, prazos de repetição, revalidação do desafio e idempotência. Recebe um transporte por injeção; os testes usam um emissor simulado, sem HTTP externo.
- Cada execução termina após até **25 tentativas**, sem scheduler, startup hook, background task, loop contínuo ou chamada automática do FastAPI. Resultados divulgados são apenas contagens. Retentativas dependem de uma nova execução e respeitam os prazos persistidos.
- Mensagens vencidas ou com desafio invalidado não são enviadas; a própria operação existente limpa o conteúdo cifrado quando conclui/falha/expira. O relatório de inspeção não realiza essa limpeza.

## Travas de envio real

- O envio real **não está habilitado neste ciclo**. `FITMAP_EMAIL_WORKER_ENABLED=false` é o valor padrão; não mudar apenas para testar.
- O modo de execução exige simultaneamente `--execute`, `--confirm-send SEND_REAL_EMAILS`, `FITMAP_EMAIL_WORKER_ENABLED=true`, ambiente `staging` ou `production`, provedor Resend, remetente e credenciais do servidor, segredos distintos para JWT, recuperação, verificação e Fernet, e validade da chave Fernet. A configuração é validada antes de abrir sessões ou construir o transporte.
- **Não executar `--execute` no computador de desenvolvimento ou produção sem** domínio remetente verificado, revisão de permissões e proxy, job externo isolado, monitoração, estratégia para reprocessar falhas e teste controlado de entrega. A configuração não comprova entrega à caixa de entrada; `ACCEPTED` significa aceitação pelo provedor.
- Não registrar dados pessoais, tokens, códigos, payload cifrado ou credenciais; não registrar `.env` no Git; não ativar o worker no startup HTTP.

## Como validar na máquina de desenvolvimento

No diretório `backend`, com PostgreSQL local iniciado e `.env` devidamente configurado:

```powershell
.\.venv\Scripts\python.exe -m fitmap.notifications.worker
```

Saída: JSON contendo somente números de mensagens por estado. Esse comando é somente leitura. Os testes automatizados exercitam o envio com transporte falso, não exigem chave real de Resend e não enviam e-mails.

## Pendências futuras (24.5B)

- Provisionar, verificar e proteger remetente real e credenciais Resend.
- Avaliar execução externa com segurança operacional (locks, alertas, métricas, tratamento de interrupção), retenção de dados e política de logs.
- Validar entrega fim a fim em ambiente isolado e somente depois habilitar as flags necessárias.
- Revisar diferenças temporais que possam permitir enumeração na API pública.
