# Pirate Battle

Este guia documenta a aplicação implementada. O enunciado original do desafio técnico foi preservado em [`CHALLENGE_SPEC.md`](./CHALLENGE_SPEC.md).

## Visão geral

Pirate Battle é um jogo de combate naval para navegador e um único jogador, desenvolvido com React, TypeScript em modo estrito e PixiJS. O jogador pilota um navio entre ilhas, enfrenta inimigos Chaser e Shooter e tenta sobreviver até o fim do tempo. A aplicação também inclui menu responsivo, opções de partida persistentes, controles por toque, HUD, pausa e reinício, tela cheia, registro de resultados e demonstrações de ranking e histórico com MSW, Axios e TanStack Query.

## Requisitos e instalação

- Node.js `>=22.12.0`, conforme declarado em `package.json`.
- npm e o arquivo `package-lock.json` versionado.
- Chromium para a suíte E2E do Playwright.

Instale as dependências travadas no lockfile e inicie o servidor de desenvolvimento:

```sh
npm ci
npm run dev
```

Abra o endereço local exibido pelo Vite. O menu aparece primeiro; a arena PixiJS e seus assets são inicializados após escolher **Jogar**. Um estado de carregamento é exibido enquanto a arena é preparada. Não é necessário configurar servidor de API, credenciais ou variáveis de ambiente.

O MSW é iniciado por padrão nos ambientes de desenvolvimento e produção. A configuração opcional `VITE_ENABLE_MOCK_API=false` desativa o worker; como não há uma API real configurada, as requisições de status da demonstração, ranking e histórico falharão. Ranking e histórico são simulados pela API mock do MSW, não são serviços remotos.

## Jogabilidade, controles e opções

Consulte o painel **Controles** no menu ou as instruções abaixo da arena:

- **W** ou **↑**: avançar.
- **A** ou **←**: virar à esquerda; **D** ou **→**: virar à direita.
- **Space**: disparar o canhão frontal.
- **Q** / **E**: disparar a salva lateral esquerda / direita.
- **P** ou **Esc**: pausar ou retomar. O jogo também pausa quando a janela perde o foco ou a aba fica oculta; retome com **P**, **Esc** ou o botão na tela.
- Em dispositivos móveis, mantenha pressionados os controles de toque abaixo da arena para mover, virar e disparar. Use o botão de toque para pausar ou retomar.

Escolha **Jogar** para iniciar uma partida. Em **Configurações**, as opções são salvas no `localStorage` do navegador: duração de 60 a 180 segundos, em incrementos de 15 segundos, e intervalo entre surgimentos de inimigos de 1 a 12 segundos, em incrementos de 1 segundo. Cada partida recebe uma cópia das configurações atuais; alterações valem para a próxima partida. Os valores padrão são 60 segundos e 4 segundos. Ao fim da partida, **Jogar novamente** inicia uma nova arena e **Voltar ao menu** sai dela. A arena também oferece um botão de tela cheia.

Durante o combate, o canvas PixiJS exibe o navio do jogador, os navios Chaser e Shooter, ilhas, projéteis, indicadores de vida e efeitos de explosão. O HUD semântico apresenta vida do jogador, pontuação e tempo restante. Cada inimigo derrotado pelos disparos do jogador vale um ponto. A partida termina quando o tempo acaba ou a vida do jogador chega a zero. A pausa suspende o tempo ativo da simulação. A tela de resultado mostra pontuação, duração, motivo do encerramento e estado do registro.

## Build e preview de produção local

```sh
npm run build
npm run preview
```

O build executa as verificações de TypeScript e gera o site estático otimizado em `dist/`. O preview serve esse build localmente; abra o endereço exibido pelo Vite Preview e confira se o menu, a arena e as telas da API mock carregam. Gere um novo build após alterar o código antes de iniciar o preview.

## Comandos

| Comando                                              | Finalidade                                                                                                                                   |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                        | Inicia o servidor de desenvolvimento do Vite.                                                                                                |
| `npm run build`                                      | Executa as verificações de TypeScript e gera o build de produção otimizado.                                                                  |
| `npm run preview`                                    | Serve localmente o build mais recente em `dist/`.                                                                                            |
| `npm run typecheck`                                  | Executa `tsc -b`.                                                                                                                            |
| `npm run lint`                                       | Executa o ESLint.                                                                                                                            |
| `npm run test:unit`                                  | Executa testes Vitest determinísticos de lógica, controles, repositório e profiler.                                                          |
| `npm run test:components`                            | Executa testes dos componentes React com PixiJS simulado; não requer WebGL.                                                                  |
| `npm run test:e2e`                                   | Gera o build e executa a suíte Playwright em Chromium contra o Vite Preview.                                                                 |
| `npm run test:e2e -- --workers=1`                    | Executa a suíte em série; útil para reduzir variações de tempo em máquinas limitadas.                                                        |
| `npm run format` / `npm run format:check`            | Formata ou verifica os arquivos de código, testes e configurações cobertos pelos globs existentes. Os scripts não incluem arquivos Markdown. |
| `npm run msw:init`                                   | Gera ou atualiza `public/mockServiceWorker.js` com o MSW instalado.                                                                          |
| `npm run profile:report -- run.json [baseline.json]` | Resume um perfil JSON real e, opcionalmente, compara-o com uma referência.                                                                   |

