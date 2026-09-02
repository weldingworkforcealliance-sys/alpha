'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

type SectionRow = {
  section_id: string;
  course_code: string | null;
  course_name: string | null;
  cohort_name: string | null;
  section_name: string | null;
  section_code: string | null;
};

export default function TeacherIdentityBar({ pathname }: { pathname: string }) {
  const [name, setName] = useState('');
  const [classLabels, setClassLabels] = useState<string[]>([]);
  const [visible, setVisible] = useState(false);
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  );

  useEffect(() => {
    const shouldShow = pathname === '/dashboard' || pathname === '/agenda';
    if (!shouldShow) {
      setVisible(false);
      return;
    }

    const loadIdentity = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        if (!user) {
          setVisible(false);
          return;
        }

        const [profileResult, assignmentResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('display_name, email')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('section_instructors')
            .select('section_id')
            .eq('instructor_id', user.id)
            .eq('active', true),
        ]);

        if (assignmentResult.error) {
          console.error('Failed to load instructor assignments:', assignmentResult.error);
          setVisible(false);
          return;
        }

        const assignmentIds = Array.from(
          new Set((assignmentResult.data ?? []).map((row) => row.section_id))
        );

        if (assignmentIds.length === 0) {
          setVisible(false);
          return;
        }

        const { data: sectionData, error: sectionError } = await supabase
          .from('current_teaching_sections')
          .select(
            'section_id, course_code, course_name, cohort_name, section_name, section_code'
          )
          .in('section_id', assignmentIds);

        if (sectionError) {
          console.error('Failed to load assigned section labels:', sectionError);
          setVisible(false);
          return;
        }

        const profile = profileResult.data;
        setName(
          profile?.display_name?.trim() ||
            profile?.email?.trim() ||
            user.email ||
            'Instructor'
        );

        const labels = ((sectionData ?? []) as SectionRow[]).map((section) => {
          const course = section.course_code || section.course_name || 'Course';
          const group =
            section.cohort_name ||
            section.section_name ||
            section.section_code ||
            'Section';
          return `${course} · ${group}`;
        });

        setClassLabels(Array.from(new Set(labels)));
        setVisible(true);
      } catch (error) {
        console.error('Failed to load teacher identity bar:', error);
        setVisible(false);
      }
    };

    loadIdentity();
  }, [pathname, supabase]);

  if (!visible) return null;

  return (
    <div
      aria-label="Assigned instructor"
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
        <span style={{ color: '#8a8a8a', fontWeight: 700 }}>Assigned Instructor: </span>
        <strong style={{ color: '#00ff88' }}>{name}</strong>
      </div>
      <div style={{ color: '#aaa', textAlign: 'right' }}>
        <span style={{ fontWeight: 700 }}>Assigned Class{classLabels.length === 1 ? '' : 'es'}: </span>
        {classLabels.join(' | ')}
      </div>
    </div>
  );
}
