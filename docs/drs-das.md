# Documento de Requisitos de Software e Arquitetura de Software

## Visão geral

Este documento especifica os requisitos de software e a arquitetura de referência para um aplicativo mobile capaz de importar, armazenar, abrir e reproduzir conteúdos H5P, com foco prioritário em **Interactive Book**, para uso offline. A base técnica proposta é um fork do projeto `h5p-standalone` ou sua utilização como biblioteca de renderização, uma vez que esse projeto foi concebido para exibir conteúdo H5P sem depender de um servidor H5P completo e oferece opções relevantes para Interactive Book, estado do usuário e eventos xAPI.[1]

A necessidade de um aplicativo desse tipo decorre de uma limitação prática já reconhecida no ecossistema H5P: o conteúdo não funciona offline de forma confiável quando aberto diretamente do disco via `file://`, porque o player precisa de um ambiente servido por webserver local ou equivalente. A própria discussão da comunidade H5P aponta que uma solução offline exige um servidor local, um empacotamento específico ou abordagem equivalente, e menciona inclusive PWA como possibilidade parcial.[2]

O escopo deste documento contempla um produto mobile-first, com suporte inicial para Android e iOS, executado como aplicativo híbrido com WebView, camada nativa mínima e servidor local embutido opcional. O objetivo principal é entregar uma experiência de “reader” comparável a um leitor de PDF ou EPUB, mas orientada a pacotes `.h5p`, com biblioteca local, progresso, favoritos, importação de arquivos e operação sem conectividade após a importação inicial.[1][2]

## Objetivo do produto

O produto deverá permitir que estudantes, professores, treinadores e organizações distribuam e consumam conteúdos H5P em dispositivos móveis sem depender de Moodle, WordPress ou conexão permanente com a internet. O aplicativo deverá abrir conteúdos previamente importados, preservar o estado de uso, exibir Interactive Books com navegação fluida e manter compatibilidade com parte relevante do ecossistema H5P suportado pelo player standalone.[1]

A solução deverá priorizar simplicidade operacional e baixo acoplamento a LMS. Em vez de reproduzir um ambiente de autoria H5P, o aplicativo deverá se concentrar na função de leitura, execução, sincronização opcional e gestão de biblioteca local, deixando a edição de conteúdo fora do escopo da primeira versão.[3][1]

## Partes interessadas

As partes interessadas primárias são:

- Usuário final estudante, que precisa abrir e retomar livros interativos offline.[2]
- Usuário final professor ou instrutor, que precisa distribuir pacotes `.h5p` e acompanhar, quando aplicável, o uso e a conclusão.[2][1]
- Organização educacional, que deseja distribuição controlada de conteúdo sem exigir LMS completo no dispositivo.[2]
- Equipe de desenvolvimento, que precisa de uma base reutilizável, extensível e compatível com `h5p-standalone`.[1]
- Equipe de produto e suporte, que precisa de diagnósticos, telemetria opcional e previsibilidade de compatibilidade por tipo de conteúdo.[1]

## Premissas e restrições

O projeto assume que o conteúdo de entrada é fornecido em arquivo `.h5p`, que é um pacote compactado contendo `h5p.json`, `content/content.json` e bibliotecas dependentes; o próprio `h5p-standalone` documenta que o arquivo deve ser extraído antes do uso e que conteúdos exportados de algumas origens podem não incluir todas as bibliotecas necessárias.[1]

Também se assume que o uso offline real em mobile não deve depender de abertura direta do pacote em `file://`. Por essa razão, a solução deverá adotar uma das duas estratégias arquiteturais suportadas por este documento: (a) renderização local via WebView servida por um microservidor embutido, ou (b) renderização em esquema de arquivos controlado com cópia prévia de assets para área segura, desde que a implementação contorne as limitações práticas mencionadas pela comunidade H5P sobre leitura local por JavaScript.[2]

As seguintes restrições são mandatórias:

