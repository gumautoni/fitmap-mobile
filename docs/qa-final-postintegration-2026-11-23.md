# FIT Map — QA-FINAL pós-integração

Data do checkpoint: **23/11/2026**.

## 1. Objetivo e escopo

Registrar as evidências técnicas da integração da Stack #92
e da regressão automatizada executada na branch `main`.

Este documento não substitui os históricos de testes,
as decisões de arquitetura ou as evidências dos PRs.

## 2. Integração Git

- Repositório: `gumautoni/fitmap-mobile`.
- Stack nativa GitHub: **#92**.
- Base anterior da `main`: `d5c557652249ce68693050ecfc62938728cfb4f1`.
- HEAD aprovado da QUALITY-01: `601b8ec9fa290f58ce5203500b6ad0edb6112bae`.
- HEAD final da `main`: `881bde7d9fce99a4d2788d4de3446be2d4b60044`.
- Método de integração: Squash merge, sem bypass de regras.
- Resultado: oito PRs integrados e oito novos commits.
- Árvore Git final: `34a18f8e0a82aa2551d1deb69d00e56d368b21dd`.

A árvore do commit final da `main` foi comparada com a
árvore da QUALITY-01 aprovada. Os hashes coincidiram.

| PR | Entrega | Commit integrado |
| --- | --- | --- |
| #83 | Acessibilidade de formulários de treino | `2be5d9e` |
| #85 | Acessibilidade da gestão e execução de treinos | `0bd51fd` |
| #86 | Acessibilidade de academias, mapa e avaliações | `b32880f` |
| #87 | Acessibilidade de conta e progresso | `1933069` |
| #88 | Consolidação transversal de acessibilidade | `17a4c2f` |
| #89 | Limpeza técnica | `c6fc876` |
| #90 | Consolidação TypeScript | `198c8f0` |
| #91 | Qualidade e documentação de segurança | `881bde7` |

Referência: https://github.com/gumautoni/fitmap-mobile/pulls

## 3. GitHub Actions e proteções

Os oito PRs foram avaliados individualmente pelos quatro
checks obrigatórios configurados para a branch `main`:

- Mobile validation.
- Backend validation.
- Backend container validation.
- Secret scanning.

**Resultado: 32/32 checks aprovados.**

As regras de proteção exigiam checks atualizados e
histórico linear. Não houve alteração ou dispensa dessas
regras durante a integração.

## 4. Regressão local pós-integração

### 4.1. Mobile

Execução local na `main` consolidada:

| Verificação | Resultado |
| --- | --- |
| Node.js | `v22.23.4` |
| npm | `10.9.9` |
| Dependências (`npm ls --depth=0`) | Aprovado |
| Prettier (`npm run format:check`) | Aprovado |
| TypeScript (`npm run typecheck`) | Aprovado |
| ESLint (`npm run lint`) | Aprovado |
| Jest completo | **933/933 testes** |
| Suítes Jest | **56/56** |

A execução mobile não modificou os arquivos versionados.

### 4.2. Backend

As verificações de dependências, lockfile, Ruff lint
e Ruff format foram aprovadas no ambiente local.

A primeira execução direta do Pyright apresentou erros
de resolução de imports. A repetição com
`uv run --no-sync --frozen pyright --outputjson`
confirmou **zero erros, zero avisos e zero informações**,
sem alterações no código ou nas dependências.

A regressão completa utilizou o PostgreSQL dedicado de testes:

| Verificação | Resultado |
| --- | --- |
| PostgreSQL desenvolvimento | `127.0.0.1:5433`, healthy |
| PostgreSQL testes | `127.0.0.1:5434`, healthy |
| Banco e usuário de testes | `fitmap_test` |
| Armazenamento de testes | `tmpfs` |
| Volumes persistentes de testes | Nenhum identificado |
| Pytest completo | **1.206/1.206 testes** |
| Duração informada pelo pytest | `90.21 s` |

A fixture de testes aplica migrations no banco dedicado.
O banco de desenvolvimento não foi utilizado pela suíte.

### 4.3. Resultado consolidado

- **Mobile: 933 testes aprovados.**
- **Backend: 1.206 testes aprovados.**
- **Total: 2.139 testes automatizados aprovados.**
- **GitHub Actions: 32/32 checks obrigatórios aprovados.**

O HEAD permaneceu em `881bde7`, com working tree limpa.
O stash local da ACC-02.5-C.2 permaneceu preservado.

## 5. Segurança de dependências

Auditoria mobile registrada em 23/11/2026:

- Árvore de produção: zero ocorrências conhecidas.
- Árvore completa: zero críticas, zero altas, 28 moderadas.
- Três advisories moderados distintos:
  - Glob: `GHSA-3g3m-2fjr-6pw4`.
  - Minimatch: `GHSA-g3hv-75wg-m249`.
  - UUID: `GHSA-w5hq-g745-h8pq`.

As 28 ocorrências representam instâncias apontadas
pelo relatório, não 28 vulnerabilidades independentes.

A Issue #84 continua aberta para monitoramento e
remediação compatível com a árvore de dependências:

https://github.com/gumautoni/fitmap-mobile/issues/84

A aprovação da CI não significa ausência absoluta
de vulnerabilidades nem aceitação permanente dos riscos.

## 6. Limitações e pendências

- A homologação física complementar não foi refeita
  durante este checkpoint pós-integração.
- Os 133 cenários físicos registrados anteriormente
  são evidências históricas, não nova validação.
- Android, TalkBack e builds nativas permanecem
  sem homologação equivalente documentada.
- Os testes em Expo Go não constituem certificação WCAG.
- A limpeza dos dados utilizados na validação física
  anterior não foi confirmada.
- O aviso intermitente React act/VirtualizedList
  permanece documentado; a ausência de recorrência
  em uma execução não comprova sua correção.
- Os riscos moderados de dependências continuam
  acompanhados pela Issue #84.
- A validação local e a CI não demonstram prontidão
  para distribuição pública ou operação em produção.

## 7. Conclusão do checkpoint

A integração da Stack #92 e a regressão automatizada
pós-integração foram aprovadas, com identidade de
conteúdo entre a versão final e a QUALITY-01 validada.

Este resultado encerra a verificação automatizada
desta integração. A homologação física complementar
e as pendências de segurança e operação continuam
identificadas separadamente.

Documentos relacionados:

- `README.md`.
- `docs/testing.md`.
- `docs/mobile-development.md`.
- `docs/mobile-dependency-security.md`.
- `backend/README.md`.
