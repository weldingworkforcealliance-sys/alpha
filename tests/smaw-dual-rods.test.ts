import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const overlay = readFileSync('public/tower-ui/smaw-electrodes.js', 'utf8');
const index = readFileSync('public/tower-ui/index.html', 'utf8');
const migration = readFileSync(
  'supabase/migrations/20261002170000_smaw_dual_electrode_assignments.sql',
  'utf8'
);

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function runtime() {
  const assignments = [
    {
      id: 'smaw-fillet-1F',
      processId: 'smaw',
      process: 'SMAW',
      material: 'Carbon Steel',
      family: 'Fillet',
      backing: 'N/A',
      position: '1F',
      electrode: 'E6010/E6011 · 1/8 in.',
      electrodeCode: '6010/11',
      type: 'position',
      rubricType: 'weld',
    },
    {
      id: 'smaw-fillet-1F-e7018',
      processId: 'smaw',
      process: 'SMAW',
      material: 'Carbon Steel',
      family: 'Fillet',
      backing: 'N/A',
      position: '1F',
      electrode: 'E7018 · 1/8 in.',
      electrodeCode: '7018',
      type: 'position',
      rubricType: 'weld',
    },
    {
      id: 'gmaw-s-fillet-1F',
      processId: 'gmaw-s',
      process: 'GMAW-S',
      material: 'Carbon Steel',
      family: 'Fillet',
      backing: 'N/A',
      position: '1F',
      electrode: '',
      type: 'position',
      rubricType: 'weld',
    },
  ];

  const context = vm.createContext({
    state: { assignments, ui: { labAssignmentId: 'smaw-fillet-1F' } },
    assignmentById: (id: string) => assignments.find(assignment => assignment.id === id),
    escapeHtml,
    projectGroupKey: (assignment: (typeof assignments)[number]) =>
      [assignment.processId, assignment.material, assignment.family, assignment.backing].join('|'),
    renderLab: () =>
      '<select id="labAssignmentSelect">' +
      '<option value="smaw-fillet-1F" selected>Fillet · 1F</option>' +
      '<option value="smaw-fillet-1F-e7018">Fillet · 1F</option>' +
      '<option value="gmaw-s-fillet-1F">Fillet · 1F</option>' +
      '</select>' +
      '<div class="muted small">SMAW Carbon Steel · Fillet · only the current project group is shown so the gradebook stays usable.</div>',
  });

  vm.runInContext(overlay, context);
  return { run: (code: string) => vm.runInContext(code, context) };
}

describe('SMAW rod-specific Tower assignments', () => {
  it('loads the label enhancement after the main Tower runtime', () => {
    expect(index).toContain('<script src="./app.js"></script>');
    expect(index).toContain('<script src="./smaw-electrodes.js"></script>');
    expect(index.indexOf('./app.js')).toBeLessThan(index.indexOf('./smaw-electrodes.js'));
  });

  it('lists 6010/11 and 7018 separately under the same SMAW position', () => {
    const r = runtime();
    const html = r.run('renderLab()') as string;

    expect(html).toContain('Fillet · 1F · 6010/11');
    expect(html).toContain('Fillet · 1F · 7018');
    expect(html).toContain(
      'SMAW Carbon Steel · Fillet · 6010/11 · only the current project group is shown'
    );
    expect(html).toContain('<option value="gmaw-s-fillet-1F">Fillet · 1F</option>');
  });

  it('keeps each SMAW rod in its own class-gradebook project group', () => {
    const r = runtime();
    expect(r.run('projectGroupKey(state.assignments[0])')).not.toBe(
      r.run('projectGroupKey(state.assignments[1])')
    );
    expect(r.run('projectGroupKey(state.assignments[2])')).toBe(
      'gmaw-s|Carbon Steel|Fillet|N/A'
    );
  });

  it('seeds both rod groups for all 12 canonical SMAW positions', () => {
    expect(migration).toContain("'electrodeCode', '6010/11'");
    expect(migration).toContain("'electrodeCode', '7018'");
    expect(migration).toContain('assignment_count <> 24');
    expect(migration).toContain("assignment.id || '-e7018'");
  });
});