- O aplicativo não deverá depender de conexão ativa para abrir conteúdo já importado.
- O aplicativo não deverá depender de um backend remoto para funcionalidades essenciais de leitura.
- O aplicativo deverá aceitar que certos tipos de conteúdo H5P possam exigir bibliotecas ausentes ou comportamento especial, devendo expor mensagens de diagnóstico adequadas.[1]
- O aplicativo deverá priorizar Interactive Book na matriz de compatibilidade inicial.[1]

## Escopo funcional

O produto abrangerá as seguintes capacidades macro:

- Importar arquivos `.h5p` a partir do armazenamento local, compartilhamento do sistema ou URL autenticada de download.
- Validar a estrutura do pacote antes da publicação na biblioteca local.
- Extrair e indexar o conteúdo no armazenamento interno do aplicativo.[1]
- Exibir capa, título, metadados e status de leitura.
- Abrir o conteúdo em player integrado com foco em Interactive Book.[1]
- Salvar estado local do usuário, incluindo progresso, respostas, posição de leitura e retomada.[1]
- Registrar eventos locais de uso e, opcionalmente, sincronizá-los quando houver conectividade.[1]
- Permitir exportação de diagnósticos técnicos e limpeza de cache.

Não fazem parte do escopo da primeira versão:

- Edição/autoria de conteúdo H5P.[3]
- Execução de plugin H5P dependente de backend proprietário não reimplementado no app.[1]
- Catálogo público com DRM completo.
- Reprodução garantida de 100% dos tipos H5P existentes.

## Requisitos funcionais

### RF-01 Importação de pacote

O sistema deverá permitir importação de arquivos `.h5p` por seletor de arquivos, compartilhamento com o aplicativo e associação de tipo MIME quando suportado pelo sistema operacional. Após a seleção, o aplicativo deverá copiar o pacote para área de trabalho temporária, calcular hash, validar tamanho e iniciar a inspeção estrutural.

### RF-02 Validação estrutural

O sistema deverá validar a presença mínima de `h5p.json` e do conteúdo principal, identificar versão das bibliotecas e informar inconsistências. Quando bibliotecas obrigatórias estiverem ausentes, o sistema deverá bloquear a publicação do item na biblioteca e emitir mensagem explicando a dependência faltante, alinhado à observação do `h5p-standalone` de que exportações de algumas origens podem não trazer todas as bibliotecas necessárias.[1]

### RF-03 Extração e publicação local

O sistema deverá extrair o pacote `.h5p` para um diretório interno versionado por identificador do conteúdo. O diretório publicado deverá conter os arquivos prontos para consumo pelo player, além de um manifesto interno do aplicativo com hash, data de importação, versão de bibliotecas detectadas e metadados do item.

### RF-04 Biblioteca local

O sistema deverá manter uma biblioteca local pesquisável com ao menos os campos: título, subtítulo opcional, autor quando disponível, tipo principal do conteúdo, data de importação, último acesso, status, progresso e tamanho em disco. O usuário deverá poder ordenar e filtrar a lista por recentes, em andamento, concluídos e favoritos.

### RF-05 Abertura de conteúdo

O sistema deverá abrir o item selecionado em player integrado. O player deverá usar `h5p-standalone` ou fork compatível, apontando `h5pJsonPath` para o diretório extraído do conteúdo e fornecendo `frameJs` e `frameCss` empacotados localmente no aplicativo, conforme o padrão de uso documentado pelo projeto.[1]

### RF-06 Suporte prioritário a Interactive Book

O sistema deverá suportar Interactive Book como tipo prioritário, incluindo renderização da navegação interna, submissão quando aplicável e retomada de progresso. Para preservar o comportamento esperado, a configuração do player deverá prever `reportingIsEnabled: true` para conteúdos que dependem do botão de envio, como explicitado na documentação do `h5p-standalone`.[1]

### RF-07 Persistência de estado local

