# FIT Map — Ciclo 24.3C (parte 1): transporte HTTPS Resend

## Estado

**Implementação disponível, mas DESATIVADA.** Nenhum endpoint público, trabalho em segundo plano, cadastro, login ou tela mobile foi modificado. O transporte `ResendEmailTransport` não é instanciado automaticamente pela aplicação. Sem um remetente e uma chave privados, não há envio real.

## Contrato

- `fitmap.notifications.resend.ResendEmailTransport` implementa o contrato `EmailTransport` existente, usando a API HTTPS `POST https://api.resend.com/emails` com autenticação Bearer e corpo JSON `from`, `to`, `subject`, `text`.
- O transporte tem prazo de 5 segundos por padrão, limite configurável entre 1 e 15 segundos e **nenhum retry automático**.
- Erros geram `EmailDeliveryError` com indicação `retryable`, sem incluir mensagem, PIN, e-mail, chave API nem corpo da resposta do provedor.
- Respostas 2xx só são aceitas quando o Resend fornece um identificador não vazio da mensagem; isso atesta aceitação pela API, **não entrega na caixa postal**.
- API Key e remetente são lidos exclusivamente do backend por variáveis de ambiente, nunca salvos em Git ou no código mobile.
- O adaptador `RecoveryCodeEmailAdapter` e `EmailVerificationAdapter` são compatíveis com o transporte; a composição continua isolada e testável.

## Configuração futura (somente servidor)

- `FITMAP_EMAIL_PROVIDER=disabled` por padrão; habilitar `resend` somente após concluir outbox, verificação da propriedade de e-mail e proteção de endpoints.
- `FITMAP_RESEND_API_KEY`: credencial Resend criada e armazenada no ambiente seguro de execução, sem incluir em arquivos versionados.
- `FITMAP_EMAIL_FROM_ADDRESS`: endereço remetente pertencente a domínio autenticado no provedor, por exemplo `nao-responda@SEU-DOMINIO-VERIFICADO`.
- `FITMAP_EMAIL_TIMEOUT_SECONDS=5.0`.

## Segurança e pendências obrigatórias antes de ativar

1. A emissão interna de recuperação hoje chama `sender.send_recovery_code` **antes do commit**; não a conecte diretamente ao Resend. Deve ser reformulada para persistir antes do envio.
2. A emissão de verificação retorna o PIN ao orquestrador interno antes do commit. O próximo desenho deve criar um **outbox durável**, com payload protegido, despacho apenas após commit e limpeza de segredos após sucesso/expiração.
3. Retry requer **mesma chave de idempotência** para a mesma mensagem (o Resend suporta `Idempotency-Key`); o transporte atual não faz retry nem configura essa chave. Fazer isso como parte do outbox, não gerando outra chave a cada tentativa.
4. Sem verificação de domínio, serviço de e-mail não pode ser testado em caixas reais. A conta do provedor é configurada fora do projeto e os segredos nunca devem entrar em logs, issues ou screenshots.
5. Antes de abrir endpoints, implementar throttling IP/rede e conta, anti-enumeração, controle de falhas, testes HTTP/mobile e monitoramento sem PII.

## Testes

`pytest -q tests/test_resend_delivery.py` testa de forma isolada o transporte com HTTP simulado: nenhuma rede ou chave de produção é utilizada. Depois execute Ruff, Pyright e a suíte completa do backend.

## Referências

- Resend Email API: https://resend.com/docs/api-reference/emails/send-email
- Resend — Idempotency keys: https://resend.com/changelog/idempotency-keys
