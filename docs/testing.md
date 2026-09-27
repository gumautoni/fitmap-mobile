# Estratégia de testes automatizados

Este documento descreve a fundação de testes automatizados do FitMap, os ambientes utilizados e os comandos necessários para validar o backend e o aplicativo mobile durante o desenvolvimento.

## Princípios

Os testes do FitMap devem priorizar:

- comportamento relevante;
- prevenção de regressões;
- regras de negócio;
- fluxos críticos;
- integração com dependências reais quando isso trouxer valor;
- isolamento dos dados de teste;
- testes determinísticos e reproduzíveis.

O projeto não busca maximizar métricas de cobertura sem propósito.

Novas funcionalidades críticas devem incluir testes adequados ao risco e ao comportamento introduzido.

## Backend

O backend utiliza:

- pytest;
- FastAPI TestClient;
- PostgreSQL para testes de integração;
- Alembic para validação de migrations.

### Executar todos os testes

A partir da pasta `backend`:

```bash
uv run pytest
```

Esse comando executa tanto os testes comuns quanto os testes marcados como integração.

### Executar testes sem infraestrutura externa

Para executar somente os testes que não dependem de PostgreSQL:

```bash
uv run pytest -m "not integration"
```

### PostgreSQL de testes

Os testes de integração utilizam um PostgreSQL exclusivo definido em:

```text
backend/compose.test.yaml
```

O ambiente atual utiliza:

```text
Database: fitmap_test
Host: 127.0.0.1
Port: 5434
User: fitmap_test
```

Esse banco é separado do PostgreSQL de desenvolvimento, que utiliza a porta `5433`.

Inicie o banco de testes:

```bash
docker compose -f compose.test.yaml up -d postgres-test
```

Confira o estado:

```bash
docker compose -f compose.test.yaml ps
```

O serviço deve aparecer como `healthy`.

Pare o banco de testes:

```bash
docker compose -f compose.test.yaml stop postgres-test
```

O ambiente utiliza armazenamento descartável e não compartilha dados com desenvolvimento ou produção.

### Cobertura inicial do backend

A fundação atual valida:

- resposta do endpoint `/health`;
- resposta do endpoint `/ready` quando o banco está disponível;
- resposta `503` de `/ready` quando o banco está indisponível;
- contrato padronizado de erro HTTP;
- conexão real com o PostgreSQL de testes;
- uso do banco `fitmap_test`;
- execução das migrations Alembic;
- fluxo de migration `base → head → base`.

## Mobile

O aplicativo mobile utiliza:

- Jest;
- `jest-expo`;
- React Native Testing Library.

### Executar todos os testes mobile

A partir da raiz do projeto:

```bash
npm test
```

### Executar os testes durante o desenvolvimento

```bash
npm run test:watch
```

### Cobertura inicial do mobile

A fundação atual valida:

- cálculo de distância entre coordenadas;
- comportamento com coordenadas iguais;
- comportamento com coordenada inválida;
- renderização de componente;
- interação com botão;
- bloqueio de interação quando um botão está desabilitado.

Testes de interface devem ser adicionados quando validarem comportamento relevante.

Fluxos que dependem fortemente de mapa, câmera ou APIs externas não devem receber mocks complexos apenas para aumentar a quantidade de testes.

## Validação completa do backend

Antes de considerar uma alteração do backend pronta, execute na pasta `backend`:

```bash
uv run pytest
uv run ruff check src tests alembic
uv run ruff format --check src tests alembic
uv run pyright
uv lock --check
```

Quando houver alterações relacionadas ao schema ou à persistência, valide também:

```bash
uv run alembic check
```

Os testes de integração exigem que o PostgreSQL de testes esteja em execução.

## Validação completa do mobile

Antes de considerar uma alteração mobile pronta, execute na raiz do projeto:

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
git diff --check
```

Todos esses comandos devem finalizar com código de saída zero.

Uma falha em qualquer teste faz o respectivo comando de testes retornar código de saída diferente de zero, permitindo que a falha seja detectada também pela futura execução automatizada em CI.

## Convenções

- testes unitários devem permanecer rápidos e determinísticos;
- testes de integração devem utilizar infraestrutura própria de testes;
- testes nunca devem depender de dados de produção;
- o banco de desenvolvimento não deve ser utilizado pelos testes automatizados;
- falhas esperadas devem ser verificadas explicitamente;
- mocks devem ser utilizados quando a dependência real não fizer parte do comportamento que está sendo validado;
- integrações reais devem ser utilizadas quando forem essenciais para validar o comportamento;
- novos recursos críticos devem incluir testes proporcionais aos riscos introduzidos;
- testes devem possuir nomes claros que descrevam o comportamento esperado;
- métricas de cobertura não substituem testes relevantes.

## Continuous Integration

A suíte foi estruturada para poder ser executada automaticamente em Continuous Integration.

A configuração do GitHub Actions pertence à issue específica de CI do FitMap.

Quando essa etapa for implementada, os mesmos comandos utilizados localmente serão executados nos Pull Requests, permitindo que falhas de testes ou validações impeçam alterações inválidas de serem consideradas prontas para merge.

Até a implementação dessa etapa, a execução automática em CI permanece como requisito pendente da fundação de testes.