O sistema deverá persistir localmente o estado do usuário por conteúdo, usando a estratégia de `contentUserData` compatível com o player e salvamento periódico parametrizável por `saveFreq`, conforme o mecanismo descrito pelo `h5p-standalone` para restauração de estado.[1]

### RF-08 Retomada de leitura

Ao reabrir um conteúdo, o sistema deverá restaurar automaticamente o estado previamente salvo, incluindo progresso, respostas e posição navegacional quando o tipo de conteúdo o permitir. Se a restauração falhar, o sistema deverá oferecer reabertura limpa sem corromper o pacote original.

### RF-09 Telemetria local e xAPI opcional

O sistema deverá capturar eventos locais relevantes de uso, incluindo abertura, fechamento, conclusão, falhas e marcos de progresso. A arquitetura deverá permitir captura de eventos xAPI emitidos pelo player, aproveitando o suporte do `h5p-standalone` a `H5P.externalDispatcher.on("xAPI", ...)` para futura sincronização com LMS, LRS ou backend próprio.[1]

### RF-10 Gestão de armazenamento

O usuário deverá poder excluir conteúdos, recalcular espaço utilizado, limpar caches e reprocessar bibliotecas quebradas. O sistema deverá alertar antes de remover itens com progresso não sincronizado.

### RF-11 Diagnóstico técnico

O aplicativo deverá exibir tela de diagnóstico por conteúdo contendo tipo principal, bibliotecas identificadas, recursos ausentes, tamanho extraído, últimas exceções e eventos do último carregamento. Isso é necessário porque a própria biblioteca base registra cenários em que certos ecossistemas ou libs externas exigem hacks e correções específicas.[2][1]

### RF-12 Atualização do player

O sistema deverá permitir atualização desacoplada do núcleo do player, possibilitando substituir a versão de `h5p-standalone` usada pelo app ou um fork interno equivalente. A estratégia de atualização deverá suportar testes de regressão sobre uma suíte de conteúdos representativos antes de liberar a troca para produção.[1]

### RF-13 Sincronização opcional

O sistema poderá, em versão posterior ou feature flag, sincronizar progresso, estado e eventos de conclusão com backend remoto. Quando habilitada, a sincronização deverá operar em modo eventual, com fila local offline-first.

## Requisitos não funcionais

### RNF-01 Operação offline

O aplicativo deverá abrir conteúdos já importados sem qualquer conectividade. Essa exigência decorre diretamente da limitação de leitura local via `file://` indicada pela comunidade H5P, exigindo que a solução encapsule o runtime em ambiente servido localmente ou equivalente.[2]

### RNF-02 Desempenho percebido

O tempo de abertura de um conteúdo já indexado deverá ser inferior a 3 segundos em dispositivo intermediário recente, salvo pacotes de mídia excepcionalmente grandes. A troca entre capítulos de Interactive Book deverá parecer imediata após os assets críticos já estarem em cache.

### RNF-03 Integridade de conteúdo

O aplicativo deverá tratar o pacote importado como unidade imutável após publicação local, preservando o original para comparação por hash. Atualizações de estado do usuário deverão ocorrer em armazenamento separado do conteúdo base.

### RNF-04 Segurança

O aplicativo deverá executar conteúdo H5P em sandbox controlado dentro do WebView, com navegação externa bloqueada por padrão e política explícita para abertura de links externos. Scripts adicionais só poderão ser carregados a partir do pacote importado ou dos assets empacotados com o app, salvo configuração administrativa.

### RNF-05 Compatibilidade

A solução deverá suportar Android 10+ e iOS 16+ como alvo inicial recomendado. O núcleo web deverá ser compatível com WebView moderno, e o fork do player deverá ser validado periodicamente nas engines correspondentes.

### RNF-06 Observabilidade

Erros do player, falhas de extração, inconsistências de bibliotecas e eventos de restauração de estado deverão ser logados localmente. Quando o usuário consentir, os logs poderão ser exportados ou enviados para backend técnico em conexão posterior.

