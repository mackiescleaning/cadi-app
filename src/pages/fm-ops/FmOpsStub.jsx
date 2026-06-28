import { Link } from 'react-router-dom';
import { Construction, ExternalLink } from 'lucide-react';
import { FM_OPS_TOKENS } from '../../components/fm-ops/FmOpsLayout';

const { NAVY, INK, SUB, MUTE, LINE, PAPER, ACCENT } = FM_OPS_TOKENS;

export default function FmOpsStub({ title, intent, nextStep }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${LINE}`,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: INK, letterSpacing: '-0.01em' }}>{title}</div>
          <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>{intent}</div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 800, color: ACCENT, background: `${ACCENT}15`, padding: '4px 10px', borderRadius: 999, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Next up
        </span>
      </div>

      <div style={{
        background: PAPER, border: `1.5px dashed ${LINE}`, borderRadius: 14,
        padding: 32, textAlign: 'center', maxWidth: 560, margin: '40px auto 0',
      }}>
        <div style={{ width: 52, height: 52, borderRadius: 13, background: `${NAVY}10`, color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <Construction size={24} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: INK, marginBottom: 8 }}>This screen isn't wired up yet</div>
        {nextStep && <div style={{ fontSize: 12, color: SUB, lineHeight: 1.6, marginBottom: 18 }}>{nextStep}</div>}
        <Link
          to="/wireframe/fm-ops-portal"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 800, color: ACCENT,
            background: `${ACCENT}10`, border: `1px solid ${ACCENT}25`,
            borderRadius: 8, padding: '8px 14px', textDecoration: 'none',
          }}
        >
          View design spec <ExternalLink size={11} />
        </Link>
      </div>
    </div>
  );
}
