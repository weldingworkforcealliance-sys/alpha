'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase-browser';
import {
  publishSelectedSection,
  readSelectedSectionId,
  subscribeSelectedSection,
} from '@/lib/section-selection';

type SectionRow = {
  section_id: string;
  course_code: string | null;
  course_name: string | null;
  cohort_name: string | null;
  section_name: string | null;
  section_code: string | null;
};

type InstructorRow = {
  instructor_id: string;
  display_name: string;
};

export default function TeacherIdentityBar({ pathname }: { pathname: string }) {
  const [instructorNames, setInstructorNames] = useState<string[]>([]);
  const [classLabel, setClassLabel] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [visible, setVisible] = useState(false);
  const [supabase] = useState(getSupabase);

  const supportedPage = pathname === '/dashboard' || pathname === '/agenda';

  useEffect(() => {
    if (!supportedPage) {
      setVisible(false);
      setSelectedSectionId('');
      return;
    }

    setSelectedSectionId(readSelectedSectionId());
    return subscribeSelectedSection(setSelectedSectionId);
  }, [supportedPage]);

  useEffect(() => {
    if (!supportedPage) return;

    let cancelled = false;

    const loadIdentity = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session || cancelled) {
          setVisible(false);
          return;
        }

        let sectionId = selectedSectionId;
        let section: SectionRow | null = null;

        if (sectionId) {
          const selectedResult = await supabase
            .from('current_teaching_sections')
            .select(
              'section_id, course_code, course_name, cohort_name, section_name, section_code'
            )
            .eq('section_id', sectionId)
            .maybeSingle();

          if (!selectedResult.error) {
            section = (selectedResult.data ?? null) as SectionRow | null;
          }
        }

        if (!section) {
          const fallbackResult = await supabase
            .from('current_teaching_sections')
            .select(
              'section_id, course_code, course_name, cohort_name, section_name, section_code'
            )
            .limit(1)
            .maybeSingle();

          if (fallbackResult.error || !fallbackResult.data) {
            setVisible(false);
            return;
          }

          section = fallbackResult.data as SectionRow;
          sectionId = section.section_id;
          setSelectedSectionId(sectionId);
          publishSelectedSection(sectionId);
        }

        const { data: assignedData, error: assignedError } = await supabase.rpc(
          'get_section_instructor_names',
          { p_section_id: sectionId }
        );

        if (cancelled) return;

        if (assignedError) {
          console.error('Failed to load assigned instructors:', assignedError);
          setInstructorNames([]);
        } else {
          const names = ((assignedData ?? []) as InstructorRow[])
            .map((row) => row.display_name?.trim())
            .filter((name): name is string => Boolean(name));
          setInstructorNames(Array.from(new Set(names)));
        }

        const course = section.course_code || section.course_name || 'Course';
        const group =
          section.cohort_name ||
          section.section_name ||
          section.section_code ||
          'Section';

        setClassLabel(`${course} · ${group}`);
        setVisible(true);
      } catch (error) {
        console.error('Failed to load teacher identity bar:', error);
        setVisible(false);
      }
    };

    loadIdentity();

    return () => {
      cancelled = true;
    };
  }, [selectedSectionId, supportedPage, supabase]);

  if (!visible) return null;

  const instructorLabel = instructorNames.length === 1 ? 'Assigned Instructor' : 'Assigned Instructors';
  const instructorText = instructorNames.length
    ? instructorNames.join(' | ')
    : 'No instructor assigned';

  return (
    <div
      aria-label="Assigned instructor and selected class"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '14px',
        flexWrap: 'wrap',
        padding: '10px 16px',
        borderBottom: '1px solid rgba(0,255,136,.25)',
        background: 'rgba(0,255,136,.055)',
        color: '#d8d8d8',
        fontSize: '13px',
      }}
    >
      <div>
        <span style={{ color: '#8a8a8a', fontWeight: 700 }}>{instructorLabel}: </span>
        <strong style={{ color: '#00ff88' }}>{instructorText}</strong>
      </div>
      <div style={{ color: '#aaa', textAlign: 'right' }}>
        <span style={{ fontWeight: 700 }}>Selected Class: </span>
        {classLabel}
      </div>
    </div>
  );
}
