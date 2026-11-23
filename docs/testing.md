
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
- normalização e contratos do provedor TomTom;
- seleção explícita do provedor nos endpoints;
- preservação da identidade por provedor e ID externo;
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

### 3.7. Observabilidade (OBS-01)

Requisitos relacionados: NFR-OBS-001, NFR-OBS-002 e
NFR-OBS-003. A readiness permanece coberta pela INFRA-03.

Testes automatizados:

- `test_request_observability.py`: 14 testes;
- `test_server_logging.py`: 8 testes;
- `test_observability_routes.py`: 4 testes.

A estrategia TDD confirmou 14 falhas iniciais esperadas.
A validacao Docker identificou uma lacuna na resolucao
das rotas de routers aninhados. Quatro testes adicionais
foram criados, com tres falhas esperadas e um controle
positivo, antes da correcao.

Todos os 26 testes foram aprovados apos a implementacao.

Em 17/11/2026, a validacao HTTP real confirmou nove
respostas correlacionadas com eventos JSON, incluindo
status 200, 401, 404, 405, 422, 500 e 503.

Um metodo HTTP artificial recebeu status 400 antes
de chegar ao middleware ASGI.

Os dados sinteticos sensiveis e tracebacks brutos
nao apareceram nos logs capturados.

A regressao completa confirmou 1206 testes backend
aprovados em 81,04 segundos, com o aviso de depreciacao
Starlette/AnyIO previamente conhecido.

A validacao Docker local nao substitui a CI e nao
comprova o comportamento de logs de infraestrutura externa.

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
- normalização dos identificadores;
- propagação do provedor pela navegação;
- priorização da TomTom na descoberta por coordenadas;
- fallback Geoapify para respostas vazias e falhas recuperáveis;
- propagação de erros não recuperáveis.

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


### 5.2. Ciclo 30 — descoberta TomTom

A validação do Ciclo 30, realizada em novembro de 2026,
registrou:

- 620 testes automatizados aprovados na última regressão
  completa do backend;
- 262 testes automatizados aprovados na última regressão
  completa do mobile;
- aprovação de TypeScript, ESLint e Prettier no mobile;
- consulta real ao endpoint TomTom com HTTP 200 e 53 estabelecimentos
  retornados para um raio de 10 km em Barra do Piraí, RJ;
- validação funcional no dispositivo: login, mapa, permissão
  de localização, resultados, detalhes, favoritos e
  avaliações.

O aplicativo utiliza um raio de 5 km para descoberta por
localização. Portanto, a contagem de 53 estabelecimentos,
obtida separadamente com raio de 10 km, não representa
a quantidade esperada no mapa do dispositivo.

Os cenários de prioridade TomTom, fallback Geoapify e
propagação de erros foram validados com mocks nos testes
mobile. A validação manual confirmou o fluxo funcional,
mas não isolou uma falha real da TomTom para acionar o
fallback, nem confirmou pelos logs o provedor utilizado
em cada requisição do celular.

Essas limitações devem ser preservadas no relato
de validação da funcionalidade.

### 5.3. Acessibilidade dos formulários de treino (ACC-02.1)

Em 17/11/2026, a entrega registrou oito novos testes
automatizados em:

`src/screens/__tests__/WorkoutFormsAccessibility.test.tsx`

A cobertura inclui:

* identificação acessível do nome do treino;
* identificação dos campos de configuração do exercício;
* estado acessível e alternância da unidade de carga;
* preservação do nome do botão durante a criação;
* indicador visual de seleção independente de cores;
* estados acessíveis durante o salvamento da configuração;
* desabilitação e recuperação dos controles de criação;
* recuperação dos controles após falha no salvamento.

Os quatro testes iniciais falharam pelos motivos
esperados antes da implementação e foram aprovados
após as correções.

Os quatro testes complementares também foram aprovados.

A regressão mobile completa registrou:

* 722 testes aprovados;
* 46 suítes aprovadas;
* TypeScript, ESLint e Prettier aprovados;
* duração local de 17,64 segundos, incluindo a
  inicialização do comando de testes.

A última regressão confirmada do backend permanece
com 1.206 testes aprovados, totalizando 1.928 testes
automatizados nas duas suítes acumuladas.

#### Validação física

O desenvolvedor confirmou os seguintes cenários
no iPhone, com Expo e backend local:

1. Criação do treino.
2. Funcionamento dos campos de configuração.
3. Indicador visual da unidade selecionada.
4. Alternância entre kg e lb.
5. Persistência dos dados após salvar.
6. Identificação do nome do treino pelo VoiceOver.
7. Identificação dos botões de criação pelo VoiceOver.
8. Identificação dos quatro campos de configuração.
9. Anúncio da unidade selecionada pelo VoiceOver.
10. Identificação do botão de salvar pelo VoiceOver.
11. Usabilidade da criação com texto ampliado.
12. Usabilidade da configuração com texto ampliado.

