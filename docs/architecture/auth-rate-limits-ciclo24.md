# FIT Map — Ciclo 24.4A: limite compartilhado para operações sensíveis

## Estado

**Fundação interna — nenhum endpoint novo, nenhum envio ou worker ativado.**
O login e o cadastro existentes não sofrem alterações. O módulo será ligado às
rotas de verificação e recuperação em uma etapa posterior.

## Arquitetura e decisões

- Contadores de janela fixa gravados no PostgreSQL usando `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`; a atualização atômica resiste a múltiplos processos e à corrida do primeiro registro.
- Por ação, consumo de **dois** limites, sempre na mesma ordem: origem de rede e identificador. Ambos são contabilizados inclusive em casos bloqueados.
- Solicitar recuperação: até 8 chamadas por IP em 15 minutos e 3 por e-mail em 1 hora.
- Confirmar recuperação: 20 por IP em 15 minutos e 5 por e-mail em 15 minutos.
- Solicitar verificação: 8 por IP em 15 minutos e 3 por usuário autenticado em 1 hora.
- Confirmar verificação: 20 por IP em 15 minutos e 5 por usuário autenticado em 15 minutos.
- Identificadores são protegidos por **HMAC-SHA256 com chave exclusiva** (`FITMAP_AUTH_RATE_LIMIT_SECRET`, mínimo 32 bytes). A tabela não contém e-mail, IP ou UUID legível. Há separação de domínio por ação e categoria.
- O segredo precisa ser exclusivo, distinto dos usados para JWT, códigos de recuperação, verificação e Fernet.
- Contadores são limitados a `máximo+1`; expiração reinicia a janela. Limpeza opcional após mais de 24 horas sem uso.

## Contrato para os próximos endpoints (obrigatório)

1. Derivar o IP do par direto ASGI **somente se for confiável**. Não aceitar `X-Forwarded-For`, `Forwarded` ou similares enviados pelo cliente. Em produção atrás de proxy, configurar lista de proxies confiáveis e borda/reverse proxy adequadamente.
2. Para verificação, obter UUID do servidor após autenticação; nunca do JSON enviado pelo app. Recuperação usa o e-mail informado inclusive quando a conta não existe.
3. Confirmar a transação de contagem **inclusive na negação**. Um rollback em 429 apaga o limite; falhas de banco devem impedir a operação sensível, não liberá-la.
4. O serviço não substitui throttling da borda, controles contra ataques distribuídos, quota do provedor de e-mail, monitoramento ou respostas públicas uniformes.
5. Não retornar se o endereço existe, se está verificado ou se recebeu mensagem. Evitar diferenças perceptíveis de tempo em solicitações válidas e inválidas.
6. Revisar limites após testes de uso real, NAT e acessibilidade; limites rígidos por IP podem afetar usuários legítimos da mesma rede.
7. Não registrar identificadores nem valores de segredo em logs, exceções, métricas ou respostas HTTP.

## Aplicação e validação

Adicionar `fitmap.security.rate_limit_models` ao `backend/alembic/env.py`,
adicionar a chave opcional ao `Settings`, atualizar `.env.example`, e executar
`ruff check .`, `ruff format --check .`, `pyright`,
`alembic heads`, `pytest -q tests/test_auth_rate_limits.py` e `pytest -q`.
Apenas o PostgreSQL do ambiente de teste recebe automaticamente a migração via pytest.

## Referências

- OWASP Forgot Password Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- OWASP API4:2023: https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/
