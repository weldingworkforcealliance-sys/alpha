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
  course_code: string | null;
  section_name: string | null;
};

export default function RadiographyLiveLauncherPage() {
  const router = useRouter();
  const [supabase] = useState(getSupabase);
  const [dayNumber, setDayNumber] = useState(1);
  const [status, setStatus] = useState('Preparing Connected Classroom…');
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);

  const config = useMemo(() => LIVE_DAYS[dayNumber] ?? LIVE_DAYS[1], [dayNumber]);

  useEffect(() => {
    const value = Number(new URLSearchParams(window.location.search).get('day'));
    if (value >= 1 && value <= 7) setDayNumber(value);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const routeToClassroom = async () => {
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
        .select('section_id,section_code,course_code,section_name')
        .eq('section_code', config.sectionCode)
        .limit(1);

      if (sectionError) {
        if (!cancelled) setError(sectionError.message);
        return;
      }

      const section = ((data ?? [])[0] ?? null) as TeachingSection | null;
      if (!section) {
        if (!cancelled) {
          setError(`The staging ${config.course} section (${config.sectionCode}) is not available to this account.`);
          setStatus('Radiography demo section not found');
        }
        return;
      }

      if (!cancelled) {
        setStatus(`Opening ${config.assessmentTitle}…`);
        router.replace(`/classroom?section=${encodeURIComponent(section.section_id)}&assessment=${encodeURIComponent(config.assessmentSlug)}`);
      }
    };

    routeToClassroom();
    return () => { cancelled = true; };
  }, [config, router, supabase]);

  return (
    <main style={{ minHeight: '100vh', background: '#0d1b26', color: '#f1f4f6', padding: 'clamp(18px,4vw,54px)', display: 'grid', placeItems: 'center' }}>
      <section style={{ width: 'min(760px,100%)', border: '1px solid #415668', borderTop: '4px solid #f0641d', background: '#172b3a', borderRadius: 14, padding: 24 }}>
        <div style={{ color: '#f0641d', fontSize: 11, fontWeight: 900, letterSpacing: '.12em' }}>RADIOGRAPHY · CONNECTED CLASSROOM</div>
        <h1 style={{ margin: '8px 0 4px', fontSize: 'clamp(28px,4vw,44px)' }}>{config.course} · Day {config.day}</h1>
        <h2 style={{ margin: '0 0 18px', color: '#b9e2f1', fontSize: 20 }}>{config.assessmentTitle}</h2>
        <p style={{ color: '#b4bec6', lineHeight: 1.6 }}>{status}</p>
        {error && <div style={{ border: '1px solid #965b55', background: '#3b2020', color: '#ffd1cd', borderRadius: 8, padding: 12, marginTop: 14 }}>{error}</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
          {needsLogin && <button type="button" onClick={() => router.push('/login')} style={{ border: '1px solid #f0641d', background: '#e95d18', color: '#fff', borderRadius: 8, padding: '11px 14px', fontWeight: 900, cursor: 'pointer' }}>Instructor Login</button>}
          <button type="button" onClick={() => router.push(`/demo/radiography?day=${config.day}`)} style={{ border: '1px solid #415668', background: '#233948', color: '#f1f4f6', borderRadius: 8, padding: '11px 14px', fontWeight: 900, cursor: 'pointer' }}>Back to Radiography LTG</button>
        </div>
        <p style={{ marginTop: 20, fontSize: 12, color: '#83939e', lineHeight: 1.5 }}>This launcher uses the same LTG Connected Classroom engine as the live Welding platform. Students join with the session code or QR link generated by the instructor.</p>
      </section>
    </main>
  );
}
