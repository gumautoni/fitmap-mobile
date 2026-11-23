# FitMap — Situação da implementação para o TCC

**Referência desta revisão:** `main` em `9f27e5c` (23/11/2026), após o PR #93 de documentação do QA.
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

- As rotas de verificação de e-mail e recuperação de senha estão integradas ao backend
  em `main`. As opções `FITMAP_AUTH_EMAIL_VERIFICATION_ENABLED` e
  `FITMAP_AUTH_PASSWORD_RECOVERY_ENABLED` vêm desativadas. Esses fluxos ficam
  fora da demonstração do aplicativo.
- Fluxo local de tarefas/exercícios do protótipo (telas `Tarefas`, `NovaTarefa`
  e `Camera`, componentes e armazenamento próprios). Removido na limpeza do TCC,
  pois a experiência oficial de treinos e fotos é gerenciada pelo backend.
- O app não implementa troca autenticada de senha, exclusão de conta pelo usuário
  ou foto de avatar; não prometer essas funções na banca.

## Evidências de validação

### 03/11/2026 — antes da limpeza do legado (`748dd83`)

- Backend: **593 testes aprovados**; PostgreSQL de testes isolado.
- Mobile: **199 testes aprovados**, distribuídos em **20 suítes**.
- Ruff, Pyright, TypeScript, ESLint e Prettier: aprovados.
- Alembic: `3a467e3941e2 (head)`.

As 20 suítes incluíam testes do componente legado `CustomButton`, removido posteriormente.

### 23/11/2026 — QA pós-integração da Stack #92 (`881bde7`)

- Mobile: **933 testes aprovados em 56 suítes**.
- Backend: **1.206 testes aprovados** com PostgreSQL exclusivo de testes.
- CI: **32 de 32 verificações obrigatórias aprovadas**, quatro em cada um dos oito PRs da stack.

O PR #93 (`9f27e5c`) documentou a regressão executada em `881bde7`.
Os 133 cenários físicos anteriores permanecem como evidência histórica. A homologação física
complementar ficou pendente, inclusive a cobertura equivalente para Android, TalkBack e
builds nativas. O [relatório de QA](../qa-final-postintegration-2026-11-23.md) detalha
os resultados e as demais limitações. Para a banca, os prints e o vídeo devem identificar
a versão e os percursos efetivamente demonstrados.

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
