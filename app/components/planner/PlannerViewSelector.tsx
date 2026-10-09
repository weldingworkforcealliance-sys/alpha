'use client';

import { ANTHONY_WLD205_PRESET, type PlannerViewPreset } from '@/lib/wld205-anthony-view';

export default function PlannerViewSelector({
  preset,
  source,
  loading,
  saving,
  error,
  onChange,
}: {
  preset: PlannerViewPreset;
  source: 'core' | 'school' | 'instructor';
  loading: boolean;
  saving: boolean;
  error: string;
  onChange: (preset: PlannerViewPreset) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginTop: '10px',
        marginBottom: '10px',
        padding: '10px 12px',
        border: '1px solid #3b5550',
        borderRadius: '10px',
        background: '#10211d',
      }}
    >
      <label htmlFor="wld205-view-preset" style={{ color: '#dbeae4', fontWeight: 700 }}>
        WLD 205 lesson view
      </label>
      <select
        id="wld205-view-preset"
        aria-label="WLD 205 teaching presentation"
        value={preset}
        disabled={loading || saving}
        onChange={(event) => onChange(event.target.value as PlannerViewPreset)}
        style={{ padding: '7px 12px', maxWidth: '100%', color: '#eef8f4', background: '#203831', borderRadius: 7, border: '1px solid #72998c' }}
      >
        <option value="standard">Original teacher view</option>
        <option value={ANTHONY_WLD205_PRESET}>Anthony v1 · streamlined</option>
      </select>
      <small style={{ color: '#a6c1b8' }}>
        {saving ? 'Saving…' : loading ? 'Checking preference…' : 'Source: ' + source + ' · Approved curriculum unchanged'}
      </small>
      {error && <small role="alert" style={{ color: '#ffbaba' }}>Preference not saved: {error}</small>}
    </div>
  );
}
