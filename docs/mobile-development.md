# Desenvolvimento mobile

Este documento descreve o fluxo mínimo necessário para desenvolver, executar e validar localmente o aplicativo mobile do FitMap.

## Plataformas suportadas

O aplicativo mobile do FitMap é desenvolvido com React Native e Expo.

As plataformas oficialmente consideradas neste projeto são:

* Android
* iOS

A versão web não é considerada atualmente uma plataforma suportada pelo FitMap.

## Pré-requisitos

É necessário ter instalado:

* Node.js
* npm
* Expo Go, caso o aplicativo seja executado em um dispositivo físico

## Instalar as dependências

Na raiz do projeto, execute:

```bash
npm ci
```

O comando `npm ci` utiliza exatamente as versões registradas no `package-lock.json`, garantindo uma instalação mais previsível e reproduzível das dependências do projeto.

### Segurança das dependências

Alterações nas dependências devem preservar a compatibilidade
com o SDK Expo instalado e a instalação reproduzível pelo lockfile.

Para verificar a árvore e os advisories conhecidos:

```bash
npm ls --all
npm audit
npm audit --omit=dev
npx expo install --check
```

O código de saída de `npm audit` deve ser interpretado em conjunto
com o relatório de vulnerabilidades. Não utilizar `npm audit fix --force`
ou `--legacy-peer-deps` para ocultar conflitos de resolução.

Overrides devem possuir escopo explícito, justificativa técnica
e validação funcional proporcional ao risco.

O histórico das correções, os resultados das auditorias e os riscos
residuais estão registrados em
[Segurança das dependências mobile](mobile-dependency-security.md).

## Configuração de ambiente

O projeto possui o arquivo:

```text
.env.example
```

Ele serve apenas como modelo das configurações necessárias.

No Windows, crie seu arquivo local `.env` executando:

```powershell
Copy-Item .env.example .env
```

Depois, configure:

```env
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:8000/api/v1
```

Substitua `YOUR_LOCAL_IP` pelo endereço IP local do computador que está executando o backend.

Por exemplo:

```env
EXPO_PUBLIC_API_URL=http://192.168.0.15:8000/api/v1
```

Isso é especialmente importante quando o FitMap estiver sendo executado em um celular físico, pois o celular precisa conseguir acessar o computador pela rede local.

Variáveis que começam com `EXPO_PUBLIC_` ficam disponíveis dentro do aplicativo instalado no dispositivo.

Por isso, elas nunca devem armazenar:

* senhas;
* chaves privadas;
* secrets de JWT;
* credenciais do banco de dados;
* tokens privados do servidor;
* qualquer outro segredo do backend.

## Preparacao de builds EAS (INFRA-05)

O arquivo `eas.json` separa os ambientes development,
preview e production.

O fluxo atual com Expo Go permanece inalterado.
O perfil development com cliente nativo depende da
instalacao futura do `expo-dev-client`.

O perfil preview permite preparar um APK Android para
testes internos. O perfil production prepara um AAB
para futura distribuicao oficial.

Ambos exigem uma API acessivel por HTTPS, credenciais
nativas adequadas e vinculacao ao projeto Expo.

A chave do Maps SDK para Android deve ser configurada
pela variavel `GOOGLE_MAPS_ANDROID_API_KEY`, com
restricoes de pacote, certificado SHA-1 e API.

Essa chave nao substitui as credenciais server-side
utilizadas pelo backend para descoberta de academias.

Nao utilize os arquivos dotenv locais nos builds remotos.
As variaveis de cada ambiente devem ser configuradas no EAS.

