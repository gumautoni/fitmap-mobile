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