Resultado: 12 de 12 verificações aprovadas.

A validação manual complementa os testes automatizados,
mas não comprova conformidade integral de acessibilidade
nem compatibilidade com todos os dispositivos.

### 5.4. Acessibilidade do gerenciamento, execução e histórico (ACC-02.2)

Em 17/11/2026, a entrega registrou 36 novos testes
automatizados, distribuídos da seguinte forma:

| Suíte | Novos testes |
| --- | ---: |
| `ExerciseCatalogScreen.test.tsx` | 6 |
| `WorkoutDetailsAccessibility.test.tsx` | 10 |
| `WorkoutsAccessibility.test.tsx` | 3 |
| `WorkoutSessionNavigation.test.tsx` | 11 |
| `WorkoutHistoryScreen.test.tsx` | 2 |
| `WorkoutHistoryDetailsAccessibility.test.tsx` | 4 |
| **Total** | **36** |

As suítes estão em `src/screens/__tests__/`.

Os testes incluem cenários de acessibilidade,
regressão funcional, operações pendentes,
recuperação de falhas, dimensões de toque
e preservação dos registros de treino.

O desenvolvimento utilizou fases Red e Green,
com verificação das causas das falhas esperadas.

Os testes anteriores foram preservados.

#### Resultados automatizados

* 120 testes direcionados aprovados em 7 suítes;
* 758 testes mobile aprovados em 49 suítes;
* 722 testes da baseline ACC-02.1 preservados;
* 36 novos testes aprovados;
* TypeScript, ESLint e Prettier aprovados;
* verificação de integridade do diff aprovada;
* duração da regressão Jest: 17,092 segundos.

O aviso intermitente React `act` da suíte
`MapGymPreview.test.tsx` não apareceu na regressão
final, mas não foi considerado definitivamente resolvido.

Não houve nova execução local do backend nesta etapa.
A última regressão backend permanece com 1.206 testes
aprovados, totalizando 1.964 testes acumulados.

#### Validação física

O desenvolvedor confirmou, em 17/11/2026,
os seguintes cenários no iPhone via Expo Go,
utilizando backend local.

Gerenciamento:

1. Busca e adição de exercícios do catálogo.
2. Criação ou reutilização de exercício personalizado.
3. Edição do nome e persistência.
4. Reordenação e remoção de exercício.
5. Arquivamento e restauração do treino.

Execução:

6. Início do treino e registro de séries em dois exercícios.
7. Alternância kg/lb e indicador visual.
8. Registro e salvamento de observações gerais e individuais.
9. Remoção de série sem afetar outro exercício.
10. Conclusão, reabertura e atualização do progresso.
11. Aviso ao finalizar com exercício não concluído.
12. Retorno à aba Treinos após finalizar.

Histórico:

13. Alternância dos quatro períodos e indicador visual.
14. Limpeza dos filtros e retorno para Todos.
15. Identificação dos dois estados de conclusão.
16. Persistência das observações, séries, repetições e cargas.

VoiceOver:

17. Busca e botões do catálogo.
18. Controles de gerenciamento.
19. Campos de repetições e carga por exercício.
20. Unidades selecionadas e remoção contextual de séries.
21. Ações de conclusão, finalização e cancelamento.
22. Período selecionado e estados de conclusão no histórico.

Texto ampliado:

23. Legibilidade no catálogo e gerenciamento.
24. Campos, seletores e botões durante a execução.
25. Filtros e estados de conclusão no histórico.

Resultado: 25 de 25 verificações aprovadas.

Somadas à ACC-02.1, as entregas registram
44 novos testes automatizados e 37 verificações
físicas aprovadas.

#### Limitações e integração

As verificações de estados pendentes e recuperação
de falhas utilizaram testes automatizados.

A validação física não constitui certificação
integral de acessibilidade nem comprova funcionamento
em Android ou em builds nativos.

Os resultados representam a validação local
da branch ACC-02.2, baseada na ACC-02.1.

A integração permanece condicionada à aprovação
dos checks de CI e à resolução do bloqueio de
segurança registrado na Issue #84.

### 5.5. Acessibilidade de academias, favoritos e avaliações (ACC-02.3)

Em 18/11/2026, a entrega registrou 25 novos testes
automatizados, distribuídos da seguinte forma:

| Suíte | Novos testes |
| --- | ---: |
| `MapGymPreview.test.tsx` | 7 |
| `GymDetailsAccessibility.test.tsx` | 6 |
| `GymReviewForm.test.tsx` | 3 |
| `GymReviewReportForm.test.tsx` | 4 |
| `GymReviewsDeletion.test.tsx` | 2 |
| `GymReviewsReporting.test.tsx` | 2 |
| `GymReviewsSection.test.tsx` | 1 |
| **Total** | **25** |

As suítes estão em `src/screens/__tests__/`.

A suíte de detalhes e favoritos inclui dois testes
de regressão funcional e quatro de acessibilidade.

O desenvolvimento utilizou etapas Red e Green,
com verificação das causas das falhas esperadas.

As verificações incluem rótulos, estados acessíveis,
seleção independente de cor, dimensões de toque,
identidade dos provedores, recuperação de falhas
e identificação contextual das denúncias.

Doze consultas ao rótulo genérico de denúncia nos
testes anteriores foram adaptadas à nova semântica,
preservando as asserções funcionais e de negócio.

#### Resultados automatizados

* 158 testes direcionados aprovados em 9 suítes;
* 783 testes mobile aprovados em 50 suítes;
* 758 testes da baseline ACC-02.2 preservados;
* 25 novos testes aprovados;
* TypeScript, ESLint e Prettier aprovados;
* verificação de integridade do diff aprovada;
* duração da regressão Jest: 17,676 segundos.

O aviso intermitente React `act` do VirtualizedList
na suíte `MapGymPreview.test.tsx` apareceu na
regressão completa, sem falhas de teste.

O aviso não foi suprimido e permanece previsto
para investigação na QUALITY-01.

Não houve nova execução local do backend nesta etapa.

A última regressão backend permanece com 1.206 testes
aprovados, totalizando 1.989 testes acumulados.

#### Validação física

O desenvolvedor confirmou, em 18/11/2026,
os seguintes cenários no iPhone via Expo Go,
utilizando backend local.

Mapa, busca e localização:

1. Pesquisa por cidade.
2. Pesquisa por sugestão de localidade.
3. Utilização da localização atual.
4. Alternância dos quatro filtros de distância e indicador visual.
5. Alternância das três ordenações e indicador visual.
6. Seleção por marcador e sincronização com a lista.
7. Seleção pela lista e sincronização com a prévia.
8. Filtro de nome, ocultação da seleção e limpeza dos filtros.

Detalhes e favoritos:

9. Abertura dos detalhes da academia correta.
10. Adição de uma academia aos favoritos.
11. Retorno ao mapa e conferência do favorito.
12. Reabertura dos detalhes e remoção do favorito.

Avaliações e denúncias:

13. Seleção de nota e descrição textual das estrelas.
14. Publicação de uma avaliação de teste.
15. Edição da nota e do comentário.
16. Persistência dos dados editados.
17. Cancelamento da confirmação de exclusão.
18. Exclusão da própria avaliação de teste e atualização.
19. Abertura de denúncia de avaliação sintética de outra conta.
20. Alternância dos quatro motivos e indicador visual.
21. Cancelamento da denúncia e fechamento do formulário.
22. Envio de denúncia sobre avaliação sintética no ambiente local.

VoiceOver:

23. Leitura do campo de busca e dos botões de pesquisa e localização.
24. Leitura dos filtros e estados selecionados.
25. Seleção pela lista, marcadores e acesso aos detalhes.
26. Rótulos de favoritos e ações de avaliação.
27. Distinção entre ações de denúncia de avaliações diferentes.

Texto ampliado:

28. Legibilidade dos filtros e resultados do mapa.
29. Detalhes, favoritos e ações de gerenciamento.
30. Formulários de avaliação e denúncia sem corte relevante.

Resultado: 30 de 30 verificações aprovadas.

Somadas às etapas ACC-02.1 e ACC-02.2, as entregas
registram 69 novos testes automatizados e
67 verificações físicas aprovadas.

#### Limitações e integração

Os estados pendentes e a recuperação de falhas
foram avaliados por testes automatizados.

A validação física não constitui certificação
integral de acessibilidade ou comprovação de
compatibilidade com todos os dispositivos.

A validação Android e em builds nativos
permanece pendente.

Os resultados representam a validação local
da branch ACC-02.3, baseada na ACC-02.2.

A integração permanece condicionada à aprovação
dos checks obrigatórios de CI e à resolução
do bloqueio de segurança da Issue #84.

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

O comando `alembic check` utiliza a configuração ativa do ambiente. Para a validação de CI, utiliza exclusivamente o PostgreSQL isolado de testes.

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
- aplicação das migrations Alembic;
- consistência do schema com `alembic check`;
- pytest.

O PostgreSQL de CI é disponibilizado por meio de um serviço isolado na porta `5434`.

#### Consistência de migrations (INFRA-02)

