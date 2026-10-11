'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';

type Section = { section_id: string; section_name: string; guide_day_id: string | null };
type Assessment = { slug: string; title: string };

export default function SharedMathClassroom() {
  const router = useRouter();
  const [supabase] = useState(getSupabase);
  const [sections, setSections] = useState<Section[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [sectionId, setSectionId] = useState('');
  const [day, setDay] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getSession();
        if (!auth.session) { router.replace('/login'); return; }
        const params = new URLSearchParams(window.location.search);
        const requestedSection = params.get('section') || '';
        const requestedDay = params.get('day') || '';
        const [classes, modules] = await Promise.all([
          supabase.from('current_teaching_sections').select('section_id,section_name,guide_day_id').eq('course_code', 'WLD 205'),
          supabase.rpc('list_assessment_modules_v2'),
        ]);
        if (classes.error) throw classes.error;
        if (modules.error) throw modules.error;
        const available = (modules.data as Assessment[] || []).filter(a => /^wld205_shared_math_v1_d\d{2}$/.test(a.slug)).sort((a, b) => a.slug.localeCompare(b.slug));
        const rows = (classes.data || []) as Section[];
        if (requestedSection && !rows.some(s => s.section_id === requestedSection)) throw new Error('This class is not available. Open shared math from your WLD 205 planner.');
        const chosen = rows.find(s => s.section_id === requestedSection) || (rows.length === 1 ? rows[0] : null);
        let selectedDay = requestedDay;
        if (requestedDay && (!/^[1-9]\d?$/.test(requestedDay) || !available.some(a => a.slug === `wld205_shared_math_v1_d${requestedDay.padStart(2, '0')}`))) throw new Error('This shared math lesson is unavailable. Open a lesson from the planner.');
        if (!selectedDay && chosen?.guide_day_id) {
          const lesson = await supabase.from('course_guide_day_math').select('shared_math_day_number').eq('guide_day_id', chosen.guide_day_id).maybeSingle();
          if (lesson.error) throw lesson.error;
          const mapped = lesson.data?.shared_math_day_number;
          if (mapped && available.some(a => a.slug === `wld205_shared_math_v1_d${String(mapped).padStart(2, '0')}`)) selectedDay = String(mapped);
        }
        if (!alive) return;
        setSections(rows); setAssessments(available); setSectionId(chosen?.section_id || ''); setDay(selectedDay);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Unable to load shared math. Please reopen it from the planner.');
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [router, supabase]);

  if (loading) return <main>Loading shared math classroom…</main>;
  return <main className="page-shell">
    <h1>Shared Math Classroom</h1>
    <p>Choose your class and lesson, then open the classroom to start its student join code.</p>
    {error ? <p role="alert">{error}</p> : <>
      <label>Class <select value={sectionId} onChange={e => { setSectionId(e.target.value); setDay(''); }}>
        <option value="">Choose a class</option>
        {sections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
      </select></label>
      <label>Math lesson <select value={day} onChange={e => setDay(e.target.value)}>
        <option value="">Choose a lesson</option>
        {assessments.map(a => <option key={a.slug} value={String(Number(a.slug.slice(-2)))}>{a.title}</option>)}
      </select></label>
      {!sections.length && <p>No WLD 205 classes are available for your account.</p>}
      {!assessments.length && <p>No shared math lessons are currently available.</p>}
      <button disabled={!sectionId || !day} onClick={() => router.push(`/classroom/planner?section=${encodeURIComponent(sectionId)}&assessment=wld205_shared_math_v1_d${day.padStart(2, '0')}`)}>Open classroom</button>
    </>}
  </main>;
}