Se o navegador do Playwright ainda não estiver instalado, instale-o uma vez:

```sh
npx playwright install chromium
```

A cobertura E2E inclui navegação pelo menu e pelas opções, persistência, inicialização da arena e controles de teclado, pausa e temporização, redimensionamento, estados de erro da API, paginação do ranking, estados vazio e de erro do histórico, conclusão e reinício de partida, além de baselines visuais do menu, da arena pausada e do painel de resultado. Os testes E2E atuais não verificam todas as regras de combate acionando ataques reais. O comando gera um relatório HTML em `playwright-report/` e artefatos de falhas, como screenshots e traces, em `test-results/`; essas pastas geradas são ignoradas pelo Git.

## Arquitetura

- `src/app/` contém as telas React, o estado do menu, o armazenamento das opções e o provider do TanStack Query.
- `src/components/GameArena/` controla inicialização do PixiJS, carregamento de assets, tamanho do canvas, tela cheia, HUD semântico, controles de toque e desmontagem.
- `src/game/` contém a simulação atualizada pelo ticker, cálculos de movimento e colisão, controles de teclado e toque, surgimento de inimigos, projéteis, indicadores de vida e o profiler opcional.
- `src/services/` contém o cliente Axios compartilhado e a API/repositório de partidas; `src/mocks/` contém handlers e fixtures do MSW.
- `tests/` cobre lógica pura e componentes React; `e2e/` contém fluxos Playwright e snapshots versionados do Chromium no Windows.

React gerencia os menus e as atualizações ocasionais de HUD, pausa e resultado; o PixiJS controla o estado contínuo e a renderização do combate. Consulte [`ARCHITECTURE.md`](./ARCHITECTURE.md) para detalhes do ciclo de vida, da simulação e do fluxo de dados.

## Ranking, histórico e cenários de rede

O ranking é filtrado pela duração e pelo intervalo entre surgimentos escolhidos para a partida. A ordenação usa pontuação decrescente, depois horário de conclusão e identificação do jogador para desempate determinístico. O ranking e o histórico do jogador local são paginados em grupos de cinco. O cliente solicita até 20 registros mock por vez, combina os resultados com os registros locais e divide a lista combinada em páginas para a interface.

O worker do MSW fornece a API de demonstração. Os demais capitães são fixtures; não há serviço remoto. Um resultado concluído é salvo primeiro na fila local de envios pendentes e depois enviado pelo Axios, usando a identificação da partida como chave de idempotência. Opções e registros locais confirmados ou pendentes são guardados no `localStorage` do navegador. Envios pendentes são tentados novamente ao abrir a aplicação ou pelo botão **Tentar registrar novamente**. A coleção em memória mantida pelo MSW se perde quando o worker reinicia, mas os registros locais do navegador permanecem. O histórico mostra apenas as partidas do jogador local; as outras entradas do ranking são fixtures. Limpar os dados do navegador apaga os registros e as opções locais.

Abra **Ranking** ou **Histórico** e selecione **Cenário de rede (MSW)** para reproduzir estas situações:

| Cenário                             | Comportamento                                                                                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sucesso                             | Respostas normais da API mock e registro de partidas.                                                                                                             |
| Listas vazias                       | Respostas vazias para ranking e histórico.                                                                                                                        |
| Resposta lenta                      | Atraso fixo de 650 ms nas consultas de listas.                                                                                                                    |
| Latência variável                   | Sequência repetível de diferentes atrasos.                                                                                                                        |
| Respostas fora de ordem             | Atrasos alternados de 900 ms e 80 ms nas respostas de listas.                                                                                                     |
| Falha de conexão                    | O MSW retorna erro de rede nas consultas e nos envios.                                                                                                            |
| Resposta HTTP 400                   | A consulta retorna HTTP 400.                                                                                                                                      |
| Erro no ranking / Erro no histórico | O endpoint da lista selecionada retorna HTTP 503.                                                                                                                 |
| Falha ao registrar                  | O envio retorna HTTP 503 e permanece pendente no armazenamento local.                                                                                             |
| Timeout no registro                 | O MSW aceita a partida, mas atrasa a resposta além do timeout de 5 segundos do Axios; a nova tentativa usa a mesma identificação e não duplica o registro aceito. |