### RNF-07 Manutenibilidade

A arquitetura deverá isolar claramente as responsabilidades entre camada nativa, shell web, runtime H5P e armazenamento. O player deverá ser atualizável como módulo independente, preferencialmente via pacote interno versionado derivado do fork de `h5p-standalone`.[1]

### RNF-08 Testabilidade

O sistema deverá possuir testes automatizados de extração, indexação, abertura, restauração de estado e regressão visual mínima para Interactive Book. A biblioteca base já mantém fluxo de build e testes com Cypress, o que favorece a criação de suíte derivada no fork.[1]

## Casos de uso principais

### UC-01 Importar e abrir livro

1. O usuário aciona “Importar arquivo”.
2. O sistema recebe um `.h5p`.
3. O sistema valida e extrai o pacote.
4. O sistema publica o item na biblioteca.
5. O usuário toca no item.
6. O sistema abre o player no capítulo inicial ou no ponto salvo.

### UC-02 Retomar leitura offline

1. O usuário abre o aplicativo sem internet.
2. O usuário acessa a biblioteca local.
3. O usuário seleciona um livro em andamento.
4. O sistema recupera o estado salvo em `contentUserData`.
5. O player restaura o conteúdo e o ponto de continuidade.[1]

### UC-03 Diagnosticar conteúdo com falha

1. O usuário abre um item com erro.
2. O sistema detecta falha de biblioteca ou asset.
3. O sistema bloqueia a execução insegura.
4. O sistema apresenta tela de diagnóstico com sugestão de reimportação ou relatório.

## Requisitos de dados

O aplicativo deverá manter pelo menos as seguintes entidades lógicas:

- `LibraryItem`: identificador interno, título, descrição curta, tipo principal, capa, hash do pacote, data de importação, tamanho, status.
- `ContentPackage`: caminho do pacote original, caminho extraído, manifesto técnico, bibliotecas detectadas, versão do player compatível.
- `ReaderState`: conteúdo, usuário local, último acesso, progresso percentual, estado bruto serializado compatível com `contentUserData`, marcadores e favoritos.[1]
- `EventLog`: timestamp, tipo de evento, payload resumido, status de sincronização.
- `SyncQueue`: itens pendentes de envio para backend opcional.

O banco de dados local recomendado é SQLite. Arquivos binários e diretórios extraídos deverão residir no armazenamento interno privado do aplicativo.

## Arquitetura de software

### Estilo arquitetural

A arquitetura recomendada é híbrida, em camadas, orientada a módulos e offline-first. O aplicativo será composto por shell mobile nativo, runtime web embarcado, engine de player H5P, serviços de conteúdo e persistência local. O componente de renderização H5P deverá reutilizar `h5p-standalone` como biblioteca ou fork, pois ele já define a forma de inicialização do conteúdo, os parâmetros do player e os mecanismos de restauração de estado e captura de eventos xAPI.[1]

### Decisão principal: biblioteca ou fork

A decisão padrão recomendada é iniciar com `h5p-standalone` como dependência interna e evoluir para fork controlado quando surgirem necessidades mobile específicas, correções de compatibilidade, customização de UI, interceptação de assets ou patches no ciclo de vida do player. Essa recomendação é coerente com o histórico do ecossistema, no qual a própria discussão da comunidade menciona hacks e ajustes práticos para cenários fora dos ambientes H5P mais tradicionais.[2][1]

Critérios para permanecer apenas como biblioteca:

- Compatibilidade satisfatória com os tipos priorizados.
- Necessidade baixa de modificar pipeline interno de assets.
- Capacidade de empacotar `frame.bundle.js` e `h5p.css` sem mudanças profundas.[1]

Critérios para promover a fork:

- Necessidade de resolver incompatibilidades específicas de mobile.
- Necessidade de expor eventos e hooks não disponíveis na API pública.
- Necessidade de endurecer sandbox, política de links, armazenamento de estado ou carregamento de bibliotecas.
- Necessidade de customizar UI nativa do frame e telemetry hooks.

### Visão de componentes

Os componentes principais serão:

1. **App Shell Mobile**: camada nativa em Flutter, React Native, Capacitor ou stack equivalente. Responsável por ciclo de vida do app, integração com arquivos, compartilhamento, permissões e armazenamento.
2. **Local Content Service**: serviço responsável por importar, validar, descompactar e publicar conteúdos `.h5p` em estrutura interna.
3. **Metadata Indexer**: parser de `h5p.json`, `content.json` e manifesto interno para alimentar a biblioteca local.
4. **H5P Runtime Adapter**: módulo web que encapsula o uso do `h5p-standalone`, constrói `options`, injeta `frameJs`, `frameCss`, `h5pJsonPath`, `reportingIsEnabled`, `contentUserData`, `saveFreq` e listeners xAPI.[1]
5. **Reader UI**: interface web/mobile para biblioteca, leitura, progresso, favoritos e diagnóstico.
6. **State Store**: persistência de estado local e fila de sincronização.
7. **Sync Gateway**: componente opcional de comunicação com backend remoto.
8. **Diagnostics & Logging**: coleta de logs, exceções, métricas e relatórios exportáveis.

### Diagrama lógico textual

Fluxo principal de importação e leitura:

1. O arquivo `.h5p` entra pelo App Shell Mobile.
2. O Local Content Service copia o arquivo para área interna, calcula hash e extrai o pacote.
3. O Metadata Indexer lê metadados e grava `LibraryItem` e `ContentPackage` no banco local.
4. Ao abrir o item, o Reader UI solicita ao H5P Runtime Adapter uma sessão de leitura.
5. O H5P Runtime Adapter carrega o player com `h5p-standalone` e injeta o estado salvo.
6. Durante a leitura, o player emite alterações de estado e eventos xAPI.
7. O State Store persiste o estado localmente e o Sync Gateway, quando habilitado, agenda transmissão futura.[1]

### Estratégias de execução mobile

#### Alternativa A: WebView + microservidor local embutido

Esta é a alternativa recomendada para a primeira implementação. O app inicia um microservidor HTTP local em loopback, publica os diretórios de conteúdo extraído e os assets do player, e abre a interface em WebView apontando para `http://127.0.0.1:<porta>/app`. Essa abordagem atende diretamente à limitação apontada pela comunidade H5P sobre a necessidade de webserver local para cenários offline.[2]

Vantagens:

- Maior aderência ao modelo de paths esperado pelo `h5p-standalone`.[1]
- Menor risco de problemas de CORS e carregamento de assets.
- Isolamento mais claro entre conteúdo, player e UI.
- Facilidade para adicionar endpoints internos de estado e diagnóstico.

Desvantagens:

- Mais complexidade de empacotamento e ciclo de vida.
- Necessidade de portar servidor local para Android e iOS.

#### Alternativa B: WebView com bridge nativa e assets publicados em esquema local controlado

Nesta alternativa, a UI e o player residem no bundle do app e o acesso aos pacotes extraídos ocorre por esquemas de URL internos ou mapeamento do próprio framework híbrido. É mais simples operacionalmente, mas tende a exigir mais testes e possíveis patches no player para resolver diferenças de caminho e segurança.

Vantagens:

- Menor número de processos.
- Empacotamento mais simples em alguns frameworks.

Desvantagens:

- Maior risco de incompatibilidades com caminhos relativos e carga de bibliotecas.
- Pode acelerar a necessidade de fork do player.

### Pilha tecnológica recomendada

A pilha recomendada para o MVP é:

