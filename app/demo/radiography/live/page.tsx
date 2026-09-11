'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';

type LiveConfig = {
  day: number;
  course: string;
  sectionCode: string;
  assessmentSlug: string;
  assessmentTitle: string;
};

const LIVE_DAYS: Record<number, LiveConfig> = {
  1: { day: 1, course: 'RA 101', sectionCode: 'RAD-RA101', assessmentSlug: 'rad_demo_d1_orientation', assessmentTitle: 'Professional Practice Live Check' },
  2: { day: 2, course: 'RA 101', sectionCode: 'RAD-RA101', assessmentSlug: 'rad_demo_d2_radiation_safety', assessmentTitle: 'Radiation Safety Live Check' },
  3: { day: 3, course: 'RA 101', sectionCode: 'RAD-RA101', assessmentSlug: 'rad_demo_d3_patient_care', assessmentTitle: 'Patient Care Workflow Live Check' },
  4: { day: 4, course: 'RA 102', sectionCode: 'RAD-RA102', assessmentSlug: 'rad_demo_d4_positioning_lab', assessmentTitle: 'Positioning Lab Readiness' },
  5: { day: 5, course: 'RA 102', sectionCode: 'RAD-RA102', assessmentSlug: 'rad_demo_d5_image_critique', assessmentTitle: 'Image Critique Live Check' },
  6: { day: 6, course: 'RA 103', sectionCode: 'RAD-RA103', assessmentSlug: 'rad_demo_d6_clinical_evidence', assessmentTitle: 'Clinical Evidence Readiness' },
  7: { day: 7, course: 'RA 103', sectionCode: 'RAD-RA103', assessmentSlug: 'rad_demo_d7_progress_review', assessmentTitle: 'Integrated Progress Review' },
};

type TeachingSection = {
  section_id: string;
  section_code: string | null;
};

export default function RadiographyLiveClassroomHandoff() {
  const router = useRouter();
  const [supabase] = useState(getSupabase);
  const [dayNumber, setDayNumber] = useState<number | null>(null);
  const [status, setStatus] = useState('Opening LTG Live Classroom…');
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);

  const config = useMemo(() => LIVE_DAYS[dayNumber ?? 1] ?? LIVE_DAYS[1], [dayNumber]);

  useEffect(() => {
    const value = Number(new URLSearchParams(window.location.search).get('day'));
    setDayNumber(value >= 1 && value <= 7 ? value : 1);
  }, []);

  useEffect(() => {
    if (dayNumber === null) return;
    let cancelled = false;

    const handoff = async () => {
      setError('');
      setNeedsLogin(false);
      setStatus(`Locating ${config.course} demo section…`);

      const { data: auth, error: authError } = await supabase.auth.getSession();
      if (authError) {
        if (!cancelled) setError(authError.message);
        return;
      }
      if (!auth.session) {
        if (!cancelled) {
          setNeedsLogin(true);
          setStatus('Instructor login required');
        }
        return;
      }

      const { data, error: sectionError } = await supabase
        .from('current_teaching_sections')
        .select('section_id,section_code')
        .eq('section_code', config.sectionCode)
        .limit(1);

      if (sectionError) {
        if (!cancelled) setError(sectionError.message);
        return;
      }

      const section = ((data ?? [])[0] ?? null) as TeachingSection | null;
      if (!section) {
        if (!cancelled) {
          setStatus('Radiography demo section not found');
          setError(`The staging ${config.course} section (${config.sectionCode}) is not available to this account.`);
        }
        return;
      }

      if (!cancelled) {
        setStatus(`Opening ${config.assessmentTitle} in the built LTG Live Classroom…`);
        router.replace(
          `/classroom/planner?section=${encodeURIComponent(section.section_id)}&assessment=${encodeURIComponent(config.assessmentSlug)}`
        );
      }
    };

    handoff();
    return () => { cancelled = true; };
  }, [config, dayNumber, router, supabase]);

  return (
    <main style={{ minHeight: '100vh', background: '#080808', color: '#ddd', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section style={{ width: 'min(720px,100%)', border: '1px solid #292929', borderRadius: 12, background: '#131313', padding: 24 }}>
        <div style={{ color: '#9adf4b', fontSize: 10, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase' }}>Living Teacher Guide · Planner Assessment</div>
        <h1 style={{ margin: '8px 0 4px', color: '#fff' }}>{config.course} · Day {config.day}</h1>
        <h2 style={{ margin: '0 0 18px', color: '#fff', fontSize: 20 }}>{config.assessmentTitle}</h2>
        <p style={{ color: '#999', lineHeight: 1.6 }}>{status}</p>
        {error && <div style={{ border: '1px solid #713333', background: '#1c0c0c', color: '#ff9999', borderRadius: 8, padding: 12, marginTop: 14 }}>{error}</div>}
        {needsLogin && <button type="button" onClick={() => router.push('/login')} style={{ marginTop: 18, border: '1px solid #9adf4b', background: 'rgba(154,223,75,.08)', color: '#caff77', borderRadius: 8, padding: '11px 14px', fontWeight: 900, cursor: 'pointer' }}>Instructor Login</button>}
      </section>
    </main>
  );
}
