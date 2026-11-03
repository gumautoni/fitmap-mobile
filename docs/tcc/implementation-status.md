# FitMap — Situação da implementação para o TCC

**Base auditada:** branch `main`, commit `748dd83` (03/11/2026), antes da limpeza de legado.
**Objetivo:** diferenciar código implementado, validação automatizada e validação prática pendente.

## Comportamentos presentes na branch principal

- Cadastro, login, renovação de tokens, logout e política de senha.
- Perfil autenticado, preferências de treino e configuração de objetivos gerais.
- Busca e detalhes de academias, mapa, favoritos, avaliações e comentários.
- Catálogo de exercícios, planejamento, execução e histórico de treinos.
- Estatísticas de treino, histórico de desempenho, fotos privadas de progresso,
  registros de métricas corporais e metas fitness.
- Backend FastAPI, PostgreSQL, Alembic, serviços de mídia e testes automatizados.

Esses itens foram encontrados no código e/ou na suíte automatizada; **cada percurso
mobile integrado deve ser comprovado na validação manual antes da apresentação**.

## Fora do escopo da apresentação

- Verificação de propriedade do e-mail e recuperação de senha por mensagem.
  O desenvolvimento experimental foi preservado na branch separada
  `feat/auth-account-recovery-ciclo24` e não será incorporado à `main` do TCC.
- Fluxo local de tarefas/exercícios do protótipo (telas `Tarefas`, `NovaTarefa`
  e `Camera`, componentes e armazenamento próprios). Removido na limpeza do TCC,
  pois a experiência oficial de treinos e fotos é gerenciada pelo backend.
- O app não implementa troca autenticada de senha, exclusão de conta pelo usuário
  ou foto de avatar; não prometer essas funções na banca.

## Evidências de validação

No checkpoint `748dd83`, antes da limpeza:

- Backend: **593 testes aprovados**; PostgreSQL de testes isolado.
- Mobile: **199 testes aprovados**, distribuídos em **20 suítes**.
- Ruff, Pyright, TypeScript, ESLint e Prettier: aprovados.
- Alembic: `3a467e3941e2 (head)`.

Após remover os testes exclusivos do componente legado `CustomButton`, o total de
Jest será menor. Isso **não é regressão** desde que a suíte restante, as validações
de tipo/lint/formatação e os fluxos reais continuem passando.

## Pendências antes de encerrar o TCC

1. Confirmar funcionamento integrado no celular: cadastro, login, mapa, favoritos,
   avaliações, treinos, execução, histórico, metas, métricas e fotos privadas.
2. Conferir configurações de desenvolvimento: acesso do celular ao backend,
   PostgreSQL e mídia S3 mock, sem expor credenciais no aplicativo.
3. Revisar UI e UX tela a tela, preservando funcionalidade testada; priorizar
   correções observáveis em vez de criar novos recursos.
4. Confrontar requisitos, documentação acadêmica e capturas de tela com
   a versão efetivamente demonstrada.
5. Ensaiar a apresentação e perguntas da banca sobre arquitetura, segurança,
   persistência, testes, limitações e melhorias futuras.

**Regra:** funcionalidade não validada no dispositivo não será descrita como
comprovadamente funcional na demonstração.
