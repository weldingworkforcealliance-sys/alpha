'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

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

const STORAGE_KEY = 'ltp_selected_section_id';
const SECTION_EVENT = 'ltp:section-change';

function normalize(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function courseLabel(row: WorkspaceRow) {
  return row.course_code || row.course_name || 'Course';
}

export default function CohortWorkspaceBar({ pathname }: { pathname: string }) {
  const supportedPage = pathname === '/dashboard' || pathname === '/agenda';
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  );
  const [rows, setRows] = useState<WorkspaceRow[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [preferredSectionId, setPreferredSectionId] = useState('');

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

  const findDashboardButton = useCallback((row: WorkspaceRow) => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.sections-list .section-button')
    );
    const course = normalize(courseLabel(row));
    const cohort = normalize(row.cohort_name);
    const section = normalize(row.section_name);

    return (
      buttons.find((button) => {
        const text = normalize(button.textContent);
        return text.includes(course) && Boolean(cohort) && text.includes(cohort);
      }) ??
      buttons.find((button) => {
        const text = normalize(button.textContent);
        return text.includes(course) && Boolean(section) && text.includes(section);
      }) ??
      null
    );
  }, []);

  const findAgendaSelect = useCallback(() => {
    const sectionIds = new Set(rows.map((row) => row.section_id));
    return (
      Array.from(document.querySelectorAll<HTMLSelectElement>('select')).find((select) =>
        Array.from(select.options).some((option) => sectionIds.has(option.value))
      ) ?? null
    );
  }, [rows]);

  const activateSection = useCallback(
    (row: WorkspaceRow) => {
      setSelectedSectionId(row.section_id);
      window.localStorage.setItem(STORAGE_KEY, row.section_id);
      window.dispatchEvent(
        new CustomEvent(SECTION_EVENT, { detail: { sectionId: row.section_id } })
      );

      if (pathname === '/dashboard') {
        const button = findDashboardButton(row);
        if (button) button.click();
        return;
      }

      if (pathname === '/agenda') {
        const select = findAgendaSelect();
        if (select && select.value !== row.section_id) {
          select.value = row.section_id;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    },
    [findAgendaSelect, findDashboardButton, pathname]
  );

  const detectPageSelection = useCallback(() => {
    if (!rows.length) return false;

    if (pathname === '/dashboard') {
      const active = document.querySelector<HTMLButtonElement>(
        '.sections-list .section-button.active'
      );
      if (!active) return false;
      const text = normalize(active.textContent);
      const matched = rows.find((row) => {
        const course = normalize(courseLabel(row));
        const cohort = normalize(row.cohort_name);
        return text.includes(course) && Boolean(cohort) && text.includes(cohort);
      });
      if (matched) {
        if (matched.section_id !== selectedSectionId) {
          setSelectedSectionId(matched.section_id);
          window.localStorage.setItem(STORAGE_KEY, matched.section_id);
          window.dispatchEvent(
            new CustomEvent(SECTION_EVENT, {
              detail: { sectionId: matched.section_id },
            })
          );
        }
        return true;
      }
      return false;
    }

    if (pathname === '/agenda') {
      const select = findAgendaSelect();
      const matched = select
        ? rows.find((row) => row.section_id === select.value)
        : null;
      if (matched) {
        if (matched.section_id !== selectedSectionId) {
          setSelectedSectionId(matched.section_id);
          window.localStorage.setItem(STORAGE_KEY, matched.section_id);
          window.dispatchEvent(
            new CustomEvent(SECTION_EVENT, {
              detail: { sectionId: matched.section_id },
            })
          );
        }
        return true;
      }
    }

    return false;
  }, [findAgendaSelect, pathname, rows, selectedSectionId]);

  useEffect(() => {
    if (!supportedPage) {
      setRows([]);
      setSelectedSectionId('');
      setPreferredSectionId('');
      return;
    }

    let cancelled = false;
    setSelectedSectionId('');
    setPreferredSectionId('');

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
      const savedSectionId = window.localStorage.getItem(STORAGE_KEY);
      const savedPreferred = loadedRows.find(
        (row) => row.section_id === savedSectionId
      );
      const assignedPreferred = loadedRows.find((row) => assignedIds.has(row.section_id));
      const defaultPreferred =
        savedPreferred ??
        assignedPreferred ??
        loadedRows.find((row) => row.course_code === 'WLD 105') ??
        loadedRows[0];

      setRows(loadedRows);
      setPreferredSectionId(defaultPreferred?.section_id ?? '');
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [pathname, supportedPage, supabase]);

  useEffect(() => {
    if (!supportedPage || rows.length === 0) return;

    const hidden = new Map<HTMLElement, string>();

    const hideLegacySelectors = () => {
      if (pathname === '/dashboard') {
        document.querySelectorAll<HTMLElement>('.sections-navigation').forEach((element) => {
          if (!hidden.has(element)) {
            hidden.set(element, element.style.display);
            element.style.display = 'none';
          }
        });
      }

      if (pathname === '/agenda') {
        const select = findAgendaSelect();
        const label = select?.closest('label') as HTMLElement | null;
        if (label && !hidden.has(label)) {
          hidden.set(label, label.style.display);
          label.style.display = 'none';
        }
      }
    };

    const sync = () => {
      hideLegacySelectors();

      if (!selectedSectionId) {
        const preferred = rows.find((row) => row.section_id === preferredSectionId);
        if (preferred) {
          activateSection(preferred);
          return;
        }
      }

      detectPageSelection();
    };

    const timer = window.setTimeout(sync, 75);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'value'],
    });

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      hidden.forEach((display, element) => {
        element.style.display = display;
      });
    };
  }, [
    activateSection,
    detectPageSelection,
    findAgendaSelect,
    pathname,
    preferredSectionId,
    rows,
    selectedSectionId,
    supportedPage,
  ]);

  if (!supportedPage || groups.length === 0) return null;

  const selectWorkspace = (group: WorkspaceGroup) => {
    const currentCourse = selectedRow?.course_code;
    const target =
      group.rows.find((row) => row.course_code === currentCourse) ??
      group.rows.find((row) => row.course_code === 'WLD 105') ??
      group.rows[0];
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
