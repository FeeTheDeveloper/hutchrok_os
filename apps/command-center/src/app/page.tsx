/**
 * Hutchrok Command Center — Home Dashboard
 *
 * Primary screen answers: WHAT REQUIRES KING FEE'S ATTENTION RIGHT NOW?
 *
 * Sections:
 * - Action Required
 * - Critical Alerts
 * - Revenue
 * - Leads
 * - Customers Waiting
 * - Filings Requiring Approval
 * - Payments
 * - Calendar
 * - Government Opportunities
 * - Campaign Performance
 * - System Health
 * - Claude Build Status
 */

export default function DashboardPage() {
  return (
    <main style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <h1 style={styles.brand}>HUTCHROK</h1>
          <div style={styles.headerActions}>
            <QuickActionButton label="APPROVE" />
            <QuickActionButton label="ASK" />
            <QuickActionButton label="SEARCH" />
          </div>
        </div>
        <p style={styles.tagline}>What requires your attention right now?</p>
      </header>

      {/* Sections */}
      <div style={styles.sections}>
        <DashboardSection title="⚡ Action Required" priority="critical">
          <PlaceholderCard message="Wire up to approvals service" />
        </DashboardSection>

        <DashboardSection title="🔴 Critical Alerts" priority="high">
          <PlaceholderCard message="Wire up to alerts service" />
        </DashboardSection>

        <DashboardSection title="💵 Revenue" priority="normal">
          <StatCard label="Today" value="—" />
          <StatCard label="This Month" value="—" />
        </DashboardSection>

        <DashboardSection title="🎯 Leads" priority="normal">
          <StatCard label="New Today" value="—" />
          <StatCard label="Qualified" value="—" />
        </DashboardSection>

        <DashboardSection title="👥 Customers Waiting" priority="high">
          <PlaceholderCard message="Wire up to communications service" />
        </DashboardSection>

        <DashboardSection title="📋 Filings Requiring Approval" priority="high">
          <PlaceholderCard message="Wire up to filing service" />
        </DashboardSection>

        <DashboardSection title="🏛️ Government Opportunities" priority="normal">
          <PlaceholderCard message="Wire up to GovCon service" />
        </DashboardSection>

        <DashboardSection title="📊 Campaign Performance" priority="normal">
          <PlaceholderCard message="Wire up to marketing analytics" />
        </DashboardSection>

        <DashboardSection title="🔧 System Health" priority="normal">
          <StatCard label="API" value="—" />
          <StatCard label="DB" value="—" />
        </DashboardSection>

        <DashboardSection title="🤖 Claude Build Status" priority="normal">
          <PlaceholderCard message="Wire up to development service" />
        </DashboardSection>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────

function DashboardSection({
  title,
  priority,
  children,
}: {
  title: string;
  priority: 'critical' | 'high' | 'normal';
  children: React.ReactNode;
}) {
  const borderColor = priority === 'critical' ? '#ff3333' : priority === 'high' ? '#ff9900' : '#333';
  return (
    <section style={{ ...styles.section, borderLeft: `3px solid ${borderColor}` }}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <div style={styles.sectionContent}>{children}</div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function PlaceholderCard({ message }: { message: string }) {
  return (
    <div style={styles.placeholder}>
      <span style={{ color: '#666', fontSize: '12px' }}>{message}</span>
    </div>
  );
}

function QuickActionButton({ label }: { label: string }) {
  return (
    <button style={styles.quickAction} type="button">
      {label}
    </button>
  );
}

// ─────────────────────────────────────────
// Styles (inline for zero-dependency bootstrap)
// ─────────────────────────────────────────

const styles = {
  container: {
    minHeight: '100vh',
    background: '#0a0a0a',
    color: '#fff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    maxWidth: '480px',
    margin: '0 auto',
    paddingBottom: '32px',
  },
  header: {
    padding: '20px 16px 12px',
    background: '#111',
    borderBottom: '1px solid #222',
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
  },
  headerInner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  brand: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 900,
    letterSpacing: '0.1em',
    color: '#fff',
  },
  tagline: {
    margin: '4px 0 0',
    fontSize: '12px',
    color: '#666',
    fontStyle: 'italic',
  },
  headerActions: {
    display: 'flex',
    gap: '6px',
  },
  quickAction: {
    background: '#1a1a1a',
    border: '1px solid #333',
    color: '#fff',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.05em',
  },
  sections: {
    padding: '0 0 16px',
  },
  section: {
    margin: '12px 16px',
    padding: '14px 14px',
    background: '#111',
    borderRadius: '8px',
    borderLeft: '3px solid #333',
  },
  sectionTitle: {
    margin: '0 0 10px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#ccc',
    letterSpacing: '0.03em',
  },
  sectionContent: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  statCard: {
    background: '#1a1a1a',
    borderRadius: '6px',
    padding: '10px 14px',
    minWidth: '80px',
    textAlign: 'center' as const,
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#fff',
  },
  statLabel: {
    fontSize: '10px',
    color: '#666',
    marginTop: '2px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  placeholder: {
    padding: '8px 0',
    width: '100%',
  },
} as const;
