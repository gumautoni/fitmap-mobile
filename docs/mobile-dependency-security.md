# Segurança das dependências mobile

## 1. Contexto

Checkpoint de auditoria e remediação DEP-03/DEP-04,
realizado em 13/11/2026 durante o Ciclo 04 de consolidação
técnica do FIT Map.

A implementação foi desenvolvida sobre o commit
`3de61b81bb1fba90642b3c739dabcb5070d16b15`,
na branch `fix/mobile-dependency-hardening`.

O objetivo foi reduzir a exposição a vulnerabilidades conhecidas,
preservando a compatibilidade com Expo SDK 58, React Native,
TypeScript, Jest e ESLint.

Ambiente local de validação:

- Windows;
- Node.js 22.23.4;
- npm 10.9.9;
- instalação reproduzível por `npm ci`.

Nenhum código funcional do aplicativo, contrato de API,
schema de banco ou dependência do backend foi alterado.

## 2. Evolução da auditoria

| Checkpoint | Total npm | Produção | Alta | Crítica |
|---|---:|---:|---:|---:|
| Baseline DEP-03 | 35 | 6 | 1 | 0 |
| Atualização Expo | 34 | 4 | 1 | 0 |
| Zod e Babel | 32 | 3 | 0 | 0 |
| Fingerprint e validação final | 30 | 0 | 0 | 0 |

A auditoria final completa registrou uma ocorrência de severidade
baixa e 29 moderadas, associadas a quatro advisories distintos.

A contagem de ocorrências do npm inclui vulnerabilidades
propagadas por dependências transitivas. Ela não equivale
ao número de advisories independentes ou de instalações
individuais de pacotes vulneráveis.

A classificação de produção segue a interpretação de
`npm audit --omit=dev`. Ela não demonstra, isoladamente,
quais dependências são incorporadas ao bundle distribuído.

## 3. Atualizações implementadas

| Dependência | Anterior | Validada |
|---|---|---|
| expo | 58.0.23 | 58.0.25 |
| expo-font | 58.0.11 | 58.0.12 |
| expo-linear-gradient | 58.0.3 | 58.0.4 |
| expo-location | 58.0.20 | 58.0.22 |
| expo-secure-store | 58.0.2 | 58.0.3 |
| expo-splash-screen | 58.0.13 | 58.0.14 |
| @babel/core | 7.29.0 | 7.29.13 |
| zod | 3.25.76 | 4.6.7 |
| @expo/fingerprint | 0.21.9 | 0.21.10 |
| minimatch do Fingerprint | 10.2.6 | 11.0.8 |

As seis atualizações diretas foram realizadas conforme
a recomendação do SDK Expo instalado.

Babel e Zod foram atualizados pela resolução natural do npm,
sem novos overrides para esses pacotes.

Advisories não reportados após as correções:

- Zod: [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- Babel: [GHSA-4x5r-pxfx-6jf8](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8).

Os demais requisitos diretos e os overrides preexistentes
foram preservados.

## 4. Override restrito do Fingerprint

O Fingerprint 0.21.10 declara `minimatch: ^10.2.6`.
A atualização natural dos consumidores não resolveu o
advisory moderado presente na árvore de produção.

Foi adotado exclusivamente o seguinte override adicional:

```json
{
  "@expo/fingerprint@0.21.10": {
    "minimatch": "11.0.8"
  }
}
```

A versão está fora da faixa principal originalmente declarada
pelo consumidor. Por esse motivo, sua adoção foi condicionada
a experimentos isolados e validação funcional.

O experimento utilizou uma cópia dos 370 arquivos rastreados,
sem copiar os arquivos reais de ambiente.

Resultados da comparação entre Minimatch 10.2.6 e 11.0.8:

| Verificação | Resultado |
|---|---|
| Instalação reproduzível | Aprovada nos dois cenários |
| Integridade da árvore npm | Aprovada nos dois cenários |
| Padrões de caminhos | 12 de 12 equivalentes |
| Fingerprint Android | 30 fontes; hash idêntico |
| Fingerprint iOS | 29 fontes; hash idêntico |
| Determinismo | Confirmado nos dois cenários |
| Novos advisories | Nenhum reportado |
| Auditoria de produção do candidato | Zero ocorrências |

A instalação real do projeto reproduziu a versão 11.0.8,
aprovou dois testes básicos adicionais da API Minimatch
e manteve os 441 testes mobile aprovados.

O override não se aplica globalmente ao Minimatch.
Outros consumidores mantêm suas versões próprias.

## 5. Alternativas investigadas e rejeitadas

### Atualizações naturais adicionais

As tentativas de atualizar Glob, Minimatch, Fingerprint
e Deepmerge dentro das restrições dos consumidores atuais
não eliminaram os respectivos advisories restantes.

Deepmerge 4.3.1 permanecia como a versão mais recente
disponível no registry consultado.

### Overrides de desenvolvimento

Foi avaliado um candidato com overrides restritos aos
consumidores Jest, Test Exclude e TypeScript ESLint.

A simulação reduziu as ocorrências totais de 30 para 23,
sem alterar as entradas de produção.

Entretanto, após `npm ci`, a verificação `npm ls --all`
retornou `ELSPROBLEMS`, identificando uma instância inválida
de Glob 10.5.0 na cadeia de `@jest/reporters` e `test-exclude`.

O candidato foi rejeitado antes da execução de seus testes
e de sua comparação de cobertura. Nenhum de seus cinco
overrides foi incorporado ao projeto.

### UUID e túnel Expo

O pacote `@expo/ngrok` 4.1.3 permanecia como a versão
mais recente consultada e declarava `uuid: ^3.3.2`.

Não foi forçada uma atualização incompatível do UUID,
preservando a configuração existente do túnel Expo.

O funcionamento real do túnel não foi novamente validado
durante esta auditoria.

## 6. Riscos residuais

A auditoria completa permaneceu com os seguintes advisories,
todos restritos a dependências classificadas como desenvolvimento:

| Pacote | Versões afetadas | Instâncias | Severidade |
|---|---|---:|---|
| glob | 10.5.0, 13.0.6 | 8 | Moderada |
| minimatch | 9.0.9, 10.2.6 | 16 | Moderada |
| uuid | 3.4.0 | 1 | Moderada |
| deepmerge | 4.3.1 | 1 | Baixa |

### Glob

[GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)

Risco relacionado ao cancelamento de operações de travessia
do sistema de arquivos. Presente em ferramentas de teste
e instrumentação.

Tratamento: acompanhar versões corrigidas e atualizações
compatíveis dos consumidores Jest e Test Exclude.

### Minimatch

[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)

Risco de negação de serviço durante o processamento
de determinados padrões glob.

A instância associada ao Fingerprint foi corrigida.
As instâncias restantes pertencem à árvore de desenvolvimento.

Tratamento: acompanhar atualizações dos consumidores
Jest, Glob e TypeScript ESLint.

### UUID

[GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)

Risco associado à validação de limites de buffer em
determinadas operações de geração de UUID.

Tratamento: acompanhar atualizações compatíveis de
`@expo/ngrok`, evitando substituir sua dependência
por uma versão principal não validada.

### Deepmerge

[GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)

Risco de alteração indevida do protótipo de objetos retornados,
relacionado a operações de merge.

Tratamento: acompanhar uma versão corrigida da biblioteca
ou atualização compatível de `jest-config`.

### Decisão de tratamento

Os quatro riscos permanecem registrados como pendências de segurança.
A decisão técnica desta etapa foi não incorporar alterações
que comprometam a integridade das ferramentas de desenvolvimento.

Isso não constitui comprovação de que os advisories sejam
inexploráveis ou uma aceitação permanente dos riscos.

Os avisos de depreciação emitidos pelo npm, incluindo
dependências legadas e ESLint 9, também permanecem
como itens de manutenção.

## 7. Validação final

| Verificação | Resultado |
|---|---|
| npm ci | Aprovado |
| npm ls --all | Aprovado |
| Expo install --check | Dependências compatíveis |
| TypeScript | Aprovado |
| ESLint | Aprovado |
| Prettier | Aprovado |
| Jest | 441 testes aprovados |
| Suítes Jest | 36 aprovadas |
| Bundle Android | 5.011.339 bytes |
| Bundle iOS | 5.012.091 bytes |
| Auditoria de produção | Zero ocorrências |
| Severidade alta ou crítica | Zero ocorrências |
| Arquivos de ambiente | Preservados |
| Manifestos e lockfile backend | Preservados |

Os bundles Hermes foram exportados utilizando uma URL
sintética de API. Os arquivos gerados foram descartados
após a validação.

### Cobertura automatizada

A baseline utilizada antes da instalação do candidato
de desenvolvimento rejeitado registrou:

| Métrica | Cobertos / Total | Cobertura |
|---|---:|---:|
| Statements | 1919 / 2332 | 82,28% |
| Branches | 1174 / 1645 | 71,36% |
| Functions | 530 / 604 | 87,74% |
| Lines | 1874 / 2278 | 82,26% |

Foram instrumentados 40 arquivos de código-fonte.

Esses indicadores representam os arquivos instrumentados
pela configuração Jest utilizada, não necessariamente
a totalidade do código mobile.

Uma execução anterior apresentou dois avisos de `act(...)`
em atualizações assíncronas de VirtualizedList na suíte
MapGymPreview. Os testes passaram e os avisos não foram
reproduzidos na execução da baseline de cobertura nem
na validação final.

A causa não foi comprovada. A ocorrência permanece
registrada para investigação de regressão e estabilidade.

## 8. Manutenção e reavaliação

Após alterações nas dependências, executar:

```bash
npm ci
npm ls --all
npm audit
npm audit --omit=dev
npx expo install --check
npm run format:check
npm run typecheck
npm run lint
npm test -- --watch=false
git diff --check
```

Para alterações relevantes de SDK, Babel, Metro ou
dependências de build, validar também a exportação
dos bundles Android e iOS.

Reavaliar o override do Fingerprint quando sua versão
ou a versão do Expo for atualizada. Remover o override
quando uma resolução upstream corrigida e compatível
for disponibilizada e validada.

Novos advisories, regressões de produção ou vulnerabilidades
altas e críticas exigem nova investigação antes de integrar
alterações de dependências.

Não utilizar downgrades automáticos incompatíveis,
`npm audit fix --force` ou `--legacy-peer-deps` como
substitutos para a resolução adequada de conflitos.

A automatização contínua da auditoria de dependências
permanece prevista no trabalho de infraestrutura e CI.

## 9. Limitações

Os resultados representam os advisories conhecidos
pelo npm no momento da auditoria de 13/11/2026.

Zero ocorrências no relatório de produção não comprova
ausência absoluta de vulnerabilidades.

A validação experimental dos padrões do Fingerprint
não comprova compatibilidade universal entre as versões
principais do Minimatch.

A exportação de bundles não substitui compilação nativa,
testes em dispositivos físicos, validação de permissões
ou avaliação integrada do aplicativo em produção.

Não houve nova execução da suíte backend nesta etapa mobile.
A validação integrada da Pull Request permanece necessária.