Escolha **Restaurar dados de demonstração** para limpar a coleção aceita pelo MSW, a fila local de partidas e os contadores de atraso determinístico. O cenário escolhido e as opções de jogo são armazenados separadamente e não são redefinidos por esse botão. Os cenários são demonstrações fixas e reproduzíveis; eles não simulam distribuições arbitrárias de latência nem todas as condições reais de rede ou do navegador. Os registros do worker ficam em memória, portanto não equivalem à persistência de um servidor remoto.

## Perfil de desempenho

O profiler só está disponível no servidor de desenvolvimento do Vite. Execute `npm run dev`, abra a aplicação com `?profile=1`, configure a duração para 180 segundos e o intervalo de surgimento para 1 segundo em **Configurações** e inicie uma partida. A coleta começa junto com o runtime PixiJS. Ela termina ao atingir a duração configurada ou antes disso se o jogador for derrotado, a arena for desmontada ou alguém chamar `stop()` manualmente. Uma sessão encerrada antes do tempo não é um perfil completo de três minutos.

Com a arena aberta, use o console de desenvolvimento do navegador:

```js
window.__PIRATE_BATTLE_PROFILE__.status();
window.__PIRATE_BATTLE_PROFILE__.result();
window.__PIRATE_BATTLE_PROFILE__.downloadJSON();
window.__PIRATE_BATTLE_PROFILE__.downloadCSV();
```

`stop()` encerra a coleta antes do tempo; `result()` fica disponível quando a coleta termina. O JSON contém janelas por segundo e intervalos retidos do ticker; o CSV contém linhas de resumo, janelas e intervalos. Analise arquivos exportados reais com `npm run profile:report -- run-1.json run-2.json`. O FPS informado conta callbacks do ticker PixiJS, não quadros confirmados como apresentados pelo navegador. `performance.memory` é uma API não padronizada e pode estar indisponível. Como a ferramenta só funciona em desenvolvimento, os resultados descrevem esse ambiente e não representam medições do build de produção.

**Ainda não foram coletados um perfil real de três minutos nem evidências de memória após cinco ciclos.** Não trate a implementação ou os testes automatizados como resultados de desempenho. Consulte [`DELIVERY_READINESS.md`](./DELIVERY_READINESS.md) para ver o protocolo completo de coleta, as lacunas de evidência, os resultados dos testes e as definições das métricas.

## Deploy

A URL pública informada é [https://piratebattle-beta.vercel.app/](https://piratebattle-beta.vercel.app/). A disponibilidade atual e a correspondência entre o site e este checkout não foram verificadas de forma independente nesta auditoria, e este trabalho não publicou uma nova versão.

Para reproduzir um build estático de produção, execute `npm ci` e depois `npm run build`; publique o diretório `dist/` gerado. Mantenha `mockServiceWorker.js` na raiz do site. O build de produção habilita o MSW por padrão e exige uma origem segura para service workers (HTTPS ou localhost nos testes locais). Após o deploy, abra ou recarregue a URL pública e verifique o menu, a arena e o ranking/histórico mock. Este repositório não contém configuração específica de provedor de deploy.

## Limitações e evidências para entrega

- As APIs de ranking e histórico são demonstrações via MSW, não um backend. Os registros aceitos pelo worker ficam em memória. Opções, envios pendentes e partidas concluídas locais são armazenados no navegador.
- Os outros capitães são fixtures. A tela de histórico mostra apenas o jogador local. Restrições do navegador podem impedir a persistência local.
- Ao recarregar a página, a aplicação volta ao menu; o painel de resultado não é restaurado, embora o registro concluído permaneça no histórico local quando o armazenamento do navegador está disponível.
- O carregamento dos assets mostra um estado visível, mas não uma porcentagem de progresso. O jogo não tem efeitos sonoros.
- Há controles de toque abaixo da arena e o layout responde a redimensionamentos; a cobertura Playwright é para Chromium em desktop e não representa uma matriz completa de dispositivos móveis e navegadores.
- Continuam pendentes o perfil real de três minutos, as evidências dos cinco ciclos de iniciar/jogar/sair e a verificação independente do deploy público.
- A execução paralela padrão do Playwright apresentou falhas de timer e snapshot sob carga concorrente, depois de uma execução anterior com 18/18 aprovados. A repetição em um único worker passou nos 19 testes. Nenhuma asserção foi enfraquecida.
- O ambiente atual, com Node `v24.14.1`, emitiu avisos `EBADENGINE` para dependências `jsdom` travadas que pedem Node `24.15.0` ou superior na linha 24.x. Typecheck, lint, build e os testes registrados ainda passaram nesse ambiente.