Requisitos relacionados: NFR-DATA-004, NFR-DATA-005,
NFR-TEST-003 e NFR-TEST-006.

Antes do pytest, a CI aplica `alembic upgrade head`
no PostgreSQL exclusivo de testes e executa `alembic check`
com transações somente leitura.

Uma falha na migration ou na comparação interrompe o job.
A fixture de migrations da suíte pytest permanece preservada.

A validação local de 17/11/2026 confirmou:

- inicialização de um banco de testes vazio;
- revisão `f03a7b2c9d81` como head;
- controle positivo sem novas operações;
- controle negativo com uma coluna simulada apenas em memória.

O controle negativo não cria migrations nem altera o banco.

O `alembic check` detecta diferenças suportadas pelo
autogenerate. Ele não comprova equivalência integral de
todos os objetos, constraints ou comportamentos do banco.

A validação local não substitui a execução na CI.
Nenhuma migration automática em produção foi introduzida.

### 7.3. Backend container validation

O workflow também verifica:

- construção da imagem Docker;
- execução sem usuário root;
- ausência do arquivo `.env` na imagem;
- inicialização do container;
- resposta do endpoint `/health`;
- disponibilidade do PostgreSQL pelo endpoint `/ready`;
- indisponibilidade temporaria e recuperacao da conexao.

#### Readiness containerizada (INFRA-03)

A CI utiliza uma rede Docker exclusiva, PostgreSQL 18
temporario e credenciais geradas durante a execucao.

O backend utiliza a imagem construida pelo proprio job,
em modo `production`, sem acessar bancos existentes.

| Cenario | /health | /ready |
|---|---|---|
| PostgreSQL disponivel | 200 | 200 |
| PostgreSQL indisponivel | 200 | 503 |
| PostgreSQL restabelecido | 200 | 200 |

A validacao inclui os contratos JSON completos, inclusive
o codigo de erro `database_unavailable`.

Os tres cenarios foram aprovados localmente em 17/11/2026,
utilizando containers reais. A API recuperou a conexao
sem ser reiniciada.

Os recursos temporarios da CI sao removidos ao final,
inclusive quando uma validacao falha.

O endpoint `/ready` verifica conectividade por `SELECT 1`.
Ele nao comprova a completude das migrations, integridade
dos dados ou disponibilidade de todos os servicos externos.
A consistencia Alembic possui validacao independente
na INFRA-02.

#### Seguranca dos workflows (INFRA-06)

As 12 referencias diretas a Actions nos workflows de CI
e publicacao da imagem backend utilizam commits SHA completos.

Os comentarios preservam as tags de origem para facilitar
a manutencao e a revisao das atualizacoes.

Todos os cinco checkouts utilizam `persist-credentials: false`.

As permissoes permanecem limitadas a `contents: read`
na CI e a `contents: read` e `packages: write` no
workflow de publicacao da imagem backend.

O Gitleaks permanece fixado por versao e digest SHA-256,
com as regras e o isolamento existentes preservados.

Para atualizar uma Action:

1. Revisar a release oficial e suas mudancas.
2. Resolver a tag no repositorio oficial.
3. Confirmar o SHA completo do commit.
4. Atualizar a referencia e seu comentario.
5. Executar as validacoes obrigatorias da Pull Request.

A fixacao por SHA protege as referencias diretas.
Ela nao garante a seguranca de dependencias transitivas,
imagens-base mutaveis ou codigo executado internamente.

A publicacao no GHCR deve ser validada separadamente
apos alteracoes no workflow de imagem.

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

A Issue #16 foi posteriormente integrada à branch `main`. Os números acima são históricos e não representam o checkpoint atual.

### 8.1. Auditoria da branch principal — 03/11/2026

Antes da limpeza do legado (commit `748dd83`), foram confirmados:

| Verificação | Resultado |
|---|---|
| Backend | 593 testes aprovados |
| Mobile | 199 testes aprovados, 20 suítes |
| Ruff lint e format | Aprovados |
| Pyright strict | 0 erros e 0 avisos |
| TypeScript, ESLint e Prettier | Aprovados |
| Alembic | `3a467e3941e2 (head)` |
| Git | `main` limpa, sincronizada |

Um warning de depreciação do Starlette/AnyIO permanece sem falha de testes.
Após remover o componente legado CustomButton, seus testes exclusivos também são
retirados; um total mobile menor é esperado e deve ser registrado após a nova suíte.

A validação automatizada não substitui a avaliação integrada no dispositivo.

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

- novas regras de validação e autorização;
- ampliação de cenários funcionais conforme necessário.

Novas funcionalidades devem introduzir testes antes de serem consideradas concluídas.

A documentação deve refletir somente os comportamentos efetivamente implementados e verificados.
