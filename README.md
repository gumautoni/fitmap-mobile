# FitMap

Aplicativo mobile desenvolvido para auxiliar usuários na localização de academias próximas e no acompanhamento de exercícios. O projeto reúne funcionalidades de busca por região, localização atual, visualização em mapa, comparação de academias e registro de exercícios concluídos com foto.

## Visão geral

O FitMap foi desenvolvido como um aplicativo híbrido utilizando React Native com Expo. A proposta do projeto é oferecer uma experiência simples e objetiva para pessoas que desejam encontrar academias próximas, comparar informações básicas e organizar sua rotina de exercícios.

O aplicativo permite que o usuário crie uma conta local, acesse a plataforma, pesquise academias por cidade ou bairro, utilize a própria localização, visualize opções no mapa e registre exercícios realizados.

## Funcionalidades principais

### Autenticação local

* Cadastro de usuário com nome, e-mail e senha.
* Validação de campos obrigatórios.
* Verificação de e-mail já cadastrado.
* Login com e-mail e senha.
* Manutenção da sessão do usuário.
* Logout com confirmação.

### Mapa de academias

* Busca de academias por cidade, bairro ou região.
* Uso da localização atual do usuário.
* Exibição das academias em mapa interativo.
* Listagem de academias encontradas.
* Filtros por:

  * academias mais próximas;
  * menor preço estimado;
  * academias com contato disponível.
* Destaque automático da academia com menor preço estimado.
* Fallback demonstrativo caso a busca pública não retorne resultados suficientes para a localização atual.

### Detalhes da academia

* Visualização do nome da academia.
* Endereço.
* Distância aproximada.
* Preço mensal estimado.
* Telefone, quando disponível.
* Site, quando disponível.
* Abertura de rota no Google Maps.
* Aviso quando o resultado for demonstrativo.
* Observação sobre dados públicos e possíveis limitações.

### Gerenciamento de exercícios

* Cadastro de novos exercícios.
* Descrição personalizada para cada exercício.
* Listagem dos exercícios cadastrados.
* Marcação de exercício como concluído ou pendente.
* Registro de foto para exercício específico.
* Exibição da foto no card do exercício.
* Exclusão de exercício com confirmação.
* Resumo com total de exercícios, concluídos, pendentes e registros com foto.

### Câmera

* Solicitação de permissão para uso da câmera.
* Registro de foto vinculada ao exercício selecionado.
* Marcação automática do exercício como concluído após o registro da foto.
* Tela de câmera com indicação do exercício que está sendo registrado.

## Identidade visual

O FitMap utiliza uma identidade visual própria, com logo desenvolvida para representar a união entre localização e atividade física. A interface segue uma paleta baseada em azul, azul escuro, verde e tons neutros, buscando transmitir modernidade, organização e clareza visual.

### Paleta principal

* Azul principal: `#2563EB`
* Azul escuro: `#111827`
* Verde de destaque: `#84CC16`
* Fundo claro: `#F3F4F6`
* Branco: `#FFFFFF`

A logo foi aplicada nas principais telas do aplicativo, incluindo login, cadastro, home, mapa, exercícios, detalhes da academia, câmera e tela de carregamento.

## Tecnologias utilizadas

* React Native
* Expo
* TypeScript e JavaScript em migração incremental
* React Navigation
* Expo Location
* Expo Camera
* React Native Maps
* AsyncStorage
* OpenStreetMap
* Nominatim
* Overpass API

## Estrutura do projeto

```text
FitMap/
├── App.js
├── app.json
├── package.json
├── tsconfig.json
├── .env.example
├── assets/
│   └── images/
│       └── logo-fitmap.png
├── docs/
│   └── mobile-development.md
└── src/
    ├── components/
    │   ├── CustomButton.js
    │   ├── CustomInput.js
    │   ├── GymCard.js
    │   └── TaskCard.js
    ├── config/
    │   └── environment.ts
    ├── context/
    │   └── AuthContext.js
    ├── navigation/
    │   ├── AppNavigator.tsx
    │   ├── AuthNavigator.tsx
    │   └── types.ts
    ├── screens/
    │   ├── AddTaskScreen.js
    │   ├── CameraScreen.js
    │   ├── GymDetailsScreen.tsx
    │   ├── HomeScreen.js
    │   ├── LoginScreen.js
    │   ├── MapScreen.tsx
    │   ├── RegisterScreen.js
    │   └── TasksScreen.js
    ├── services/
    │   ├── apiClient.ts
    │   ├── geocoding.ts
    │   ├── location.ts
    │   └── overpass.ts
    ├── types/
    │   ├── gym.ts
    │   └── location.ts
    └── utils/
        ├── distance.ts
        └── storage.js
```

## Pré-requisitos

Antes de executar o projeto, é necessário ter instalado:

* Node.js
* npm
* Expo Go no celular, caso a execução seja feita em dispositivo físico

## Instalação

Acesse a pasta principal do aplicativo e instale as dependências:

```bash
npm ci
```

## Configuração de ambiente

O projeto possui o arquivo `.env.example` com as configurações públicas necessárias para o aplicativo mobile.

No Windows, crie o arquivo local `.env` utilizando:

```powershell
Copy-Item .env.example .env
```

Configure a URL pública do backend:

```env
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:8000/api/v1
```

Em um dispositivo físico, `YOUR_LOCAL_IP` deve ser substituído normalmente pelo endereço IP local do computador que está executando o backend.

Variáveis `EXPO_PUBLIC_` ficam disponíveis no aplicativo cliente e nunca devem armazenar senhas, secrets, credenciais de banco de dados ou outras informações privadas do servidor.

## Execução do projeto

Para iniciar o projeto:

```bash
npm start
```

Para iniciar utilizando túnel:

