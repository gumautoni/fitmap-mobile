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
* JavaScript
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
├── assets/
│   └── images/
│       └── logo-fitmap.png
└── src/
    ├── components/
    │   ├── CustomButton.js
    │   ├── CustomInput.js
    │   ├── GymCard.js
    │   └── TaskCard.js
    ├── context/
    │   └── AuthContext.js
    ├── navigation/
    │   ├── AppNavigator.js
    │   └── AuthNavigator.js
    ├── screens/
    │   ├── AddTaskScreen.js
    │   ├── CameraScreen.js
    │   ├── GymDetailsScreen.js
    │   ├── HomeScreen.js
    │   ├── LoginScreen.js
    │   ├── MapScreen.js
    │   ├── RegisterScreen.js
    │   └── TasksScreen.js
    ├── services/
    │   ├── geocoding.js
    │   ├── location.js
    │   └── overpass.js
    └── utils/
        ├── distance.js
        └── storage.js
```

## Pré-requisitos

Antes de executar o projeto, é necessário ter instalado:

* Node.js
* npm
* Expo CLI ou uso via `npx expo`
* Aplicativo Expo Go no celular, caso a execução seja feita em dispositivo físico

## Instalação

Clone ou extraia o projeto em uma pasta local e acesse a pasta principal do aplicativo:

```bash
cd FitMap
```

Instale as dependências:

```bash
npm install
```

## Execução do projeto

Para iniciar o projeto em modo padrão:

```bash
npm start
```

Para iniciar utilizando túnel, recomendado quando o celular não consegue acessar a rede local do computador:

```bash
npm run start:tunnel
```

Para iniciar em modo LAN:

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

Para executar no navegador:

```bash
npm run web
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

O FitMap utiliza AsyncStorage para armazenar dados localmente no dispositivo, incluindo:

* usuários cadastrados;
* sessão ativa;
* exercícios cadastrados;
* status dos exercícios;
* fotos vinculadas aos exercícios.

Por se tratar de um protótipo acadêmico, a autenticação é feita localmente. Em uma versão de produção, seria recomendada a utilização de um backend ou serviço de autenticação dedicado.

## Permissões utilizadas

O aplicativo solicita permissões para:

* localização: utilizada para buscar academias próximas ao usuário;
* câmera: utilizada para registrar fotos dos exercícios concluídos.

As permissões são solicitadas apenas quando necessárias para uso das funcionalidades correspondentes.

## Diferenciais do projeto

* Interface visual padronizada com identidade própria.
* Uso de mapa interativo.
* Busca por cidade, bairro ou localização atual.
* Fallback demonstrativo para evitar ausência total de resultados em regiões com poucos dados públicos.
* Registro de exercícios com foto.
* Fluxo completo de autenticação, navegação e gerenciamento local.
* Organização em componentes, telas, serviços, contexto e utilitários.

## Limitações conhecidas

* Os dados de academias dependem da disponibilidade e qualidade das informações públicas do OpenStreetMap.
* Telefones e sites podem não estar cadastrados para todas as academias.
* A mensalidade exibida é estimada.
* A autenticação é local e não utiliza servidor externo.
* Fotos e dados ficam armazenados localmente no dispositivo.

## Possíveis melhorias futuras

* Integração com backend próprio.
* Autenticação com Firebase ou outro serviço seguro.
* Cadastro real de academias parceiras.
* Avaliações de usuários.
* Favoritar academias.
* Histórico de exercícios.
* Perfil do usuário.
* Edição de exercícios cadastrados.
* Upload de fotos em nuvem.
* Filtros avançados por horário, modalidade, preço real e avaliação.
* Versão final para publicação em lojas de aplicativos.

## Status do projeto

Protótipo funcional desenvolvido para apresentação acadêmica na disciplina de Laboratório de Desenvolvimento de Aplicativos Híbridos.

## Equipe

Projeto desenvolvido por:

* Gustavo Mautoni
* Bryan Paz
* Pedro Queiroz 

## Licença

Este projeto foi desenvolvido para fins acadêmicos.
