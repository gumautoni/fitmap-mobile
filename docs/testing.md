
# Estratégia de testes automatizados

Este documento descreve a estratégia de testes do FitMap, os ambientes utilizados, as verificações de qualidade e os procedimentos necessários para validar o backend e o aplicativo mobile.

A estratégia acompanha a evolução do projeto e contempla testes automatizados, integração com PostgreSQL, validação funcional em dispositivos físicos e Continuous Integration (CI).

## 1. Princípios

Os testes do FitMap devem priorizar:

- comportamento relevante para o usuário;
- prevenção de regressões;
- validação das regras de negócio;
- segurança, autenticação e autorização;
- isolamento entre usuários;
- integridade e persistência dos dados;
- fluxos críticos de aplicação;
- integração com dependências reais quando necessário;
- ambientes de teste isolados;
- resultados determinísticos e reproduzíveis.

O projeto não busca maximizar métricas de cobertura sem propósito.

Novas funcionalidades críticas devem possuir testes proporcionais aos riscos e comportamentos introduzidos.

A aprovação dos testes automatizados não substitui a validação funcional quando a experiência real depende de navegação, dispositivos, permissões ou integrações externas.

## 2. Organização dos testes

A validação técnica do FitMap está organizada em quatro áreas:

1. Testes automatizados do backend.
2. Testes automatizados do mobile.
3. Verificações estáticas e de qualidade.
4. Validação funcional e Continuous Integration.

O backend utiliza pytest, FastAPI TestClient, SQLAlchemy, PostgreSQL e Alembic.

O mobile utiliza Jest, jest-expo e React Native Testing Library.

GitHub Actions executa validações automatizadas em Pull Requests direcionadas à branch `main`.

## 3. Testes do backend

### 3.1. Ferramentas

O backend utiliza:

- pytest;
- FastAPI TestClient;
- SQLAlchemy;
- PostgreSQL para testes com persistência;
- Alembic para preparação e validação do schema;
- mocks e dependências substituídas quando apropriado.

Os testes são mantidos em:

`backend/tests/`

### 3.2. Executar a suíte completa

A partir do diretório `backend`:

```bash
uv run pytest
```

Para reduzir a extensão dos tracebacks durante uma investigação:

```bash
uv run pytest --tb=short
```

A execução completa exige que o PostgreSQL exclusivo de testes esteja disponível.

Os testes que dependem de infraestrutura não devem utilizar o banco de desenvolvimento nem qualquer banco de produção.

### 3.3. Seleção de testes

O projeto possui suporte ao marcador `integration` no pytest.

Exemplo de seleção:

```bash
uv run pytest -m "not integration"
```

**Limitação importante:** o arquivo `tests/conftest.py` possui uma fixture de sessão automática que executa as migrations Alembic no banco de testes.

Portanto, no estado atual do projeto, filtrar os testes com `-m "not integration"` não elimina necessariamente a necessidade de acesso ao PostgreSQL.

Para executar pytest com segurança, mantenha o banco de testes disponível.

A execução de testes verdadeiramente independentes de infraestrutura exigiria uma separação explícita da fixture global, que não faz parte da implementação atual.

### 3.4. PostgreSQL exclusivo de testes

O banco de testes é definido no arquivo:

`backend/compose.test.yaml`

A configuração utiliza:

```text
Serviço: postgres-test
Banco: fitmap_test
Host: 127.0.0.1
Porta: 5434
```

O PostgreSQL de desenvolvimento utiliza normalmente a porta `5433`.

Os dois ambientes são separados.

O banco de testes utiliza armazenamento temporário por meio de `tmpfs`, não compartilhando o volume persistente do banco de desenvolvimento.

A partir do diretório `backend`, inicie o serviço:

```bash
docker compose -f compose.test.yaml up -d --wait postgres-test
```

Verifique seu estado:

```bash
docker compose -f compose.test.yaml ps
```

O serviço deve aparecer como `healthy`.

Quando necessário, é possível interromper apenas o banco de testes:

```bash
docker compose -f compose.test.yaml stop postgres-test
```

O armazenamento de testes é descartável. A interrupção ou recriação do container pode eliminar seus dados temporários.

Não utilize comandos de remoção de volumes ou opções de limpeza de containers órfãos durante a execução rotineira do projeto.

### 3.5. Preparação do ambiente de testes

