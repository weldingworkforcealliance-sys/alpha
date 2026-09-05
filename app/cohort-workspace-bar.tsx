'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import {
  publishSelectedSection,
  readSelectedSectionId,
  subscribeSelectedSection,
} from '@/lib/section-selection';

type WorkspaceRow = {
  workspace_id: string;
  school_id: string;
  cohort_id: string;
  workspace_name: string;
  workspace_code: string | null;
  sort_order: number;
  section_id: string;
  section_name: string | null;
  section_code: string | null;
  course_code: string | null;
  course_name: string | null;
  cohort_name: string | null;
  planned_instructional_days: number | null;
};

type WorkspaceGroup = {
  id: string;
  name: string;
  code: string | null;
  sortOrder: number;
  rows: WorkspaceRow[];
};

function courseLabel(row: WorkspaceRow) {
  return row.course_code || row.course_name || 'Course';
}

export default function CohortWorkspaceBar({ pathname }: { pathname: string }) {
  const supportedPage =
    pathname === '/planner' || pathname === '/dashboard' || pathname === '/agenda';
  const [supabase] = useState(getSupabase);
  const [rows, setRows] = useState<WorkspaceRow[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');

  const groups = useMemo<WorkspaceGroup[]>(() => {
    const map = new Map<string, WorkspaceGroup>();

    rows.forEach((row) => {
      const existing = map.get(row.workspace_id);
      if (existing) {
        existing.rows.push(row);
        return;
      }

      map.set(row.workspace_id, {
        id: row.workspace_id,
        name: row.workspace_name,
        code: row.workspace_code,
        sortOrder: row.sort_order,
        rows: [row],
      });
    });

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        rows: [...group.rows].sort((a, b) =>
          courseLabel(a).localeCompare(courseLabel(b), undefined, { numeric: true })
        ),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [rows]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.section_id === selectedSectionId) ?? null,
    [rows, selectedSectionId]
  );

  const selectedGroup = useMemo(
    () =>
      selectedRow
        ? groups.find((group) => group.id === selectedRow.workspace_id) ?? null
        : null,
    [groups, selectedRow]
  );

  useEffect(() => {
    if (!supportedPage) {
      setRows([]);
      setSelectedSectionId('');
      return;
    }

    let cancelled = false;

    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId || cancelled) return;

      const [workspaceResult, assignmentResult] = await Promise.all([
        supabase
          .from('planner_workspace_sections')
          .select(
            'workspace_id,school_id,cohort_id,workspace_name,workspace_code,sort_order,section_id,section_name,section_code,course_code,course_name,cohort_name,planned_instructional_days'
          )
          .order('sort_order')
          .order('course_code'),
        supabase
          .from('section_instructors')
          .select('section_id')
          .eq('instructor_id', userId)
          .eq('active', true),
      ]);

      if (cancelled || workspaceResult.error) return;

      const loadedRows = (workspaceResult.data ?? []) as WorkspaceRow[];
      const assignedIds = new Set(
        (assignmentResult.data ?? []).map((row: { section_id: string }) => row.section_id)
      );
      const savedSectionId = readSelectedSectionId();
      const savedPreferred = loadedRows.find(
        (row) => row.section_id === savedSectionId
      );
      const assignedPreferred = loadedRows.find((row) => assignedIds.has(row.section_id));
      const defaultPreferred = savedPreferred ?? assignedPreferred ?? loadedRows[0] ?? null;

      setRows(loadedRows);
      setSelectedSectionId(defaultPreferred?.section_id ?? '');

      if (defaultPreferred && defaultPreferred.section_id !== savedSectionId) {
        publishSelectedSection(defaultPreferred.section_id);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [supportedPage, supabase]);

  useEffect(() => {
    if (!supportedPage) return;

    return subscribeSelectedSection((sectionId) => {
      if (rows.some((row) => row.section_id === sectionId)) {
        setSelectedSectionId(sectionId);
      }
    });
  }, [rows, supportedPage]);

  if (!supportedPage || groups.length === 0) return null;

  const activateSection = (row: WorkspaceRow) => {
    if (row.section_id === selectedSectionId) return;
    setSelectedSectionId(row.section_id);
    publishSelectedSection(row.section_id);
  };

  const selectWorkspace = (group: WorkspaceGroup) => {
    const currentCourse = selectedRow?.course_code;
    const target =
      group.rows.find((row) => row.course_code === currentCourse) ?? group.rows[0];
    if (target) activateSection(target);
  };

  return (
    <section
      aria-label="Class workspace selector"
      style={{
        padding: '14px 16px',
        borderBottom: '1px solid #242424',
        background: '#0a0d0c',
      }}
    >
      <div
        style={{
          maxWidth: '1180px',
          margin: '0 auto',
          display: 'grid',
          gap: '10px',
        }}
      >
        <div
          style={{
            color: '#8f9b95',
            fontSize: '11px',
            fontWeight: 900,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
          }}
        >
          Select Class
        </div>

        <div style={{ display: 'flex', gap: '9px', flexWrap: 'wrap' }}>
          {groups.map((group) => {
            const active = selectedGroup?.id === group.id;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => selectWorkspace(group)}
                style={{
                  minWidth: '135px',
                  padding: '11px 16px',
                  borderRadius: '8px',
                  border: active ? '1px solid #00ff88' : '1px solid #343a37',
                  background: active ? 'rgba(0,255,136,.09)' : '#111513',
                  color: active ? '#00ff88' : '#d7ddd9',
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                {group.name}
              </button>
            );
          })}
        </div>

        {selectedGroup && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              paddingTop: '2px',
            }}
          >
            {selectedGroup.rows.map((row) => {
              const active = selectedSectionId === row.section_id;
              return (
                <button
                  key={row.section_id}
                  type="button"
                  onClick={() => activateSection(row)}
                  style={{
                    padding: '8px 13px',
                    borderRadius: '7px',
                    border: active
                      ? '1px solid rgba(0,255,136,.75)'
                      : '1px solid #303633',
                    background: active ? '#13251c' : '#0d100f',
                    color: active ? '#b8ffd8' : '#aeb6b1',
                    fontSize: '12px',
                    fontWeight: 850,
                    cursor: 'pointer',
                  }}
                >
                  {courseLabel(row)}
                  {row.planned_instructional_days
                    ? ` · ${row.planned_instructional_days} days`
                    : ''}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