Consulte [Deployment](deployment.md#mobile-releases)
para os requisitos de distribuicao.

## Executar o aplicativo

Para iniciar o Expo normalmente:

```bash
npm start
```

Para iniciar utilizando a rede local:

```bash
npm run start:lan
```

Para iniciar utilizando o túnel do Expo:

```bash
npm run start:tunnel
```

Para executar no Android:

```bash
npm run android
```

Para executar no iOS:

```bash
npm run ios
```

## TypeScript

TypeScript é a linguagem padrão para novos códigos de produção do aplicativo mobile.

O FitMap já possuía partes desenvolvidas em JavaScript. Por isso, a migração para TypeScript está sendo realizada gradualmente, sem reconstruir todo o aplicativo do zero.

Arquivos JavaScript existentes podem continuar funcionando normalmente até que sejam modificados ou passem a fazer parte de uma implementação ativa.

O modo estrito do TypeScript permanece habilitado.

Para verificar os tipos do projeto:

```bash
npm run typecheck
```

Esse comando procura erros de tipagem sem gerar novos arquivos.

## Lint

Para analisar a qualidade e possíveis problemas no código:

```bash
npm run lint
```

O projeto utiliza a configuração ESLint recomendada pelo Expo.

O lint ajuda a identificar problemas como:

* variáveis não utilizadas;
* padrões incorretos de código;
* possíveis erros;
* inconsistências que podem prejudicar a manutenção.

## Formatação

Para verificar se os arquivos TypeScript e arquivos de configuração estão corretamente formatados:

```bash
npm run format:check
```

Esse comando apenas verifica os arquivos e não realiza alterações.

Para aplicar automaticamente a formatação:

```bash
npm run format
```

Os arquivos JavaScript antigos não são reformados em massa durante a migração.

Eles serão migrados e formatados gradualmente conforme forem modificados, evitando alterações desnecessárias em grande parte do código legado.

## Validação local

Antes de realizar um commit envolvendo alterações no mobile, execute:

```bash
npm run typecheck
npm run lint
npm run format:check
git diff --check
```

Todos os comandos devem finalizar sem erros.

Cada comando possui uma responsabilidade:

* `npm run typecheck`: verifica os tipos TypeScript;
* `npm run lint`: verifica qualidade e padrões do código;
* `npm run format:check`: verifica a formatação;
* `git diff --check`: verifica problemas de espaços ou formatação no diff do Git.

## Organização do código mobile

O código mobile está dividido por responsabilidades.

### `src/screens/`

Contém as telas do aplicativo e os principais fluxos de apresentação ao usuário.

### `src/components/`

Contém componentes visuais reutilizáveis.

### `src/services/`

Contém serviços utilizados pelo aplicativo, como integrações e comunicação com outros recursos.

### `src/config/`

Contém configurações do aplicativo que dependem do ambiente de execução.

### `src/navigation/`

Contém a configuração da navegação e os tipos das rotas do aplicativo.

### `src/utils/`

Contém funções utilitárias reutilizáveis.

### `src/context/`

Contém o contexto da sessão autenticada, que integra o aplicativo ao backend.

## Comunicação com o backend

A comunicação HTTP com o backend deve utilizar o cliente centralizado localizado na camada de serviços.

Novas telas não devem criar chamadas independentes de `fetch` espalhadas pelo código quando a comunicação puder passar pelo cliente centralizado.

Essa organização facilita:

* tratamento de erros;
* configuração da URL da API;
* autenticação e renovação de tokens;
* manutenção;
* testes;
* alterações na comunicação com o backend.

## Contraste das cores semânticas (ACC-01)

A ACC-01 atende ao requisito NFR-ACC-003 (High)
no escopo dos tokens semânticos do tema mobile.

A implementação utiliza como referência os critérios
1.4.3 e 1.4.11 da WCAG 2.2, nível AA:

* contraste mínimo de 4,5:1 para textos normais;
* contraste mínimo de 3:1 para elementos gráficos
  essenciais e indicadores de interface aplicáveis.

Referência: <https://www.w3.org/TR/WCAG22/>.

### Auditoria inicial

A baseline identificou 99 linhas de utilização
dos tokens semânticos em 20 arquivos:

* success: 21;
* warning: 8;
* danger: 70.

Somente 2 das 12 combinações avaliadas no tema claro
atingiam 4,5:1. No tema escuro, as 12 já atendiam
ao limite estabelecido.

### Implementação

A alteração está centralizada em `src/theme/themes.ts`.

| Token | Antes | Depois |
| --- | --- | --- |
| success | #16A36A | #047857 |
| warning | #F5A524 | #92400E |
| danger | #D92D20 | #B91C1C |

Somente três valores do tema claro foram alterados.

O tema escuro, a identidade Orange Fusion,
os tokens de marca, componentes, tipografia
e espaçamentos permanecem preservados.

Não foram adicionadas dependências ou alterações
no backend, nos contratos HTTP ou no banco de dados.

### Resultados de contraste

| Token | Background | Surface | SurfaceSecondary | PrimarySoft |
| --- | ---: | ---: | ---: | ---: |
| success | 5,13 | 5,36 | 4,67 | 4,92 |
| warning | 6,63 | 6,93 | 6,03 | 6,36 |
| danger | 6,05 | 6,33 | 5,51 | 5,80 |

Os valores apresentados estão arredondados.
Os testes utilizam os valores sem arredondamento.

As 12 combinações do tema claro e as 12 do tema
escuro atendem ao limite de 4,5:1.

Os testes também validam textos e ícones sobre
fundos semânticos, estrelas e barras de progresso.

### Validação automatizada

Os testes estão localizados em:

* `src/theme/__tests__/semanticContrast.test.ts`.

A suíte utiliza luminância relativa sRGB
e valida relações de contraste, sem exigir
valores hexadecimais específicos.

Foram acrescentados 39 testes:

* 3 verificações do cálculo de contraste;
* 24 combinações de tokens e superfícies;
* 4 verificações de texto e ícones sobre fundos semânticos;
* 8 verificações de elementos gráficos.

Resultados Red: 25 aprovados e 14 falhas intencionais.

Resultados Green: 39 aprovados e nenhuma falha.

A regressão completa da branch independente apresentou:

* 576 testes anteriores preservados;
* 39 novos testes aprovados;
* 615 testes mobile aprovados em 40 suítes;
* nenhum teste com falha ou ignorado;
* Prettier, TypeScript e ESLint aprovados.

A regressão foi concluída em 14,35 segundos.

Esses resultados correspondem à baseline anterior
à integração da FUNC-08 e da PERF-03.

### Validação física

Em 16/11/2026, o desenvolvedor confirmou
16 cenários no iPhone via Expo Go.

Os oito grupos foram aprovados nos temas claro e escuro:

* indicadores de status na Home e no Mapa;
* metas fitness;
* conclusão de exercícios;
* estrelas de avaliação;
* botão de confirmação de exclusão;
* mensagens e ícones de erro;
* fotos de progresso;
* identidade visual Orange Fusion.

Os quatro cenários inicialmente não executados
foram aprovados na validação complementar.

### Limitações

Os testes avaliam combinações de cores RGB opacas.
Não constituem uma auditoria exaustiva dos elementos
renderizados pelo aplicativo.

Transparências, gradientes, estados desabilitados
e outros tokens podem exigir avaliações adicionais.

A adequação não constitui declaração de conformidade
integral com a WCAG.

A validação em Expo Go não comprova compatibilidade
com todos os dispositivos ou configurações.

Leitores de tela, ampliação de texto, áreas de toque
e outros requisitos permanecem previstos para a ACC-02.

## Acessibilidade dos formulários de treino (ACC-02.1)

A primeira etapa da ACC-02 abrange a criação de treinos
e a configuração dos exercícios.

A implementação contribui para os requisitos NFR-ACC-001,
NFR-ACC-002 e NFR-ACC-006. Os requisitos NFR-ACC-004
e NFR-ACC-005 foram avaliados no escopo dos formulários.

### Implementação

Arquivos envolvidos:

* `src/screens/CreateWorkoutScreen.tsx`;
* `src/screens/WorkoutExerciseConfigScreen.tsx`.

Foram implementados:

* rótulos acessíveis para os cinco campos de texto;
* estado acessível de desabilitação durante o salvamento;
* nomes acessíveis permanentes nos botões de criação
  e salvamento;
* estado `busy` durante as respectivas solicitações;
* estado `selected` nos seletores de unidade kg e lb;
* indicador visual de confirmação na unidade selecionada,
  sem depender exclusivamente de diferenças de cor.

Os principais controles já possuíam alturas mínimas
entre 48 e 54 unidades lógicas do React Native.
Essas dimensões foram preservadas.

A lógica de negócio, os contratos da API, a navegação,
as dependências e a identidade Orange Fusion
permaneceram inalterados.

### Validação

A entrega adicionou oito testes automatizados na suíte
`WorkoutFormsAccessibility.test.tsx`.

A regressão mobile registrou 722 testes aprovados
em 46 suítes, com TypeScript, ESLint e Prettier aprovados.

Em 17/11/2026, o desenvolvedor confirmou 12 verificações
físicas aprovadas no iPhone, incluindo VoiceOver,
ampliação de texto, seleção de unidade e persistência
da configuração.

### Limitações

A validação física abrangeu os dois formulários
no dispositivo e na configuração utilizados.

Os resultados não constituem certificação integral
de conformidade WCAG, nem comprovam todas as
configurações de acessibilidade, dispositivos ou
builds nativos.

Os demais fluxos permanecem no escopo das etapas
seguintes da ACC-02.

## Acessibilidade do gerenciamento, execução e histórico de treinos (ACC-02.2)

A segunda etapa da ACC-02 complementa a acessibilidade
dos formulários de treino implementada na ACC-02.1.

O escopo contribui para os requisitos NFR-ACC-001,
NFR-ACC-002 e NFR-ACC-006, com avaliação localizada
dos requisitos NFR-ACC-004 e NFR-ACC-005.

### Gerenciamento e catálogo

Arquivos envolvidos:

* `src/screens/ExerciseCatalogScreen.tsx`;
* `src/screens/WorkoutDetailsScreen.tsx`;
* `src/screens/WorkoutsScreen.tsx`.

Foram aprimorados:

* rótulos acessíveis da busca, dos campos de edição
  e das ações de gerenciamento;
* identificação das ações de criação e adição
  de exercícios durante solicitações pendentes;
* estados acessíveis de processamento e desabilitação
  durante edição, arquivamento, reordenação,
  remoção e restauração de treinos ou exercícios.

### Execução de treinos

Arquivos envolvidos:

* `src/screens/WorkoutSessionScreen.tsx`;
* `src/components/WorkoutNoteEditor.tsx`.

Os campos de repetições e carga identificam o exercício
correspondente em seus rótulos acessíveis.

Os seletores kg e lb informam o estado `selected`
e apresentam um indicador visual de confirmação
independente de cor.

A remoção de séries identifica a posição da série
e o nome do exercício correspondente.

Os controles de registro, conclusão, reabertura,
finalização e cancelamento expõem estados acessíveis
compatíveis com os estados de processamento existentes.

Os campos de observações informam explicitamente
quando estão desabilitados.

Os botões de conclusão, remoção e seleção de
unidade foram ajustados para dimensões mínimas
de interação de 48 unidades lógicas, preservando
larguras maiores quando existentes.

### Histórico de treinos

Arquivos envolvidos:

* `src/screens/WorkoutHistoryScreen.tsx`;
* `src/screens/WorkoutHistoryDetailsScreen.tsx`.

O filtro de período selecionado apresenta um
indicador visual de confirmação, preservando o
rótulo acessível e o estado `selected`.

Nos detalhes do histórico, cada exercício apresenta
o texto Concluído ou Não concluído, acompanhado
de um rótulo acessível contextual.

O estado utiliza exclusivamente `exercise.isCompleted`.
A existência de séries registradas não implica
a conclusão do exercício.

Os ícones existentes e os tokens de tema foram
preservados. A indicação textual não utiliza altura fixa.

### Validação

A entrega acrescentou 36 testes automatizados:

* 19 no gerenciamento e catálogo;
* 11 na execução de treinos;
* 6 no histórico e em seus detalhes.

A regressão direcionada aprovou 120 testes em 7 suítes.

A regressão mobile completa aprovou 758 testes
em 49 suítes, com TypeScript, ESLint e Prettier
aprovados.

Em 17/11/2026, o desenvolvedor confirmou
25 de 25 verificações físicas no iPhone,
com Expo Go e backend local, incluindo VoiceOver,
ampliação de texto e persistência dos registros.

A lógica de negócio, a navegação, os contratos HTTP,
a paginação, as dependências e a identidade Orange Fusion
permaneceram inalterados.

### Limitações

Os resultados se restringem aos cenários automatizados
e à configuração física utilizada.

A dimensão lógica configurada nos controles não
constitui medição física exaustiva de todas as telas.

A validação não comprova conformidade integral
com a WCAG, compatibilidade com todos os dispositivos
ou funcionamento em builds nativos.

A validação física no Android permanece pendente.

Os demais módulos e as verificações transversais
permanecem previstos nas etapas seguintes da ACC-02.

A validação integrada por CI permanece necessária.

## Acessibilidade de academias, favoritos e avaliações (ACC-02.3)

A terceira etapa da ACC-02 complementa as melhorias
dos formulários, gerenciamento, execução e histórico
de treinos implementadas nas etapas anteriores.

O escopo contribui para os requisitos NFR-ACC-001,
NFR-ACC-002 e NFR-ACC-006, com avaliação localizada
dos requisitos NFR-ACC-004 e NFR-ACC-005.

### Mapa e descoberta de academias

Arquivo envolvido: `src/screens/MapScreen.tsx`.

O campo de busca por cidade, bairro ou região possui
rótulo acessível explícito e estado de desabilitação.

Os botões de pesquisa e localização atual informam
seus respectivos estados de processamento e
desabilitação durante as solicitações existentes.

O botão de pesquisa possui dimensões de 48 por 48
unidades lógicas.

Os filtros de distância e as opções de ordenação
preservam seus rótulos acessíveis e o estado
`selected`, acrescentando um indicador visual
de confirmação independente de cor.

Os resultados da lista informam o estado `selected`
da academia correspondente.

A seleção permanece sincronizada com a prévia
do mapa e respeita os filtros existentes.

A implementação preserva a busca por texto,
as sugestões de localidade, a geolocalização,
a ordenação e a identidade dos provedores.

### Detalhes e favoritos

Arquivo envolvido: `src/screens/GymDetailsScreen.tsx`.

Durante a consulta inicial dos favoritos, o botão
apresenta o rótulo acessível Sincronizando favorito.

As ações de adição e remoção preservam seus rótulos
durante o processamento e expõem os estados
acessíveis `busy` e `disabled`.

Uma falha na sincronização mantém a ação desabilitada
até que o estado dos favoritos seja recuperado.

O botão de recuperação possui dimensões mínimas
de 48 por 48 unidades lógicas.

A identificação do favorito por provedor e ID externo,
a remoção pelo ID interno e as ações de rota,
telefone e site permanecem preservadas.

### Formulários de avaliação e denúncia

Arquivos envolvidos:

* `src/screens/GymReviewForm.tsx`;
* `src/screens/GymReviewReportForm.tsx`.

Os botões de publicação, edição e envio informam
estados acessíveis de processamento e desabilitação,
preservando seus rótulos durante as solicitações.

Os campos de comentário e detalhes da denúncia
informam explicitamente quando estão desabilitados.

Os motivos de denúncia apresentam um indicador
visual de confirmação independente de cor,
preservando o estado `selected`.

As opções de motivo e os botões de envio e
cancelamento da denúncia possuem altura mínima
de 48 unidades lógicas.

A descrição textual das estrelas, os limites de
caracteres e as validações existentes foram preservados.

### Gerenciamento de avaliações

Arquivo envolvido: `src/screens/GymReviewsSection.tsx`.

A confirmação de exclusão informa os estados
acessíveis `busy` e `disabled`.

Os botões de denúncia identificam a posição da
avaliação na lista apresentada e sua nota.

O rótulo contextual não expõe identificadores
internos nem reproduz o conteúdo dos comentários.

Os identificadores utilizados nas solicitações
ao backend permanecem inalterados.

As ações de edição, exclusão, confirmação,
cancelamento, denúncia e recuperação possuem
altura mínima de 48 unidades lógicas.

O botão de recuperação também possui largura
mínima de 48 unidades lógicas.

A confirmação explícita de exclusão, as regras de
publicação e edição, o isolamento entre academias
e o tratamento das denúncias foram preservados.

### Validação

A entrega acrescentou 25 testes automatizados:

* 7 no mapa, busca, filtros e ordenação;
* 6 nos detalhes e favoritos;
* 7 nos formulários de avaliação e denúncia;
* 5 no gerenciamento de avaliações.

Os novos testes incluem acessibilidade e regressão
funcional, preservando os testes anteriores.

A regressão direcionada aprovou 158 testes
em 9 suítes.

A regressão mobile completa aprovou 783 testes
em 50 suítes, com TypeScript, ESLint e Prettier
aprovados.

Em 18/11/2026, o desenvolvedor confirmou
30 de 30 verificações físicas no iPhone via Expo Go,
utilizando o backend local.

A validação incluiu busca, mapa, favoritos,
publicação, edição, exclusão, denúncias sintéticas,
VoiceOver e ampliação de texto.

A interação com os marcadores nativos do mapa
foi aprovada na configuração física utilizada.

Os serviços mobile, contratos HTTP, autenticação,
persistência, dependências e identidade Orange Fusion
permaneceram inalterados.

### Limitações

Os resultados representam os cenários automatizados
e a configuração física utilizada pelo desenvolvedor.

O tamanho configurado nos controles não constitui
medição física exaustiva de todas as telas.

A validação em Expo Go não constitui certificação
integral de acessibilidade ou conformidade WCAG,
nem comprova funcionamento em builds nativos.

A validação física no Android permanece pendente.

O aviso intermitente React `act` do VirtualizedList
na suíte `MapGymPreview.test.tsx` permanece registrado
para investigação na QUALITY-01.

Os demais módulos e as verificações transversais
permanecem no escopo das próximas etapas da ACC-02.

A integração permanece condicionada à resolução
do bloqueio de segurança da Issue #84 e à aprovação
dos checks obrigatórios de CI.

---

---

## Acessibilidade de autenticação, perfil, progresso e navegação (ACC-02.4)

A entrega amplia a acessibilidade da conta, do acompanhamento
de progresso e dos componentes compartilhados.

O escopo considera os requisitos NFR-ACC-001 a NFR-ACC-006,
sem representar certificação integral desses requisitos.

### Autenticação

* Rótulos contextuais dos campos de autenticação.
* Identificação das ações de exibir e ocultar senha.
* Orientações sobre requisitos e erros de preenchimento.
* Campos e ações protegidos durante o envio.
* Controles de navegação desabilitados durante operações pendentes.
* Alvos de toque ampliados nos controles revisados.

A validação de credenciais, as regras de senha, a navegação
e os contratos de autenticação permanecem inalterados.

### Perfil

* Indicadores acessíveis de carregamento e falha.
* Identificação contextual das configurações.
* Indicador de preenchimento do perfil com semântica de progresso.
* Orientações e estados acessíveis na edição de nome e altura.
* Identificação da opção selecionada nas preferências.
* Proteção das ações durante operações pendentes.

O cálculo de preenchimento, os serviços de perfil e a persistência
existente permanecem inalterados.

### Progresso

Os registros corporais e as metas possuem orientações de preenchimento,
identificação de tipos e unidades, estados selecionados e estados
acessíveis durante o salvamento.

As metas com progresso calculável apresentam semântica de progresso,
valor percentual e contexto do objetivo.

O cartão de IMC identifica carregamento, indisponibilidade,
altura e peso utilizados, preservando o cálculo original.

O gráfico de evolução apresenta uma descrição textual dos valores
inicial e final disponíveis, variação e extensão do histórico exibido.
A seleção de métricas utiliza indicador visual adicional à cor.

O cálculo, os limites do histórico e a representação gráfica
permanecem inalterados.

As operações de captura, envio e visualização de fotos possuem
estados acessíveis e controles revisados.

O visualizador mantém o fechamento convencional e oferece
o callback de escape de acessibilidade.

As miniaturas de mesma data possuem identificação contextual
distinta, sem exposição de identificadores internos nos rótulos.

Os indicadores de desempenho e evolução apresentam descrições
que contextualizam métricas, datas, séries, repetições e cargas.

Os serviços, contratos, cálculos e regras de acesso às fotos
permanecem inalterados.

### Home e navegação

* Cabeçalhos semânticos na saudação e nas seções principais.
* Rótulos distintos para os atalhos da Home.
* Orientação contextual do card de treino.
* Identificação acessível dos estados de carregamento.
* Elementos puramente decorativos ocultados dos leitores de tela.
* Controles de perfil e atalhos com áreas de toque revisadas.
* Botões de Histórico e Treinar com dimensões mínimas de
  48 por 48 unidades lógicas e orientações acessíveis.

A navegação por abas mantém os navegadores reais, a seleção
exclusiva, os parâmetros das rotas e o comportamento de retorno.

A configuração visual da barra de navegação permanece inalterada.

### Calendário de atividades

O calendário identifica o dia atual, os dias selecionados,
os dias indisponíveis e os estados de carregamento e falha.

Os controles de navegação mensal possuem dimensões de
48 por 48 unidades lógicas.

A altura mínima das células mensais foi ampliada para 48 unidades,
preservando a distribuição em sete colunas.

O diário de treinos possui cabeçalhos semânticos e comunicação
acessível do estado vazio.

Treinos de mesmo nome recebem identificação ordinal contextual.
O horário de conclusão está disponível na orientação acessível
dos registros.

Os rótulos são construídos em tempo linear em relação ao número
de sessões do dia selecionado, sem modificar sua ordenação.

A seleção de datas, os intervalos de consulta, a paginação,
a recuperação de falhas e a navegação para o histórico
permanecem inalterados.

### Identidade visual e movimento

O componente FitMapBrand identifica semanticamente a marca
como uma imagem com o rótulo FIT Map.

As variantes, imagens, dimensões e seleção de assets
permanecem inalteradas.

O calendário passou a reutilizar o hook useReducedMotion,
eliminando a implementação duplicada da preferência.

O hook mantém a redução de movimento enquanto a preferência
não é conhecida ou quando sua consulta falha.

Uma resposta inicial atrasada não sobrescreve uma preferência
mais recente recebida do dispositivo.

As animações de layout e seleção continuam condicionadas
à preferência de movimento.

Os parâmetros das animações existentes, os componentes 3D
e a identidade Orange Fusion foram preservados.

### Validação

A entrega acrescentou 83 testes automatizados:

* 16 de autenticação;
* 13 de perfil;
* 35 de progresso;
* 7 da Home;
* 3 de navegação;
* 4 de acessibilidade do calendário;
* 5 de identidade visual e movimento.

Os números incluem testes de acessibilidade e caracterização
de comportamentos existentes.

A regressão direcionada final aprovou 246 testes em 19 suítes.

A regressão mobile completa aprovou 866 testes em 55 suítes,
com TypeScript, ESLint e Prettier aprovados.

Em 18/11/2026, o desenvolvedor confirmou 36 de 36 verificações
físicas no iPhone via Expo Go, com backend local.

A avaliação incluiu VoiceOver, ampliação de texto,
redução de movimento e persistência de dados de teste.

Os cenários físicos estão registrados na seção 5.6
de docs/testing.md.

### Limitações

As dimensões configuradas nos controles não constituem
medição física exaustiva de todos os alvos de toque.

A largura das células do calendário depende da área disponível
para suas sete colunas e permanece sujeita à avaliação transversal.

A verificação com texto ampliado representa a configuração
avaliada, não todos os tamanhos de fonte e tela.

A validação em Expo Go não constitui certificação WCAG,
nem comprova compatibilidade com builds nativos.

A validação Android e o comportamento dos seletores nativos
de preferências nessa plataforma permanecem pendentes.

A validação física utilizou dados de teste. A remoção posterior
desses registros não foi confirmada nesta etapa.

O aviso intermitente React act do VirtualizedList na suíte
MapGymPreview.test.tsx permanece registrado para a QUALITY-01.

As verificações transversais remanescentes pertencem à ACC-02.5.

A integração permanece condicionada à resolução da Issue #84
e à aprovação dos checks obrigatórios de CI.

---

## Acessibilidade transversal (ACC-02.5)

A etapa transversal consolida as melhorias de acessibilidade
das quatro entregas anteriores, considerando os requisitos
NFR-ACC-001 a NFR-ACC-006 sem declarar conformidade integral.

### Áreas de toque (ACC-02.5-A)

Foram ampliadas as dimensões de controles do catálogo,
da reordenação e remoção de exercícios e da restauração
de treinos arquivados.

Os controles avaliados possuem dimensões mínimas
ou áreas de interação adequadas ao contexto mobile.

As regras de criação, edição e restauração
de treinos foram preservadas.

### Legibilidade e responsividade (ACC-02.5-B)

Foram removidos limites desnecessários de linhas
nos resultados e sugestões do catálogo, nos endereços
e sites de academias, nos favoritos e nas sugestões
de localidades do mapa.

As sugestões do catálogo também receberam uma
área de toque mínima de 48 unidades de layout.

O cabeçalho do calendário permite quebra de linha
e preserva as dimensões dos controles de navegação.

As prévias compactas do mapa mantêm seus limites
intencionais de linhas. As sete colunas do calendário
continuam condicionadas à largura disponível.

### Redução de movimento (ACC-02.5-C)

O hook compartilhado useReducedMotion consulta
a preferência do dispositivo e acompanha alterações
durante a utilização do aplicativo.

Enquanto a preferência não é conhecida, ou quando
sua consulta falha, a redução de movimento permanece
ativa por precaução.

A proteção contra respostas assíncronas obsoletas
e a remoção dos listeners foram preservadas.

A etapa amplia o respeito a essa preferência para:

* execução de treinos;
* calendário de atividades;
* controles de autenticação;
* Home e histórico de treinos;
* detalhes e ações relacionadas a academias;
* controles pressionáveis do mapa;
* captura e confirmação de fotos de progresso;
* visualização ampliada de fotos;
* transições das pilhas de navegação;
* movimentos programáticos da câmera do mapa.

Os elementos decorativos 3D e a identidade Orange Fusion
permanecem disponíveis. As animações opcionais
são preservadas quando permitidas pelo dispositivo.

Indicadores funcionais de carregamento e representações
visuais de estados selecionados continuam disponíveis.

Nos movimentos programáticos da câmera, o mapa utiliza
animateToRegion no modo normal e fitToCoordinates
com animated: false no modo reduzido.

Os movimentos pendentes aguardam a disponibilidade
do mapa e de seu layout, preservando a solicitação
mais recente e a preferência de movimento vigente.

A movimentação automática ao pressionar marcadores
também é desabilitada no modo reduzido.

### Seletores multiplataforma (ACC-02.5-D)

O componente reutilizável SelectionModal substitui
os alertas de múltiplas opções do perfil.

A mudança evita depender do limite de três botões
do Alert.alert no Android:

* objetivo principal: cinco opções;
* experiência: três opções;
* meta semanal: sete opções;
* duração preferida: nove opções;
* unidades de medida: duas opções;
* aparência: três opções.

O componente utiliza Modal, ScrollView e Pressable
do React Native, sem novas dependências.

As opções apresentam semântica radio, estado checked,
indicador visual da seleção, dimensões mínimas de
48 por 48 unidades de layout e suporte a texto ampliado.

O cancelamento permanece disponível no rodapé,
com suporte ao onRequestClose e onAccessibilityEscape.

A tela de fundo é ocultada das tecnologias assistivas
enquanto o seletor está aberto.

O componente respeita os temas e a redução de movimento
e protege contra acionamentos duplicados.

As preferências esportivas continuam persistidas pela API.
A aparência permanece armazenada pelo ThemeProvider.

O salvamento da aparência possui controle independente
de concorrência, estado de processamento e tratamento
de falhas, sem bloquear as preferências esportivas.

Os alertas de validação, erros e confirmação de logout
permanecem preservados.

### Validação

A ACC-02.5 acrescentou 67 testes automatizados:

| Frente | Novos testes |
| --- | ---: |
| Áreas de toque | 3 |
| Legibilidade e responsividade | 6 |
| Redução de movimento | 43 |
| Seletores multiplataforma | 15 |
| Total | 67 |

A regressão de 19/11/2026 aprovou 933 testes mobile
em 56 suítes, com TypeScript, ESLint e Prettier aprovados.

A validação física de 19/11/2026 foi confirmada
pelo desenvolvedor no iPhone via Expo Go, com backend
local: 30 de 30 verificações aprovadas, sem ressalvas
relatadas.

O roteiro e os resultados consolidados estão
na seção 5.7 de [Testes](testing.md).

### Limitações e riscos residuais

Os testes automatizados validam contratos de interface,
estilos, estados e comandos de movimento, mas não
substituem a validação nativa.

A avaliação física representa a configuração testada.
Não constitui certificação WCAG, medição exaustiva
dos alvos de toque ou cobertura de todas as escalas de texto.

Android, TalkBack, diferentes dimensões de tela
e builds nativos continuam sem validação física
específica nesta etapa.

O enquadramento reduzido do mapa pode apresentar
diferenças de posicionamento conforme o provedor nativo,
o viewport e os limites geográficos.

A alteração da preferência não garante o cancelamento
imediato de uma animação nativa já iniciada.

A remoção dos dados utilizados na validação física
não foi confirmada.

O aviso intermitente de VirtualizedList permanece
registrado para QUALITY-01.

A integração depende da resolução da Issue #84
e da aprovação dos checks obrigatórios de CI.

---

## Filtros de descoberta de academias

A implementação da FUNC-05 atende ao requisito funcional
`FR-GYM-010`, permitindo filtrar os resultados de busca
de academias por atributos disponíveis no aplicativo.

### Comportamento

Os filtros estão disponíveis após uma busca que retorna
academias e incluem:

* busca parcial pelo nome da academia, ignorando acentos,
  capitalização e espaços nas extremidades da consulta;
* distância máxima de 1, 3 ou 5 quilômetros;
* opção para visualizar todas as distâncias;
* combinação dos filtros de nome e distância;
* limpeza dos filtros sem executar uma nova busca.

A filtragem é realizada localmente sobre os resultados
recebidos do backend. A lista, os marcadores do mapa,
o contador e a prévia da academia selecionada utilizam
o mesmo conjunto de resultados visíveis.

Quando uma academia selecionada deixa de atender aos
filtros, sua seleção é removida. Quando permanece visível,
a seleção é preservada.

Os filtros são reiniciados ao iniciar uma nova busca
efetiva por texto, sugestão de localidade ou localização
atual. A seção de academias favoritas permanece independente
dos filtros de busca.

### Localização e distância

A filtragem por distância utiliza a localização atual do
dispositivo, obtida mediante permissão do usuário.

Sem coordenadas válidas do dispositivo, os filtros de
distância ficam desabilitados e a filtragem por nome
continua disponível.

Ao detectar uma permissão negada ou falha na obtenção
da localização durante uma solicitação explícita, o aplicativo
remove a referência de localização anterior e a restrição
de distância, preservando os resultados disponíveis.

Academias sem coordenadas válidas podem aparecer na lista
quando não existe uma restrição de distância ativa,
mas não são representadas como marcadores no mapa.

As distâncias são geográficas, em linha reta, e não
representam trajetos por vias públicas.

### Organização técnica

A lógica de filtragem está isolada em
`src/utils/gymResultFilters.ts`.

O módulo realiza:

* normalização dos nomes;
* validação de coordenadas geográficas;
* cálculo seguro das distâncias;
* aplicação combinada dos filtros;
* preservação da identidade e da ordem original dos resultados;
* filtragem sem mutação dos dados recebidos.

A integração com a interface ocorre em
`src/screens/MapScreen.tsx`.

Não foram introduzidas dependências, chamadas adicionais
à API, alterações no contrato HTTP ou mudanças no banco
de dados para implementar a funcionalidade.

### Validação

A implementação foi desenvolvida com testes unitários e
de integração, incluindo as fases Red e Green.

Evidências da validação local da FUNC-05:

* 35 novos testes unitários;
* 15 novos testes de integração;
* 491 testes mobile aprovados em 37 suítes;
* 441 testes da baseline preservados;
* TypeScript, ESLint e Prettier aprovados;
* árvore de dependências npm validada;
* nenhum aviso de sincronização React `act`
  na execução final da regressão.

A execução no iPhone via Expo Go confirmou o funcionamento
dos filtros de nome e distância, incluindo a habilitação
dos limites de distância após obter a localização atual.

A validação manual não constitui evidência de testes
completos em todas as plataformas, versões de sistema,
configurações de acessibilidade ou builds nativos.

### Limitações

Os filtros operam somente sobre as academias retornadas
pelo provedor de busca. Não garantem a cobertura de todas
as academias existentes em uma região.

Preço, avaliações, equipamentos e outras características
não disponíveis no contrato atual de busca não são utilizados
como critérios de filtragem.

A ordenação selecionável dos resultados é tratada
separadamente pela FUNC-06, associada ao requisito
`FR-GYM-011`, conforme a seção seguinte.

## Ordenação de resultados de academias

A implementação da FUNC-06 atende ao requisito funcional
`FR-GYM-011`, permitindo selecionar a ordenação dos
resultados de busca de academias.

### Comportamento

A ordenação está disponível após uma busca que retorna
academias e oferece três critérios:

* **Padrão:** preserva a ordem original dos resultados
  recebidos do provedor;
* **Mais próximas:** organiza as academias por distância
  crescente da localização atual do dispositivo;
* **Nome A–Z:** organiza os resultados alfabeticamente,
  ignorando acentos, capitalização e espaços nas
  extremidades dos nomes.

A ordenação atua sobre o conjunto de resultados que
atende aos filtros ativos da FUNC-05.

Os filtros e a ordenação possuem estados independentes.
Limpar os filtros preserva o critério de ordenação
selecionado. Alterar a ordenação não remove os filtros
ativos nem a seleção de uma academia que permanece visível.

O critério padrão é restaurado ao iniciar uma nova busca
efetiva por texto, sugestão de localidade ou localização
atual.

Uma tentativa de busca com consulta vazia não modifica
os resultados existentes nem a ordenação selecionada.

A seção de academias favoritas permanece independente
da ordenação dos resultados de descoberta.

### Ordenação por distância

A ordenação por proximidade depende de coordenadas
válidas do dispositivo, obtidas mediante permissão
do usuário.

Sem uma referência válida de localização, o controle
Mais próximas permanece desabilitado.

As academias com distância desconhecida ou coordenadas
inválidas são posicionadas após aquelas com distância
calculável, preservando sua ordem relativa original.

Distâncias iguais preservam a ordem original dos
resultados. As distâncias são geográficas, em linha
reta, e não representam trajetos por vias públicas.

Quando uma solicitação explícita de localização falha
ou tem sua permissão negada, a referência anterior
é removida. Se a ordenação por distância estiver ativa,
o critério padrão é restaurado.

A ordenação alfabética permanece disponível e é
preservada nessas situações.

### Organização técnica

A lógica de ordenação está isolada em
`src/utils/gymResultSorting.ts`.

O módulo exporta:

* `GymResultSort`: critérios de ordenação suportados;
* `DEFAULT_GYM_RESULT_SORT`: critério padrão;
* `sortGymResults`: função responsável pela ordenação.

O processamento utiliza os recursos de validação de
coordenadas e cálculo de distância existentes no módulo
`src/utils/gymResultFilters.ts`.

As chaves de ordenação são calculadas uma vez por
resultado durante cada processamento. Os índices
originais são utilizados para preservar a estabilidade
nos empates.

A função retorna um novo array sem modificar os
objetos originais nem alterar sua identidade.

A integração em `src/screens/MapScreen.tsx` utiliza
estados independentes para filtros e ordenação,
com resultados derivados por meio de `useMemo`.

A lista, os marcadores, o contador e a prévia da
academia selecionada utilizam o conjunto visível
de resultados.

Os controles reutilizam os estilos e componentes
visuais existentes, incluindo indicação de seleção,
estado desabilitado e área mínima de interação.

A ordenação é executada localmente, sem novas
dependências, chamadas adicionais à API, alterações
no contrato HTTP ou mudanças no banco de dados.

### Validação

A funcionalidade foi desenvolvida com testes
unitários e de integração nas fases Red e Green.

Evidências da validação local da FUNC-06:

* 20 novos testes unitários;
* 17 novos testes de integração;
* 37 novos testes automatizados no total;
* 491 testes da baseline preservados;
* 528 testes mobile aprovados em 38 suítes;
* TypeScript, ESLint e Prettier aprovados;
* árvore de dependências npm validada;
* nenhum aviso React `act` na regressão final.

Um aviso de sincronização da `VirtualizedList`
foi observado durante uma execução anterior dos
testes de integração, mas não voltou a ocorrer
na regressão completa. Sua causa não foi considerada
definitivamente eliminada.

A validação física realizada no iPhone via Expo Go
confirmou os seguintes cenários:

* busca por cidade com ordenação padrão;
* ordenação alfabética;
* retorno à ordem original;
* obtenção da localização e habilitação da proximidade;
* apresentação das distâncias em ordem crescente;
* combinação de ordenação e filtros;
* preservação da ordenação ao limpar filtros;
* preservação da seleção no mapa ao reordenar;
* restauração da ordem padrão em uma nova busca;
* funcionamento dos controles nos temas claro e escuro.

### Limitações

A ordenação opera exclusivamente sobre os resultados
recebidos na busca atual. Não representa uma classificação
global de todas as academias existentes na região.

A implementação não utiliza avaliações, preços ou
outros atributos indisponíveis no contrato de busca.

A validação física foi realizada no iPhone via Expo Go.
Não constitui evidência de validação completa no Android,
em builds nativos ou em todas as configurações de
acessibilidade.

## Observações durante a execução do treino

A implementação da FUNC-07 atende ao requisito funcional
`FR-SESSION-009`, permitindo registrar observações gerais
de uma sessão de treino e observações individuais da
execução de cada exercício.

### Comportamento

As observações estão disponíveis na tela de execução
de uma sessão ativa.

O usuário pode:

* registrar uma observação geral do treino;
* registrar observações independentes por exercício;
* editar observações anteriormente persistidas;
* excluir uma observação, limpando o campo e salvando;
* descartar alterações locais sem atualizar o servidor.

As orientações provenientes do planejamento permanecem
separadas das observações registradas durante a execução.

O salvamento é explícito e utiliza o controle
Salvar observação.

Uma alteração somente é considerada persistida
após a confirmação do conteúdo pelo backend.

O controle de salvamento permanece desabilitado
quando não existem alterações efetivas.

Durante a digitação, o texto original é preservado.
A normalização remove espaços nas extremidades antes
do envio, mantendo o conteúdo interno, inclusive
quebras de linha.

Textos vazios ou constituídos exclusivamente por
espaços reconhecidos pela normalização são enviados
como `null`.

### Gerenciamento dos rascunhos

Os rascunhos são mantidos separadamente do estado
persistido retornado pelo servidor.

Cada conjunto de rascunhos pertence a uma sessão
específica, com uma observação geral e alterações
independentes identificadas por exercício.

O registro ou a remoção de séries, a conclusão ou
reabertura de exercícios e outras atualizações da
sessão não devem descartar observações pendentes.

Após um salvamento bem-sucedido, somente o rascunho
correspondente ao conteúdo confirmado é removido.
Os demais rascunhos permanecem disponíveis.

Falhas de comunicação e respostas incompatíveis com
a observação enviada preservam o texto para nova
tentativa.

O descarte de alterações restaura o conteúdo
persistido sem realizar uma requisição à API.

A troca da sessão elimina os rascunhos pertencentes
à sessão anterior. Identificadores de exercícios
inexistentes ou removidos não são reaproveitados.

### Proteção de navegação e concorrência

A tela utiliza `usePreventRemove`, do React Navigation,
para impedir a saída enquanto existirem alterações
não salvas nas observações.

A finalização e o cancelamento do treino também
são bloqueados nessas condições.

O usuário recebe uma orientação para salvar ou
descartar as alterações antes de prosseguir.

As operações de atualização da sessão compartilham
um bloqueio síncrono de requisições e estados de
carregamento da interface.

Durante uma operação pendente, os controles de
edição, salvamento, descarte e demais mutações
da sessão permanecem indisponíveis.

O objetivo é impedir operações concorrentes
originadas pela mesma tela e preservar a consistência
entre os rascunhos locais e as respostas recebidas.

### Organização técnica

A lógica dos rascunhos está isolada em
`src/utils/workoutNoteDrafts.ts`.

O módulo é responsável por:

* normalização compatível com `str.strip()` do Python;
* leitura do conteúdo persistido ou do rascunho local;
* atualização imutável dos rascunhos;
* identificação de alterações não salvas;
* reconciliação com as respostas do servidor;
* isolamento entre sessões e exercícios.

A construção dos registros de rascunhos utiliza
`Object.fromEntries()` para tratar os identificadores
como propriedades próprias, evitando interferência
de propriedades herdadas do JavaScript.

O componente reutilizável
`src/components/WorkoutNoteEditor.tsx`
centraliza os campos de texto, os estados de
salvamento e os controles de salvar e descartar.

A integração está implementada em
`src/screens/WorkoutSessionScreen.tsx`.

Os componentes reutilizam os tokens de tema
existentes e oferecem suporte aos temas claro
e escuro.

### Comunicação com o backend

A funcionalidade reutiliza os métodos autenticados
existentes em `src/services/trainingSessions.ts`:

* `updateWorkoutSession`;
* `updateExerciseExecution`.

Os contratos HTTP utilizados são:

* `PATCH /api/v1/training/sessions/{session_id}`;
* `PATCH /api/v1/training/sessions/{session_id}/exercises/{execution_id}`.

O corpo da requisição contém o campo `notes`,
com uma string normalizada ou `null`.

O salvamento de uma observação individual não
envia o campo `completed`, preservando o estado
de conclusão do exercício.

As respostas são verificadas quanto ao identificador
da sessão, à existência do exercício correspondente
e ao conteúdo efetivamente confirmado.

O backend existente realiza a validação da
autenticação, da propriedade da sessão e do estado
ativo antes de permitir alterações.

Sessões encerradas não podem receber novas
alterações nas observações.

O histórico de treino preserva as observações
persistidas, utilizando a apresentação existente
em `src/screens/WorkoutHistoryDetailsScreen.tsx`.

Não foram necessários novos endpoints, alterações
nos modelos de produção, migrations, dependências
ou modificações nos contratos de comunicação.

### Validação

A implementação foi desenvolvida utilizando testes
unitários e de integração nas fases Red e Green,
seguidas de testes complementares de robustez.

Evidências da validação local da FUNC-07:

* 28 novos testes unitários mobile;
* 20 novos testes de integração mobile;
* 6 novos testes de integração backend;
* 54 novos testes automatizados no total;
* 528 testes mobile da baseline preservados;
* 1117 testes backend da baseline preservados;
* 576 testes mobile aprovados em 39 suítes;
* 1123 testes backend aprovados;
* 1699 testes automatizados aprovados na regressão;
* TypeScript, ESLint, Prettier, Ruff e Pyright aprovados;
* integridade dos lockfiles e dependências validada.

Os testes backend foram executados em PostgreSQL
isolado, na porta 5434, sem utilizar o banco de
desenvolvimento do aplicativo.

A cobertura inclui persistência, atualização,
exclusão, normalização, recuperação no histórico,
isolamento entre usuários, rejeição de requisições
inválidas e proteção de sessões encerradas.

A regressão completa apresentou um aviso conhecido
de depreciação da integração Starlette/AnyIO.

Também ocorreu um aviso React `act` na suíte
`MapGymPreview.test.tsx`, relacionado à atualização
assíncrona da `VirtualizedList`.

Esse aviso é intermitente, já havia sido observado
anteriormente e não representa uma falha dos testes
da FUNC-07. Sua causa não foi considerada resolvida.

### Validação física

A validação realizada no iPhone via Expo Go
confirmou 14 cenários:

* apresentação dos campos gerais e individuais;
* registro e salvamento da observação geral;
* registro e salvamento da observação individual;
* edição de observações persistidas;
* exclusão explícita de observações;
* preservação de rascunhos independentes;
* preservação durante o registro de séries;
* preservação durante a conclusão de exercícios;
* descarte de alterações;
* proteção pela seta e pelo gesto lateral de retorno;
* bloqueio de finalização e cancelamento;
* persistência das observações ao retomar a sessão;
* apresentação das observações no histórico;
* teclado, acentuação e temas claro e escuro.

### Limitações

Os rascunhos não salvos permanecem exclusivamente
em memória. Não são persistidos em armazenamento
local e podem ser perdidos no encerramento forçado
do aplicativo.

A funcionalidade não implementa salvamento
automático nem sincronização offline.

O contrato atual das observações não define
um limite específico de caracteres. Esse aspecto
permanece sujeito à avaliação de limites de entrada
e segurança.

O bloqueio de operações da interface não constitui
um mecanismo de controle de versões para edições
simultâneas realizadas em dispositivos diferentes.

A proteção de navegação não impede desmontagens
externas da tela, encerramentos forçados ou a
expiração da sessão de autenticação.

A validação física foi realizada no iPhone via
Expo Go. Não constitui evidência de validação
completa no Android, em builds nativos ou em
todas as configurações de acessibilidade.

## Filtros do histórico de treinos

A FUNC-08 atende ao requisito FR-HISTORY-005,
classificado como Professional, permitindo filtrar
as sessões concluídas apresentadas no histórico.

### Comportamento

A tela dedicada de histórico disponibiliza:

* pesquisa parcial pelo nome do treino;
* seleção de todos os períodos;
* filtro dos últimos 7 dias;
* filtro dos últimos 30 dias;
* filtro dos últimos 90 dias;
* combinação da pesquisa com o período;
* contador de sessões encontradas;
* limpeza simultânea dos filtros.

A pesquisa ignora diferenças entre letras
maiúsculas e minúsculas, acentos e espaços
nas extremidades do texto pesquisado.

A combinação de filtros exige que todos os
critérios ativos sejam atendidos.

O nome pesquisado corresponde ao nome histórico
registrado na sessão, sem incluir observações
ou identificadores.

A ordem original fornecida pelo backend
permanece preservada.

A interface diferencia um histórico realmente
vazio da ausência de resultados correspondentes
aos filtros selecionados.

Os filtros permanecem selecionados ao acessar
os detalhes de uma sessão e retornar ao histórico.

### Critérios temporais

A referência temporal utilizada é `completedAt`,
correspondente à conclusão da sessão.

Os períodos representam dias de calendário locais,
incluindo o dia atual.

O limite inicial é inclusivo e corresponde
à meia-noite do primeiro dia do intervalo.

O limite final é exclusivo e corresponde
à meia-noite do dia seguinte ao dia atual.

Assim, os filtros não representam intervalos
fixos de 24 horas multiplicados pelo número
de dias selecionados.

Datas inválidas são excluídas quando existe
um filtro temporal ativo, mas permanecem na
listagem quando nenhum período está selecionado.

### Organização técnica

A lógica de filtragem está isolada em
`src/utils/workoutHistoryFilters.ts`.

O módulo utiliza uma função pura que recebe
as sessões, os filtros e uma data de referência.

A normalização textual utiliza Unicode NFD
para permitir pesquisas sem distinção de acentos.

A filtragem não modifica o array original,
as sessões ou a data de referência.

A integração está implementada em
`src/screens/WorkoutHistoryScreen.tsx`.

A FUNC-08 preservou o calendário existente.
A integração paginada posterior é descrita
na seção PERF-03 deste documento.

A interface reutiliza os tokens de tema existentes,
incluindo suporte aos temas claro e escuro.

Os controles possuem rótulos de acessibilidade,
papéis apropriados e indicação da seleção
dos filtros de período.

### Carregamento e concorrência

A tela invalida requisições anteriores quando
perde o foco ou é desmontada.

Somente a geração vigente pode publicar resultados
ou alterar os estados de erro e carregamento.

Os estados de carregamento inicial, atualização,
paginação incremental e filtragem completa
são diferenciados na integração da PERF-03.

A interface oferece recuperação explícita após
falhas de comunicação e cursores inválidos.

### Comunicação com o backend

Na implementação original da FUNC-08, o histórico
era carregado integralmente por:

* `GET /api/v1/training/history`.

A filtragem era realizada localmente sem novas
requisições ao alterar os critérios.

A PERF-03 substitui o carregamento inicial por:

* `GET /api/v1/training/history/page`.

A lógica pura de filtragem permanece preservada.

Quando existe um filtro ativo e a coleção ainda
está incompleta, a tela pode obter o histórico
integral pelo endpoint legado autenticado.

Após completar a coleção, novas alterações
dos filtros são realizadas localmente.

O backend permanece responsável pela autenticação,
pelo isolamento dos usuários e pela seleção
das sessões concluídas.

### Validação

A implementação foi desenvolvida em etapas
Red e Green, seguidas de integração da interface
e testes complementares de concorrência.

Evidências da validação local da FUNC-08:

* 32 novos testes unitários mobile;
* 21 novos testes de integração mobile;
* 53 novos testes automatizados no total;
* 32 testes de filtragem aprovados nos fusos
  America/Sao_Paulo, UTC e America/New_York;
* 8 testes existentes do calendário preservados;
* 61 testes direcionados aprovados;
* 576 testes mobile da baseline preservados;
* 1123 testes backend da baseline preservados;
* 629 testes mobile aprovados em 41 suítes;
* 1123 testes backend aprovados;
* 1752 testes automatizados aprovados na regressão;
* TypeScript, ESLint, Prettier, Ruff e Pyright aprovados;
* integridade dos lockfiles e dependências validada.

As 96 execuções nos três fusos horários
correspondem aos mesmos 32 testes unitários,
sem duplicar a contagem de testes distintos.

Os testes estão organizados em:

* `src/utils/__tests__/workoutHistoryFilters.test.ts`;
* `src/screens/__tests__/WorkoutHistoryScreen.test.tsx`.

A cobertura inclui pesquisa, normalização,
intervalos temporais, combinação de filtros,
imutabilidade, preservação da ordem, estados
vazios, navegação, retry, atualização e
proteção contra respostas obsoletas.

Os testes backend foram executados em PostgreSQL
isolado, na porta 5434, sem utilizar o banco
de desenvolvimento da aplicação.

A regressão apresentou novamente o aviso
conhecido de depreciação Starlette/AnyIO
e o aviso React `act` na suíte
`MapGymPreview.test.tsx`.

Esses avisos não foram considerados resolvidos
e não representam falhas dos testes da FUNC-08.

### Validação física

A validação manual realizada no iPhone via Expo Go,
em 16/11/2026, foi confirmada pelo desenvolvedor
para os 15 cenários do roteiro:

* apresentação inicial do histórico;
* pesquisa por nome;
* pesquisa sem distinção de acentos e maiúsculas;
* filtro de 7 dias;
* filtro de 30 dias;
* filtro de 90 dias;
* combinação de nome e período;
* contador de resultados;
* estado vazio filtrado;
* limpeza dos filtros;
* acesso aos detalhes da sessão;
* preservação dos filtros ao retornar;
* comportamento do teclado;
* tema claro;
* tema escuro.

### Limitações

A filtragem depende de uma coleção completa
para garantir resultados corretos.

A PERF-03 introduz carregamento inicial limitado,
mas mantém a consulta integral sob demanda quando
um filtro é aplicado sobre uma coleção parcial.
Essa estratégia preserva a semântica dos filtros,
sem eliminar todos os carregamentos extensos.

A referência temporal é recalculada durante
as renderizações da tela. Não existe
um temporizador específico para atualização
automática dos filtros à meia-noite.

A invalidação de requisições obsoletas
é lógica e não constitui cancelamento
do transporte HTTP.

Os filtros permanecem em memória enquanto
a tela permanece montada. Não existe persistência
das preferências após o encerramento do aplicativo.

A validação física no iPhone via Expo Go
não constitui evidência de validação completa
no Android, em builds nativos ou em todas
as configurações de acessibilidade.

## Paginação do histórico, calendário e fotos (PERF-03)

A PERF-03 atende ao NFR-PERF-003 e complementa
as otimizações de desempenho do Ciclo 06.

O objetivo é evitar o carregamento inicial integral
de coleções extensas, preservando os contratos,
a privacidade e o comportamento funcional existente.

### Serviços de comunicação

A infraestrutura compartilhada está em:

* `src/services/pagination.ts`;
* `src/services/trainingSessions.ts`;
* `src/services/progress.ts`.

O contrato utiliza páginas com `items` e
`nextCursor`, normalizado a partir de `next_cursor`
na resposta HTTP.

O limite padrão é 50 registros.

Os serviços utilizam:

* `getWorkoutHistoryPage`;
* `getProgressPhotosPage`.

Os métodos legados permanecem disponíveis
para compatibilidade.

As requisições continuam utilizando o fluxo
autenticado existente.

### Histórico de treinos

A tela `WorkoutHistoryScreen.tsx` carrega inicialmente
a primeira página do histórico.

O usuário solicita páginas adicionais por um botão
explícito. Os registros são acrescentados na ordem
recebida, com eliminação de identificadores duplicados.

O contador diferencia a quantidade carregada
da quantidade completa de resultados.

Quando o conjunto ainda é parcial e existe
um filtro ativo, o endpoint legado é consultado
sob demanda para obter a coleção completa.

A lógica de filtragem da FUNC-08 permanece local.
A aplicação evita apresentar resultados filtrados
incompletos como definitivos.

Após obter a coleção completa, alterar ou limpar
os critérios não exige nova consulta para cada
mudança do filtro.

Falhas de paginação preservam os dados disponíveis.
Cursores inválidos ou que não avançam permitem
reiniciar a consulta.

Gerações de requisição protegem contra respostas
obsoletas, incluindo mudanças de foco e a
substituição de uma paginação por uma consulta
integral do histórico.

### Calendário de atividades

O componente `WorkoutActivityCalendar.tsx`
utiliza intervalos temporais limitados.

No estado recolhido, consulta a semana atual:

* segunda-feira à meia-noite, inclusive;
* próxima segunda-feira à meia-noite, exclusive.

No estado expandido, consulta o mês visível:

* primeiro dia do mês, inclusive;
* primeiro dia do mês seguinte, exclusive.

As fronteiras são calculadas no calendário local
e convertidas para timestamps ISO antes do envio.

Todas as páginas do intervalo são percorridas
antes da publicação dos indicadores completos.

O componente elimina duplicações por ID
e interrompe cursores repetidos ou páginas
que não avançam.

Mudar o intervalo ou perder o foco invalida
a resposta anterior e impede a continuação
da paginação obsoleta.

Uma falha intermediária não publica resumos
parciais como se representassem o mês completo.

Selecionar um dia já carregado não requer
nova consulta para o mesmo intervalo.

O retry reinicia o intervalo desde a primeira página.

O agrupamento de sessões, as animações,
a navegação para detalhes e os temas existentes
foram preservados.

### Fotos de progresso

A tela `ProgressScreen.tsx` utiliza a primeira página
das fotos durante o carregamento inicial.

As consultas de estatísticas e desempenho permanecem
no carregamento inicial da tela.

O botão de carregar mais fotos solicita apenas
a próxima página da galeria.

A interface impede solicitações simultâneas da
mesma operação de paginação e elimina duplicações
por identificador.

Falhas de página preservam as imagens disponíveis.
Um cursor inválido ou repetido permite reiniciar
somente a galeria, sem repetir as estatísticas.

A tela protege os resultados das requisições
por geração e invalidação de foco.

Uploads concluídos durante uma atualização vigente
são preservados na nova coleção.

Respostas obsoletas de uploads não atualizam
a interface de uma geração posterior.

A captura de imagens, sua normalização,
o armazenamento privado e a visualização
ampliada autenticada permanecem preservados.

A ausência de dados durante uma requisição
não é apresentada como um estado vazio definitivo.

### Validação automatizada

A implementação acrescenta 46 testes mobile:

| Área | Novos testes |
| --- | ---: |
| Serviços de paginação | 10 |
| Histórico e concorrência | 16 |
| Calendário | 8 |
| Fotos de progresso | 12 |
| Total | 46 |

Os testes foram desenvolvidos por etapas Red e Green.
Os testes anteriores de filtragem, captura e
visualização foram preservados.

A fixture do visualizador foi adaptada ao contrato
paginado, sem modificar suas asserções originais.

Resultados:

* 125 testes direcionados aprovados em 8 suítes;
* 15 testes de captura e visualização aprovados;
* 16 testes do calendário aprovados em cada fuso:
  America/Sao_Paulo, UTC e America/New_York;
* 675 testes mobile aprovados em 44 suítes;
* 1.154 testes backend aprovados;
* 1.829 testes automatizados aprovados;
* 77 novos testes da PERF-03;
* TypeScript, ESLint, Prettier, Ruff e Pyright aprovados.

A repetição dos testes em diferentes fusos
não aumenta a contagem de testes distintos.

Esses totais correspondem à branch da PERF-03
baseada no checkpoint da FUNC-08, antes da
integração das demais branches de desempenho.

### Validação física

Em 16/11/2026, o desenvolvedor confirmou
17 cenários no iPhone via Expo Go.

Histórico de treinos:

* carregamento inicial;
* filtro de registro fora da primeira página;
* combinação de filtros;
* limpeza de filtros;
* carregamento incremental;
* detalhes do treino.

Calendário:

* semana atual;
* mês atual;
* mês anterior;
* detalhes pelo calendário.

Fotos de progresso:

* galeria inicial;
* próxima página;
* visualizador privado;
* novo upload.

Validação complementar:

* tema escuro;
* atualização ao retornar;
* recuperação de conexão.

A conta exclusiva de validação continha
65 treinos sintéticos: 55 no mês atual
e 10 no mês anterior.

A galeria continha 55 imagens sintéticas
privadas, além de uma imagem enviada
durante a validação.

A conta de teste, seus treinos e os 56
objetos privados foram removidos após
a conclusão dos testes físicos.

Os dados originais foram preservados.

### Limitações

O carregamento incremental não constitui
virtualização integral das listas.

Os registros já carregados continuam em memória.
O calendário pode realizar várias requisições
para completar um intervalo com muitas sessões.

A filtragem de históricos parcialmente carregados
pode exigir uma resposta integral do endpoint legado.

A invalidação de respostas obsoletas é lógica.
Ela não cancela necessariamente o transporte HTTP
nem desfaz uploads já aceitos pelo servidor.

A paginação não proporciona uma visão transacional
imutável de uma coleção durante alterações concorrentes.

A recuperação de cursores pode reiniciar a coleção.

Não existe cache de meses do calendário nem
persistência local de todas as páginas carregadas.

A validação em três fusos não constitui cobertura
exaustiva das transições de horário de verão.

A validação em Expo Go não substitui testes
em Android, builds nativos ou produção.

Os detalhes do contrato, dos índices e dos
benchmarks estão em `backend/README.md`.

## Autenticação

O FitMap utiliza autenticação gerenciada pelo backend FastAPI e persistida em PostgreSQL.
O fluxo atual inclui cadastro, login, renovação e rotação de refresh tokens, restauração
controlada da sessão e logout. O aplicativo utiliza Expo SecureStore para o refresh token.

A rotina de limpeza de registros antigos de autenticação em AsyncStorage permanece
necessária para migração segura de instalações anteriores; ela **não** representa
uma autenticação local ativa nem o antigo módulo de exercícios do protótipo.

A verificação de e-mail e a recuperação de senha não estão implementadas na branch
`main` que será utilizada na apresentação do TCC. Permanecem como melhorias futuras,
sem depender da conclusão da infraestrutura Resend para a demonstração.