```bash
npm run start:tunnel
```

Para iniciar utilizando a rede local:

```bash
npm run start:lan
```

Para executar no Android:

```bash
npm run android
```

Para executar no iOS:

```bash
npm run ios
```

Android e iOS são as plataformas mobile intencionalmente suportadas pelo projeto.

A versão web não é atualmente considerada uma plataforma suportada pelo FitMap.

## Validação do mobile

Para verificar a tipagem TypeScript:

```bash
npm run typecheck
```

Para executar o lint:

```bash
npm run lint
```

Para verificar a formatação:

```bash
npm run format:check
```

Para aplicar a formatação aos arquivos TypeScript e arquivos de configuração:

```bash
npm run format
```

Mais detalhes sobre o fluxo de desenvolvimento mobile estão disponíveis em:

```text
docs/mobile-development.md
```

## Como usar o aplicativo

1. Abra o aplicativo no Expo Go.
2. Crie uma nova conta informando nome, e-mail e senha.
3. Após o cadastro, acesse a tela inicial.
4. No mapa, pesquise uma cidade ou bairro para localizar academias.
5. Utilize os filtros para ordenar os resultados.
6. Toque em uma academia para visualizar detalhes e abrir a rota.
7. Acesse a área de exercícios.
8. Cadastre um novo exercício.
9. Marque exercícios como concluídos ou pendentes.
10. Registre uma foto vinculada ao exercício selecionado.
11. Exclua exercícios quando necessário.

## Fontes de dados

O aplicativo utiliza serviços públicos baseados no OpenStreetMap para busca e localização de academias. A busca por regiões é realizada por meio do Nominatim, enquanto a busca por academias próximas utiliza consultas à Overpass API.

Como os dados são provenientes de bases públicas, algumas academias podem apresentar informações incompletas, desatualizadas ou sem telefone/site cadastrado.

## Observações sobre preços

Os valores de mensalidade exibidos no aplicativo são estimativas utilizadas para fins de comparação no protótipo. O objetivo é permitir que o usuário visualize uma referência de preço entre as academias listadas, sem representar necessariamente o valor real praticado por cada estabelecimento.

## Armazenamento local

O FitMap ainda utiliza AsyncStorage em partes do protótipo para armazenar dados localmente no dispositivo, incluindo:

* usuários cadastrados;
* sessão ativa;
* exercícios cadastrados;
* status dos exercícios;
* fotos vinculadas aos exercícios.

A autenticação local existente pertence ao protótipo original e será substituída posteriormente pela autenticação segura integrada ao backend.

## Permissões utilizadas

O aplicativo solicita permissões para:

* localização: utilizada para buscar academias próximas ao usuário;
* câmera: utilizada para registrar fotos dos exercícios concluídos.

As permissões são solicitadas quando necessárias para as funcionalidades correspondentes.

## Migração para TypeScript

O FitMap está sendo migrado gradualmente de JavaScript para TypeScript.

Novos códigos de produção mobile devem utilizar TypeScript por padrão. Arquivos JavaScript existentes podem continuar funcionando durante a migração até que sejam modificados ou façam parte de uma implementação ativa.

O projeto mantém a verificação estrita de tipos habilitada.

## Diferenciais do projeto

* Interface visual padronizada com identidade própria.
* Uso de mapa interativo.
* Busca por cidade, bairro ou localização atual.
* Fallback demonstrativo para regiões com poucos dados públicos.
* Registro de exercícios com foto.
* Navegação tipada progressivamente com TypeScript.
* Cliente HTTP centralizado para futura integração com o backend.
* Configuração da API baseada em ambiente.
* Organização em componentes, telas, serviços, configuração, tipos, contexto e utilitários.

## Limitações conhecidas

* Os dados de academias dependem da disponibilidade e qualidade das informações públicas do OpenStreetMap.
* Telefones e sites podem não estar cadastrados para todas as academias.
* A mensalidade exibida é estimada.
* O fluxo atual de autenticação do protótipo ainda utiliza armazenamento local.
* Partes do aplicativo ainda estão em JavaScript durante a migração incremental.
* Fotos e dados do fluxo de exercícios ainda ficam armazenados localmente no dispositivo.

## Possíveis melhorias futuras

* Integração completa do aplicativo com o backend.
* Autenticação segura utilizando o backend próprio.
* Cadastro real de academias parceiras.
* Avaliações de usuários.
* Favoritar academias.
* Histórico de exercícios.
* Perfil do usuário.
* Edição de exercícios cadastrados.
* Upload de fotos em armazenamento privado.
* Filtros avançados por horário, modalidade, preço real e avaliação.
* Publicação futura nas lojas de aplicativos.

## Status do projeto

O FitMap está em desenvolvimento ativo e evoluindo de um protótipo acadêmico mobile para uma aplicação com backend próprio, banco de dados, arquitetura documentada e integração progressiva entre mobile e API.

## Equipe

O FitMap teve origem em um projeto acadêmico desenvolvido inicialmente por:

* Gustavo Mautoni
* Pedro Queiroz
* Bryan Paz

O projeto teve continuidade como Trabalho de Conclusão de Curso (TCC), atualmente desenvolvido por:

* Gustavo Mautoni
* Pedro Queiroz

A evolução técnica atual do projeto, incluindo arquitetura, backend, banco de dados, estruturação do repositório e modernização da aplicação mobile, está sendo conduzida por Gustavo Mautoni.


## My contributions

In this project, I contributed to:

* Mobile app structure and project organization
* Task management flow
* Camera registration flow for workout tasks
* Local data storage using AsyncStorage
* UI improvements and screen organization
* Project documentation and repository organization

## Licença

Este projeto foi desenvolvido para fins acadêmicos.
