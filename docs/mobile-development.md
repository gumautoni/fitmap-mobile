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