O arquivo `backend/tests/conftest.py` configura o ambiente de testes, incluindo:

- modo de execução `test`;
- conexão ao PostgreSQL exclusivo;
- configuração de autenticação específica de testes;
- preparação das migrations;
- disponibilização de clientes FastAPI;
- disponibilização de conexões SQLAlchemy.

Uma fixture automática de sessão executa:

```text
Alembic upgrade -> head
```

Esse procedimento prepara o schema necessário à suíte.

As migrations são executadas no ambiente configurado para testes, e não no banco de desenvolvimento.

### 3.6. Cobertura funcional do backend

A suíte de backend contempla os seguintes grupos de comportamento.

#### Sistema e infraestrutura

- endpoint `/health`;
- endpoint `/ready`;
- indisponibilidade do banco;
- contrato padronizado de erros;
- conexão com PostgreSQL;
- isolamento do banco de testes;
- migrations Alembic;
- evolução e reversão de schema.

#### Identity e autenticação

- registro de usuários;
- validação de credenciais;
- normalização de e-mail;
- armazenamento seguro de senhas;
- autenticação com access token;
- emissão e rotação de refresh tokens;
- persistência das sessões;
- revogação e logout;
- rejeição de credenciais inválidas;
- proteção de endpoints autenticados.

#### Perfil de usuário

- recuperação do perfil autenticado;
- atualização de dados;
- preferências fitness;
- validação de valores;
- atualização parcial;
- rejeição de campos inválidos;
- isolamento dos dados entre usuários.

#### Gyms e integração externa

- busca de academias por localização;
- busca por coordenadas;
- normalização dos resultados Geoapify;
- tratamento de respostas inválidas;
- falhas de comunicação com o provider;
- limites e tratamento de requisições;
- cache de localização;
- consulta de detalhes de academias.

#### Favorite Gyms — Issue #16

- identidade interna persistente das academias;
- associação com referências externas;
- unicidade das referências por provider;
- criação de favoritos;
- listagem de favoritos autenticados;
- impedimento de favoritos duplicados;
- isolamento entre usuários;
- remoção de favoritos;
- preservação do registro `Gym` após remoção;
- validação dos endpoints de favoritos;
- tratamento de academias inexistentes;
- tratamento de falhas do provider.

Os testes contemplam os modelos `Gym`, `GymExternalReference` e `FavoriteGym`, além das regras de negócio e dos endpoints REST.

#### Training

- catálogo de exercícios;
- criação de exercícios personalizados;
- criação e atualização de treinos;
- configuração de séries, repetições e carga;
- ordenação de exercícios;
- arquivamento e restauração;
- restrições de propriedade;
- integridade das relações;
- validação de valores inválidos.

#### Workout Sessions e History — Issue #18

- inicialização de sessões;
- impedimento de múltiplas sessões ativas por usuário;
- registro de séries executadas;
- atualização de dados de execução;
- notas de sessão e exercício;
- conclusão de exercícios;
- finalização e cancelamento de sessões;
- restrições após conclusão;
- preservação de registros históricos;
- isolamento entre usuários;
- integridade dos snapshots históricos.

#### Progress — Issue #19

- estatísticas básicas de treino;
- contagem de treinos concluídos;
- frequência e dias de treinamento;
- séries executadas;
- histórico de desempenho por exercício;
- isolamento dos indicadores por usuário;
- associação opcional de fotos às sessões;
- persistência de registros de fotos;
- preservação de fotos após exclusão de sessões associadas;
- proteção dos endpoints privados.

#### Validação e armazenamento de mídia

- tipos de imagem aceitos;
- validação de assinatura de arquivo;
- rejeição de arquivos vazios;
- limite máximo de tamanho;
- rejeição de tipos inválidos;
- operações de armazenamento privado;
- recuperação de objetos;
- tratamento de objetos inexistentes;
- remoção de objetos;
- tratamento de erros de armazenamento.

Os testes utilizam substituições de dependências quando o comportamento avaliado não exige um serviço externo real.

A existência de testes de armazenamento não significa que toda a suíte dependa de um S3 real.

## 4. Testes do mobile

### 4.1. Ferramentas

O mobile utiliza:

- Jest;
- jest-expo;
- React Native Testing Library;
- TypeScript;
- mocks para serviços e dependências quando apropriado.

Os testes automatizados estão organizados principalmente em:

