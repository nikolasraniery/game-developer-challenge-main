import { useQuery } from '@tanstack/react-query';
import { fetchDemoStatus } from '../../services/matches/demoStatus';

export function ApiStatus() {
  const { data, error, isPending } = useQuery({
    queryKey: ['demo-status'],
    queryFn: fetchDemoStatus,
  });

  return (
    <section className="api-card" aria-labelledby="api-status-heading">
      <div className="section-kicker">NETWORK CHECK</div>
      <h2 id="api-status-heading">Mock API connection</h2>
      {isPending && <p role="status">Checking the sample endpoint…</p>}
      {error && (
        <p className="status-error" role="alert">
          The sample endpoint could not be reached. Check that the MSW worker is available.
        </p>
      )}
      {data && (
        <div className="api-result" role="status">
          <span className="status-indicator" aria-hidden="true" />
          <p>{data.message}</p>
          <code>{data.source.toUpperCase()}</code>
        </div>
      )}
    </section>
  );
}
