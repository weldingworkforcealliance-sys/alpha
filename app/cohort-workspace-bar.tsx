'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import styles from './cohort-workspace-bar.module.css';
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

function levelOf(group: WorkspaceGroup) {
  const codes = group.rows.map((row) => row.course_code ?? '');
  if (codes.some((code) => /\b(?:205|210|214|215|220|250)\b/.test(code))) return 2;
  if (codes.some((code) => /\b(?:105|110|114|115|120|150)\b/.test(code))) return 1;
  return /level\s*2|lvl\s*2/i.test(group.name) ? 2 : 1;
}

function className(group: WorkspaceGroup) {
  return group.name.replace(/\s*[-–]?\s*(?:level|lvl)\s*[12]\b/gi, '').trim();
}

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
    <section className={styles.selector} aria-label="Select class and course">
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2>Select class</h2>
          {selectedGroup && selectedRow && (
            <p className={styles.current} aria-live="polite" aria-atomic="true">
              Current: <strong>{className(selectedGroup)} · Level {levelOf(selectedGroup)} · {courseLabel(selectedRow)}</strong>
            </p>
          )}
        </header>

        <div className={styles.levels}>
          {[1, 2].map((level) => {
            const levelGroups = groups.filter((group) => levelOf(group) === level);
            if (!levelGroups.length) return null;
            return (
              <section key={level} className={styles.level} aria-label={`Level ${level} classes`}>
                <h3>Level {level}</h3>
                <div className={styles.classes}>
                  {levelGroups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      className={styles.choice}
                      aria-label={`${className(group)}, Level ${level}`}
                      aria-pressed={selectedGroup?.id === group.id}
                      onClick={() => selectWorkspace(group)}
                    >
                      <span className={styles.check} aria-hidden="true">✓</span>
                      <span>{className(group)}</span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {selectedGroup && (
          <div className={styles.courseRow}>
            <h3 className={styles.courseLabel}>Course</h3>
            <div className={styles.courses} role="group" aria-label={`Courses for ${selectedGroup.name}`}>
              {selectedGroup.rows.map((row) => (
                <button
                  key={row.section_id}
                  type="button"
                  className={`${styles.choice} ${styles.course}`}
                  aria-pressed={selectedSectionId === row.section_id}
                  onClick={() => activateSection(row)}
                >
                  <span className={styles.check} aria-hidden="true">✓</span>
                  <span>{courseLabel(row)}</span>
                  {row.planned_instructional_days ? <span className={styles.days}>{row.planned_instructional_days} days</span> : null}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
