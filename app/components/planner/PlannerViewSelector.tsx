'use client';

import { ANTHONY_WLD205_PRESET, type PlannerViewChoice, type PlannerViewPreset } from '@/lib/wld205-anthony-view';

export default function PlannerViewSelector({
  preset,
  personalChoice,
  schoolPreset,
  canManageSchool,
  onSchoolChange,
  source,
  loading,
  saving,
  error,
  onChange,
}: {
  preset: PlannerViewPreset;
  personalChoice: PlannerViewChoice;
  schoolPreset: PlannerViewPreset;
  canManageSchool: boolean;
  onSchoolChange: (preset: PlannerViewPreset) => void;
  source: 'core' | 'school' | 'instructor';
  loading: boolean;
  saving: boolean;
  error: string;
  onChange: (choice: PlannerViewChoice) => void;
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
        My WLD 205 lesson view
      </label>
      <select
        id="wld205-view-preset"
        aria-label="WLD 205 teaching presentation"
        value={personalChoice}
        disabled={loading || saving}
        onChange={(event) => onChange(event.target.value as PlannerViewChoice)}
        style={{ padding: '7px 12px', maxWidth: '100%', color: '#eef8f4', background: '#203831', borderRadius: 7, border: '1px solid #72998c' }}
      >
        <option value="inherit">Use school default</option>
        <option value="standard">Original teacher view (my override)</option>
        <option value={ANTHONY_WLD205_PRESET}>Anthony v1 · streamlined</option>
      </select>
      <small style={{ color: '#a6c1b8' }}>
        {saving ? 'Saving…' : loading ? 'Checking preference…' : 'Effective: ' + (preset === ANTHONY_WLD205_PRESET ? 'Anthony v1' : 'Original') + ' · Source: ' + source + ' · Core unchanged'}
      </small>
      {canManageSchool && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: '100%', paddingTop: 8, borderTop: '1px solid #314e44' }}>
          <label htmlFor="wld205-school-view-preset" style={{ color: '#dbeae4', fontWeight: 600 }}>
            School default for this section
          </label>
          <select
            id="wld205-school-view-preset"
            value={schoolPreset}
            disabled={loading || saving}
            onChange={(event) => onSchoolChange(event.target.value as PlannerViewPreset)}
            style={{ padding: '7px 12px', maxWidth: '100%', color: '#eef8f4', background: '#203831', borderRadius: 7, border: '1px solid #72998c' }}
          >
            <option value="standard">Original teacher view</option>
            <option value={ANTHONY_WLD205_PRESET}>Anthony v1 · streamlined</option>
          </select>
          <small style={{ color: '#a6c1b8' }}>Instructor-specific overrides still take priority.</small>
        </div>
      )}
      {error && <small role="alert" style={{ color: '#ffbaba' }}>Preference not saved: {error}</small>}
    </div>
  );
}