- Shell mobile: Capacitor + framework web moderno, ou React Native/Flutter com WebView.
- Camada web: TypeScript + aplicação SPA leve.
- Banco local: SQLite.
- Armazenamento de arquivos: diretório privado do app.
- Player: `h5p-standalone` fixado em versão específica, não `latest`, pois a própria documentação recomenda pinagem de versão em produção para evitar atualizações inesperadas.[1]
- Parser/extração: bibliotecas ZIP nativas ou JS, desde que preservem nomes e estrutura.
- Telemetria opcional: fila local + HTTPS assíncrono.

### Contratos internos

#### Contrato de importação

Entrada: arquivo `.h5p`, origem, metadados de importação.

Saída: `ImportResult { contentId, hash, status, warnings[], detectedLibraries[], primaryContentType }`.

#### Contrato de abertura do player

Entrada: `OpenContentRequest { contentId, readerMode, restoreState: boolean }`.

Saída: sessão de player com caminhos resolvidos e estado inicial.

#### Contrato de persistência de estado

Entrada: `StateSnapshot { contentId, userIdLocal, savedAt, dataType, previousState, progress, location }`.

Saída: confirmação local, enfileiramento opcional para sincronização.

## Arquitetura de persistência

A persistência deverá separar três domínios:

- **Conteúdo imutável**: pacote original e diretório extraído.
- **Índice transacional**: banco local com itens da biblioteca e metadados.
- **Estado mutável**: snapshots de progresso, respostas e eventos.

Essa separação reduz risco de corrupção do conteúdo ao salvar progresso. Também facilita reimportação, reindexação e deduplicação por hash.

## Arquitetura de integração com h5p-standalone

### Encapsulamento do player

O aplicativo não deverá chamar `h5p-standalone` diretamente a partir de múltiplos pontos da UI. Em vez disso, deverá existir um `H5PRuntimeAdapter` responsável por montar e controlar as opções do player, com assinatura conceitual semelhante a:

```ts
openContent({
  container,
  contentPath,
  playerAssetsPath,
  savedState,
  enableReporting,
  enableFullscreen,
  onXapi,
  onStateChange,
  onError
})
```

Internamente, o adapter deverá traduzir isso para os parâmetros documentados pelo player, como `h5pJsonPath`, `frameJs`, `frameCss`, `reportingIsEnabled`, `contentUserData`, `saveFreq` e listeners xAPI.[1]

### Política de customização

O fork, quando necessário, deverá manter uma camada mínima de divergência em relação ao upstream. Mudanças aceitáveis no fork:

- Hooks para persistência local mobile.
- Tratamento aprimorado de links externos e anexos.
- Telemetria e logs estruturados.
- Correções de path resolution em ambiente mobile.
- UI de frame levemente adaptada a navegação touch.

Mudanças que devem ser evitadas no fork:

- Reescrever o core inteiro do player.
- Acoplar backend proprietário ao runtime.
- Alterar APIs públicas sem necessidade.

## Segurança e sandbox

O aplicativo deverá tratar conteúdos H5P como conteúdo ativo confiável apenas parcialmente. Por isso, os seguintes controles são obrigatórios:

- Navegação externa bloqueada por padrão; links HTTP/HTTPS abertos por confirmação explícita em browser externo.
- Sem acesso irrestrito do conteúdo ao bridge nativo.
- Assets servidos somente a partir do pacote publicado e do bundle do player.
- Isolamento de arquivos por conteúdo para reduzir colisões.
- Verificação de tamanho e limites de extração para evitar zip bombs.

## Estratégia offline-first

A estratégia offline-first deverá obedecer aos seguintes princípios:

- Tudo o que é necessário para leitura deve existir localmente antes da abertura.
- Estados de progresso e eventos devem ser gravados primeiro localmente.
- Sincronização, quando existir, é derivada e nunca pré-requisito para leitura.
- Exclusão de conteúdo com dados não sincronizados deve pedir confirmação.

## Matriz de compatibilidade inicial