- `src/components/__tests__/`
- `src/services/__tests__/`
- `src/utils/__tests__/`

### 4.2. Executar todos os testes

Na raiz do repositório:

```bash
npm test
```

Para executar sem modo watch explicitamente:

```bash
npm test -- --watch=false
```

Durante o desenvolvimento, o modo watch pode ser utilizado:

```bash
npm run test:watch
```

### 4.3. Cobertura funcional mobile

A suíte atual contém verificações de comportamento relacionadas aos seguintes grupos.

#### Componentes

- renderização;
- interação com botões;
- estados desabilitados;
- comportamento de componentes reutilizáveis.

#### Utilitários

- cálculo de distância;
- validação de coordenadas;
- tratamento de valores inválidos.

#### Autenticação

- contratos dos serviços de autenticação;
- tratamento de respostas;
- operações de sessão;
- normalização de dados quando aplicável.

#### Perfil

- carregamento de informações;
- normalização dos dados recebidos;
- atualização do perfil;
- preservação de campos não modificados.

#### Academias e favoritos

- contratos dos serviços de academias;
- requisições de listagem de favoritos;
- adição de favoritos;
- remoção de favoritos;
- normalização dos identificadores.

A aplicação mantém separados:

- identificador externo do provider;
- UUID interno da academia no FitMap.

#### Training

- operações dos serviços de treinamento;
- contratos relacionados a treinos;
- integração com endpoints;
- tratamento e transformação de respostas.

#### Workout Sessions

- serviços relacionados às sessões;
- operações de execução e histórico;
- tratamento de respostas e erros.

#### Progress

- serviços de estatísticas;
- desempenho por exercício;
- operações relacionadas a fotos privadas;
- normalização das respostas.

Esses testes validam contratos e comportamentos específicos.

Não devem ser interpretados como cobertura integral de todas as interações visuais de cada tela.

### 4.4. Princípios para mocks

Mocks são apropriados quando permitem testar o comportamento da aplicação sem depender de:

- rede externa;
- serviços indisponíveis;
- hardware;
- localização real;
- câmera;
- armazenamento remoto.

Os mocks não devem esconder regras de negócio importantes.

Fluxos dependentes de mapa, câmera, permissões ou providers externos devem receber testes proporcionais ao risco, evitando complexidade artificial apenas para aumentar métricas de cobertura.

## 5. Validação funcional em dispositivo físico

A validação automatizada não substitui todos os cenários reais de uso.

Algumas funcionalidades exigem execução no dispositivo, especialmente quando envolvem:

- comunicação entre celular e backend local;
- permissões;
- mapa interativo;
- navegação;
- sessão autenticada;
- mudanças de estado entre telas;
- persistência observável após login.

### 5.1. Favorite Gyms — validação realizada

A Issue #16 foi validada manualmente em um iPhone utilizando Expo Go e backend local.

O fluxo executado incluiu:

1. Autenticação do usuário.
2. Acesso ao mapa.
3. Carregamento da seção de favoritos.
4. Pesquisa de academia.
5. Abertura dos detalhes.
6. Adição da academia aos favoritos.
7. Atualização do botão e indicador visual.
8. Retorno ao mapa.
9. Exibição da academia na lista de favoritos.
10. Exibição do selo de favorita.
11. Reabertura pelos favoritos.
12. Logout.
13. Novo login com a mesma conta.
14. Confirmação da persistência do favorito.
15. Remoção da academia dos favoritos.
16. Atualização dos detalhes.
17. Remoção da academia da lista e do selo.

Todos os comportamentos observados nesse fluxo foram aprovados.

Essa validação confirma o funcionamento do fluxo principal entre o aplicativo mobile, a API FastAPI e a persistência PostgreSQL no ambiente testado.

Ela não representa uma auditoria completa de todos os dispositivos, sistemas operacionais ou condições de rede.

## 6. Verificações de qualidade

### 6.1. Backend

Na pasta `backend`:

```bash
uv run pytest
uv run ruff check src tests alembic
uv run ruff format --check src tests alembic
uv run pyright
uv lock --check
uv run alembic check
```

As verificações incluem:

- execução dos testes;
- regras estáticas de Python;
- padronização de formatação;
- análise de tipagem;
- consistência do lockfile;
- detecção de alterações de schema não representadas por migrations.

O comando `alembic check` utiliza a configuração do banco de desenvolvimento.

