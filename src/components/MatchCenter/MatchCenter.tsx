import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '../../services/api/httpClient';
import { fetchMatchHistory, fetchRanking, matchQueryKeys } from '../../services/matches/matchApi';
import {
  clearLocalMatches,
  getNetworkScenario,
  setNetworkScenario,
  type NetworkScenario,
} from '../../services/matches/matchRepository';
import type { MatchRecord, RankingEntry } from '../../types/matches';

type Props = {
  configuration: { durationSeconds: number; spawnIntervalSeconds: number };
  tab: Tab;
  onTabChange: (tab: Tab) => void;
};
type Tab = 'ranking' | 'history';

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export function MatchCenter({ configuration, tab, onTabChange }: Props) {
  const [page, setPage] = useState(1);
  const [scenario, setScenario] = useState<NetworkScenario>(getNetworkScenario);
  const [resetError, setResetError] = useState(false);
  const queryClient = useQueryClient();
  const changeTab = (next: Tab) => {
    setPage(1);
    onTabChange(next);
  };
  const ranking = useQuery({
    queryKey: [
      ...matchQueryKeys.ranking(page),
      configuration.durationSeconds,
      configuration.spawnIntervalSeconds,
    ],
    queryFn: () => fetchRanking(page, configuration),
    enabled: tab === 'ranking',
  });
  const history = useQuery({
    queryKey: matchQueryKeys.history(page, 'local-captain'),
    queryFn: () => fetchMatchHistory(page),
    enabled: tab === 'history',
  });
  const result = tab === 'ranking' ? ranking : history;

  return (
    <section className="match-center" aria-label="Ranking e histórico de partidas">
      <div className="match-center-heading">
        <div>
          <p className="section-kicker">BIBLIOTECA DO CAPITÃO</p>
          <h2>{tab === 'ranking' ? 'Ranking' : 'Histórico de partidas'}</h2>
        </div>
        <div className="match-tabs" role="tablist" aria-label="Dados das partidas">
          <button role="tab" aria-selected={tab === 'ranking'} onClick={() => changeTab('ranking')}>
            Ranking
          </button>
          <button role="tab" aria-selected={tab === 'history'} onClick={() => changeTab('history')}>
            Meu histórico
          </button>
        </div>
      </div>
      <p className="match-config-note">
        Partidas comparadas: {configuration.durationSeconds}s · surgimento a cada{' '}
        {configuration.spawnIntervalSeconds}s
      </p>
      <div className="network-demo-controls">
        <label htmlFor="network-scenario">Cenário de rede (MSW)</label>
        <select
          id="network-scenario"
          value={scenario}
          onChange={(event) => {
            const next = event.currentTarget.value as NetworkScenario;
            setScenario(next);
            setNetworkScenario(next);
            setPage(1);
            void queryClient.invalidateQueries({ queryKey: ['ranking'] });
            void queryClient.invalidateQueries({ queryKey: ['match-history'] });
          }}
        >
          <option value="success">Sucesso</option>
          <option value="empty">Listas vazias</option>
          <option value="slow">Resposta lenta</option>
          <option value="variable-latency">Latência variável</option>
          <option value="out-of-order">Respostas fora de ordem</option>
          <option value="connection-error">Falha de conexão</option>
          <option value="bad-request">Resposta HTTP 400</option>
          <option value="ranking-error">Erro no ranking</option>
          <option value="history-error">Erro no histórico</option>
          <option value="submit-error">Falha ao registrar</option>
          <option value="submit-timeout">Timeout no registro</option>
        </select>
        <button
          type="button"
          className="game-action-button"
          onClick={async () => {
            setResetError(false);
            try {
              await httpClient.post('/demo-reset');
              clearLocalMatches();
              await queryClient.invalidateQueries({ queryKey: ['ranking'] });
              await queryClient.invalidateQueries({ queryKey: ['match-history'] });
            } catch {
              setResetError(true);
            }
          }}
        >
          Restaurar dados de demonstração
        </button>
      </div>
      {resetError && (
        <p role="alert">Não foi possível restaurar os dados enquanto a API está indisponível.</p>
      )}
      {result.isPending ? <p role="status">Carregando partidas…</p> : null}
      {result.isError ? (
        <div role="alert">
          <p>Não foi possível carregar os dados. O jogo continua disponível.</p>
          <button className="game-action-button" onClick={() => void result.refetch()}>
            Tentar novamente
          </button>
        </div>
      ) : null}
      {result.data && result.data.items.length === 0 ? (
        <p>Nenhuma partida registrada nesta página.</p>
      ) : null}
      {result.data && result.data.items.length > 0 && (
        <ol className="match-list">
          {tab === 'ranking'
            ? (result.data.items as RankingEntry[]).map((entry, index) => (
                <li key={`${entry.playerId}-${entry.completedAt}-${index}`}>
                  <span className="match-rank">
                    {(page - 1) * result.data.pageSize + index + 1}
                  </span>
                  <span className="match-name">{entry.playerName}</span>
                  <strong>{entry.score} pts</strong>
                </li>
              ))
            : (result.data.items as MatchRecord[]).map((entry) => (
                <li key={entry.id}>
                  <span className="match-name">
                    {dateLabel(entry.completedAt)} ·{' '}
                    {entry.endReason === 'time' ? 'tempo esgotado' : 'navio derrotado'}
                    {entry.submissionState === 'pending' ? ' · aguardando envio' : ''}
                  </span>
                  <strong>{entry.score} pts</strong>
                </li>
              ))}
        </ol>
      )}
      <div className="match-pagination">
        <button
          className="game-action-button"
          disabled={page <= 1}
          onClick={() => setPage((value) => value - 1)}
        >
          Anterior
        </button>
        <span>
          Página {page}
          {result.data
            ? ` de ${Math.max(1, Math.ceil(result.data.total / result.data.pageSize))}`
            : ''}
        </span>
        <button
          className="game-action-button"
          disabled={!result.data || page * result.data.pageSize >= result.data.total}
          onClick={() => setPage((value) => value + 1)}
        >
          Próxima
        </button>
      </div>
    </section>
  );
}