| Categoria | Status inicial | Observação |
|---|---|---|
| Interactive Book | Suportado prioritariamente | Exigir testes dedicados e `reportingIsEnabled` quando aplicável.[1] |
| Course Presentation | Suporte candidato | Requer suíte de regressão específica.[1] |
| Interactive Video | Suporte candidato | Sensível a mídia grande e codecs do device. |
| Question Set / Quiz | Suporte candidato | Depende de restauração de estado consistente.[1] |
| Tipos com bibliotecas ausentes no pacote | Não garantido | App deve diagnosticar e bloquear com mensagem clara.[1] |

## Requisitos de API backend opcional

Quando houver backend, os endpoints mínimos recomendados são:

- `POST /api/mobile/import-intents` para autorização de downloads remotos.
- `GET /api/mobile/content/{id}/package` para entrega de `.h5p` autenticado.
- `GET /api/mobile/state/{contentId}` para recuperação remota de estado.
- `POST /api/mobile/state/{contentId}` para persistência remota de estado, alinhado conceitualmente ao modelo de `contentUserDataUrl` descrito pelo `h5p-standalone`.[1]
- `POST /api/mobile/xapi` para recepção de eventos xAPI e conclusão.

## Estratégia de testes

A solução deverá ter quatro níveis de teste:

1. **Teste unitário**: validação de importação, manifesto, hash, parser de metadados.
2. **Teste de integração**: player abre conteúdo extraído, salva estado e restaura com sucesso.[1]
3. **Teste de compatibilidade**: suíte de pacotes H5P de referência, com foco em Interactive Book.
4. **Teste mobile real**: Android e iOS em dispositivos físicos, cobrindo suspensão, retomada, rotação e perda de conectividade.

Critérios mínimos de aceite do player:

- Abre Interactive Book de referência.
- Mantém progresso após fechamento do app.
- Não depende de internet após importação.
- Lida com pacote inválido sem crash.
- Registra logs úteis para diagnóstico.

## Roadmap de implementação

### Fase 1 — Prova técnica

- Empacotar `h5p-standalone` em shell mobile.
- Importar `.h5p`, extrair e abrir um Interactive Book de referência.[1]
- Provar funcionamento offline com servidor local embutido ou alternativa equivalente alinhada à limitação reconhecida pela comunidade.[2]

### Fase 2 — MVP

- Biblioteca local.
- Persistência de estado.
- Favoritos, recentes e progresso.
- Tela de diagnóstico.
- Suite básica de testes de regressão.

### Fase 3 — Produto utilizável

- Suporte a sincronização opcional.
- Downloads autenticados.
- Múltiplos perfis locais.
- Telemetria consentida.
- Mecanismo de atualização do player.

## Critérios de aceite do produto

O produto será considerado apto para piloto quando atender aos critérios abaixo:

- Importa e indexa arquivos `.h5p` sem assistência manual.
- Abre Interactive Book em modo offline após importação.[1][2]
- Persiste e restaura estado local com base em mecanismo compatível com `contentUserData`.[1]
- Isola falhas de conteúdo com diagnóstico claro.
- Opera em Android e iOS dentro dos limites de compatibilidade definidos.
- Mantém o player em versão pinada e testada, conforme boa prática indicada no repositório do `h5p-standalone`.[1]

## Recomendações finais de arquitetura

A recomendação principal é construir o produto como aplicativo híbrido mobile com WebView e microservidor local embutido, usando `h5p-standalone` inicialmente como biblioteca pinada e com possibilidade explícita de evolução para fork controlado. Essa escolha resolve melhor a exigência offline, respeita a forma de execução esperada pelo player e reduz o atrito com a limitação histórica do H5P em ambiente `file://`.[2][1]

A recomendação secundária é definir desde o início uma camada `H5PRuntimeAdapter` própria e uma suíte de regressão baseada em conteúdos reais. Isso reduz o custo de futura substituição de versão, facilita a manutenção de um fork e evita espalhar dependências do player pela interface do aplicativo.[1]