Ele deve ser executado somente com o ambiente correto configurado e não substitui a validação das migrations no banco isolado de testes.

### 6.2. Mobile

Na raiz do repositório:

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
git diff --check
```

Esses comandos verificam o comportamento automatizado, a tipagem, as regras de qualidade e a formatação dos arquivos.

As verificações devem finalizar com código de saída zero.

## 7. Continuous Integration

O FitMap utiliza GitHub Actions para executar validações automatizadas nas Pull Requests direcionadas à branch `main`.

O workflow está definido em:

`.github/workflows/ci.yml`

### 7.1. Mobile validation

O job mobile executa:

- checkout do repositório;
- configuração do Node.js;
- instalação com `npm ci`;
- Jest;
- TypeScript;
- ESLint;
- Prettier.

### 7.2. Backend validation

O job backend utiliza Python 3.13, uv e PostgreSQL 18.

As verificações incluem:

- dependências bloqueadas pelo lockfile;
- consistência do lockfile;
- Ruff lint;
- Ruff format;
- Pyright;
- pytest.

O PostgreSQL de CI é disponibilizado por meio de um serviço isolado na porta `5434`.

### 7.3. Backend container validation

O workflow também verifica:

- construção da imagem Docker;
- execução sem usuário root;
- ausência do arquivo `.env` na imagem;
- inicialização do container;
- resposta do endpoint `/health`.

### 7.4. Critérios para merge

Uma Pull Request somente deve ser considerada pronta quando:

- a implementação estiver completa;
- os testes relevantes estiverem aprovados;
- a documentação estiver consistente;
- os jobs obrigatórios de CI estiverem aprovados;
- não existirem falhas bloqueantes conhecidas.

A validação local não substitui a execução do CI da Pull Request.

## 8. Checkpoint de validação — Issue #16

Durante a auditoria da branch `feat/favorite-gyms`, em outubro de 2026, foram registrados os seguintes resultados locais:

| Verificação | Resultado |
|---|---|
| Testes mobile | 53 aprovados |
| Suítes mobile | 8 aprovadas |
| Testes backend | 313 aprovados |
| TypeScript | Sem erros |
| ESLint | Sem erros |
| Prettier | Aprovado |
| Ruff lint | Aprovado |
| Ruff format | 102 arquivos verificados |
| Pyright | 0 erros e 0 warnings |
| uv lock | Consistente |
| Alembic check | Sem novas operações |
| Teste funcional iPhone | Aprovado |

A suíte backend apresentou um warning de depreciação relacionado a Starlette e AnyIO, sem falhas de teste.

O resultado anterior de erro generalizado por indisponibilidade do PostgreSQL de testes foi solucionado iniciando o serviço `postgres-test`.

Esses números representam um checkpoint verificado e podem mudar com a evolução do projeto.

A Issue #16 ainda depende de revisão da Pull Request e aprovação do respectivo CI para ser considerada integrada à branch `main`.

## 9. Convenções

- Testes unitários devem permanecer rápidos e determinísticos.
- Testes de integração devem utilizar infraestrutura isolada.
- Nenhum teste deve depender de dados reais de produção.
- O banco de desenvolvimento não deve ser utilizado pela suíte automatizada.
- Falhas esperadas devem ser verificadas explicitamente.
- Mocks devem ser utilizados quando a dependência externa não fizer parte do comportamento avaliado.
- Integrações reais devem ser utilizadas quando forem importantes para validar o comportamento.
- Testes devem possuir nomes claros que descrevam seu objetivo.
- Novas regras de negócio devem receber validação proporcional ao risco.
- Testes de isolamento e autorização devem acompanhar funcionalidades privadas.
- Alterações de persistência devem preservar a integridade dos dados.
- Falhas não devem ser ignoradas apenas para obter um resultado verde.
- Métricas de cobertura não substituem verificações relevantes.

## 10. Evolução da estratégia

A estratégia de testes deve acompanhar a implementação de novas funcionalidades.

Entre os próximos itens do backlog estão:

- métricas corporais e objetivos fitness mensuráveis;
- avaliações e comentários de academias;
- novas regras de validação e autorização;
- ampliação de cenários funcionais conforme necessário.

Novas funcionalidades devem introduzir testes antes de serem consideradas concluídas.

A documentação deve refletir somente os comportamentos efetivamente implementados e verificados.
