import {
  attentionItems,
  buildConnectionReadiness,
  buildControlStages,
  businessIdentity,
  domainReadiness,
  readinessSummary,
  recoveryItems,
} from '../lib/control-panel';

export const dynamic = 'force-dynamic';

const statusLabel = {
  blocked: 'Blocked',
  guarded: 'Guarded',
  unavailable: 'Not connected',
  ready: 'Ready',
} as const;

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M4 10h11M11 6l4 4-4 4" />
    </svg>
  );
}

function MarkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32">
      <path d="M5 7h7v7h8V7h7v18h-7v-7h-8v7H5z" />
    </svg>
  );
}

function StatusPill({ status }: { status: keyof typeof statusLabel }) {
  return <span className={`status-pill status-${status}`}>{statusLabel[status]}</span>;
}

export default function DashboardPage() {
  const controlStages = buildControlStages(process.env);
  const connections = buildConnectionReadiness(process.env);
  const kernelEnabledCount = connections.filter((item) => item.configuredInKernel).length;
  const localConfigCount = connections.filter((item) => item.status === 'guarded').length;

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#overview" aria-label="Hutchrok command center home">
          <span className="brand-mark"><MarkIcon /></span>
          <span>Hutchrok <b>Command</b></span>
        </a>
        <nav className="topnav" aria-label="Dashboard sections">
          <a href="#attention">Attention</a>
          <a href="#controls">Controls</a>
          <a href="#connections">Connections</a>
          <a href="#recovery">Recovery</a>
        </nav>
        <div className="mode-lock" aria-label="Environment local review, production blocked">
          <span className="mode-dot" />
          Local review
        </div>
      </header>

      <section className="hero" id="overview" aria-labelledby="dashboard-title">
        <div className="hero-copy">
          <p className="eyebrow">FTD-CORE-001 / Operator view</p>
          <h1 id="dashboard-title">See what can move.<br /><span>Stop what cannot.</span></h1>
          <p className="hero-description">
            One visual control surface for decisions, system boundaries, and recovery readiness.
            This view reports repository evidence only; it does not activate providers or approve work.
          </p>
        </div>
        <div className="hero-state" aria-label="System readiness summary">
          <div className="hero-state-head">
            <span>Open control gaps</span>
            <StatusPill status="blocked" />
          </div>
          <strong>{String(attentionItems.length).padStart(2, '0')}<small> review gates</small></strong>
          <div className="readiness-track" aria-hidden="true">
            {attentionItems.map((item) => <span key={item.title} />)}
          </div>
          <p>{readinessSummary.reason}</p>
        </div>
      </section>

      <section className="identity-strip" aria-label="Verified public business identity">
        <div><span>Legal name</span><strong>{businessIdentity.legalName}</strong></div>
        <div><span>Public contact</span><strong>{businessIdentity.publicEmail}</strong></div>
        <div><span>Public location</span><strong>{businessIdentity.publicAddress}</strong></div>
        <div><span>Operating time</span><strong>{businessIdentity.timezone}</strong></div>
        <p>{businessIdentity.source}. Public contact location is not registered-agent authority.</p>
      </section>

      <section className="control-spine" aria-labelledby="control-spine-title">
        <div className="spine-heading">
          <div><p className="eyebrow">Governed path</p><h2 id="control-spine-title">Every effect must clear the spine</h2></div>
        </div>
        <ol className="stage-list">
          {controlStages.map((stage, index) => (
            <li key={stage.name} className={`stage stage-${stage.status}`}>
              <div className="stage-index">{String(index + 1).padStart(2, '0')}</div>
              <div><span>{stage.name}</span><p>{stage.detail}</p></div>
              <StatusPill status={stage.status} />
            </li>
          ))}
        </ol>
      </section>

      <div className="dashboard-grid">
        <section className="panel attention-panel" id="attention" aria-labelledby="attention-title">
          <div className="panel-heading">
            <div><p className="eyebrow">Decision queue</p><h2 id="attention-title">Needs attention</h2></div>
            <span className="panel-count">{attentionItems.length}</span>
          </div>
          <div className="attention-list">
            {attentionItems.map((item) => (
              <article className="attention-item" key={item.title}>
                <div className={`severity severity-${item.severity}`} aria-hidden="true" />
                <div className="attention-copy">
                  <div className="attention-meta"><span>{item.area}</span><span>{item.owner}</span></div>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>
                <span className="review-link" aria-hidden="true"><ArrowIcon /></span>
              </article>
            ))}
          </div>
        </section>

        <aside className="panel boundary-panel" id="controls" aria-labelledby="boundary-title">
          <div className="panel-heading"><div><p className="eyebrow">Boundary monitor</p><h2 id="boundary-title">External effects</h2></div></div>
          <div className="boundary-summary">
            <span className="boundary-lock" aria-hidden="true">×</span>
            <div><strong>0 verified live</strong><p>{kernelEnabledCount} capabilities are declared enabled in the kernel.</p></div>
          </div>
          <ul className="domain-list">
            {domainReadiness.map((domain) => (
              <li key={domain.name}><span>{domain.name}</span><StatusPill status={domain.status} /></li>
            ))}
          </ul>
          <p className="panel-note">Provider names describe planned boundaries, not verified connections.</p>
        </aside>
      </div>

      <section className="connections-section" id="connections" aria-labelledby="connections-title">
        <div className="connections-heading">
          <div><p className="eyebrow">Connection board</p><h2 id="connections-title">What is wired. What is still needed.</h2></div>
          <div className="connection-totals" aria-label="Connection readiness totals">
            <span><b>{kernelEnabledCount}</b> enabled in kernel</span>
            <span><b>{localConfigCount}</b> local configs detected</span>
            <span><b>0</b> live verified</span>
          </div>
        </div>
        <div className="connection-grid">
          {connections.map((item) => (
            <article className="connection-card" key={item.id}>
              <div className="connection-card-head">
                <h3>{item.name}</h3>
                <StatusPill status={item.status} />
              </div>
              <div className={`kernel-state ${item.configuredInKernel ? 'kernel-enabled' : 'kernel-disabled'}`}>
                <span aria-hidden="true" />
                {item.configuredInKernel ? 'Enabled in kernel' : 'Not enabled in kernel'}
              </div>
              <p>{item.detail}</p>
              <div className="connection-needed"><span>{item.stateLabel}</span><strong>{item.needed}</strong></div>
            </article>
          ))}
        </div>
        <p className="connections-note">Green means declared in repository configuration—not authenticated, reachable, or authorized. Live verification requires an account-bound check and a receipt.</p>
      </section>

      <section className="recovery-section" id="recovery" aria-labelledby="recovery-title">
        <div className="recovery-heading">
          <div><p className="eyebrow">Production gate</p><h2 id="recovery-title">Recovery before autonomy</h2></div>
          <p>Activation stays blocked until state survives a crash, effects can be reconciled, and every decision remains attributable.</p>
        </div>
        <div className="recovery-grid">
          {recoveryItems.map((item) => (
            <article key={item.title}>
              <span className={`recovery-signal recovery-${item.status}`} aria-hidden="true" />
              <h3>{item.title}</h3><p>{item.detail}</p><StatusPill status={item.status} />
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        <div><span className="footer-label">Evidence</span><strong>Local repository</strong></div>
        <div><span className="footer-label">Runtime data</span><strong>Not connected</strong></div>
        <div><span className="footer-label">Production</span><strong>Startup blocked</strong></div>
        <p>Hutchrok Solutions Group · Control plane review surface</p>
      </footer>
    </main>
  );
}
