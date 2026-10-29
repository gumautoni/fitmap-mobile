# FIT Map — Ciclo 24.3C.2B: dispatcher com leasing e idempotência

## Estado

**Módulo interno, invocação explícita, sem agendador, sem endpoint e sem envio real habilitado.** A aplicação não instancia o transporte nem cria workers automaticamente. Nenhuma alteração em login, mobile ou fluxo público nesta entrega.

## Contrato

1. A transação que cria desafio e mensagem cifrada **deve ser confirmada antes** de qualquer execução do dispatcher. A função `dispatch_one_email` consome apenas linhas já gravadas.
2. O dispatcher seleciona uma mensagem elegível com `FOR UPDATE SKIP LOCKED`, reserva um `lease_token` de 45 segundos, incrementa tentativa e **confirma a transação antes de chamar o transporte**. Reivindicações duplicadas só ocorrem após vencer o lease.
3. O transporte Resend admite `idempotency_key` opcional; o dispatcher a fornece sempre, sem mudar mensagem, remetente ou chave entre tentativas. O Resend retém chaves de idempotência por 24 horas; nossa janela de códigos é de 10 minutos.
4. As tentativas de retry são limitadas a três no total, com intervalos de 15 e 60 segundos, **somente** se ainda houver tempo antes da expiração. Erros sem retry passam imediatamente a `failed`.
5. Antes do envio, o worker confere se usuário, endereço e código do desafio atual ainda são válidos; quando obsoletos, as mensagens são descartadas.
6. Quando aceita, inválida, esgotada ou expirada, a mensagem perde o payload cifrado (`encrypted_payload=b""`). O estado e os metadados técnicos são mantidos, sem PII em logs.
7. A conclusão de processamento só atualiza registros quando `lease_token` e status ainda correspondem à reserva; jobs antigos não podem sobrescrever novas reivindicações. Nunca manter transação aberta ao chamar o Resend.
8. Resultados 2xx da API indicam **aceitação pelo Resend, não entrega final** na caixa postal.
9. Um erro não previsto no transporte deixa o registro com `processing` até expirar o lease, quando uma nova invocação explícita pode tentar novamente. A idempotência mitiga respostas perdidas.

## Operação e limitações

- O módulo ainda não contém loop de polling, CLI, container, orquestração de recuperação, cron ou job automático. Nenhum processo do FIT Map irá enviá-lo até que isso seja implementado e habilitado conscientemente.
- Um worker de produção precisará de monitoramento sanitizado, limites de capacidade, gestão de credenciais, testes de concorrência com múltiplos processos, rotação de chave, política de retenção dos metadados e desligamento gracioso.
- O fluxo atual `issue_recovery_code` ainda envia antes do commit; **não o ligar ao transporte real**. A integração com outbox deve substituir esse ponto.
- A validação de código após o claim reduz envio de códigos obsoletos, mas ainda existe uma janela de concorrência até o provedor receber a solicitação. O backend sempre valida a expiração e o consumo antes de aceitar um código.
- Não abrir endpoints públicos sem proteção de abuso por IP/rede, anti-enumeração, UI e testes de ponta a ponta.

## Testes e validação

`pytest -q tests/test_email_dispatcher.py tests/test_resend_idempotency.py`, depois Ruff, Pyright, Alembic e `pytest -q`.

Referência Resend: https://resend.com/changelog/idempotency-keys
