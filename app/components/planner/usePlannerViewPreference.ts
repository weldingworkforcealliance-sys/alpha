'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ANTHONY_WLD205_PRESET,
  isAnthonyWld205PilotSection,
  resolvePlannerViewPreset,
  type PlannerViewPreset,
  type PlannerViewRevision,
  type PlannerViewSection,
} from '@/lib/wld205-anthony-view';

export function usePlannerViewPreference(
  supabase: SupabaseClient,
  section: PlannerViewSection | null
) {
  const eligible = useMemo(
    () => isAnthonyWld205PilotSection(
      section,
      process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'staging'
    ),
    [section?.course_code, section?.section_code]
  );
  const [preset, setPreset] = useState<PlannerViewPreset>('standard');
  const [source, setSource] = useState<'core' | 'school' | 'instructor'>('core');
  const [loadedSectionId, setLoadedSectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setPreset('standard');
    setSource('core');
    setLoadedSectionId(null);
    setError('');
    if (!section || !eligible) return;

    const schoolId = section.school_id;
    const sectionId = section.section_id;
    setLoading(true);
    (async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw authError || new Error('Sign in to use custom instructor views.');
      const { data, error: queryError } = await supabase
        .from('planner_view_revisions')
        .select('id,scope,instructor_id,preset,changed_at')
        .eq('school_id', schoolId)
        .eq('section_id', sectionId)
        .order('changed_at', { ascending: false })
        .limit(200);
      if (queryError) throw queryError;
      const effective = resolvePlannerViewPreset(
        (data ?? []) as PlannerViewRevision[],
        auth.user.id
      );
      if (!cancelled) {
        setPreset(effective.preset);
        setSource(effective.source);
        setLoadedSectionId(sectionId);
      }
    })().catch((cause: unknown) => {
      if (!cancelled) {
        setLoadedSectionId(sectionId);
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [supabase, section?.school_id, section?.section_id, eligible]);

  const saveInstructorPreset = useCallback(async (next: PlannerViewPreset) => {
    if (!section || !eligible || saving) return;
    setSaving(true);
    setError('');
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw authError || new Error('Sign in to save preferences.');
      const { error: insertError } = await supabase
        .from('planner_view_revisions')
        .insert({
          school_id: section.school_id,
          section_id: section.section_id,
          scope: 'instructor',
          instructor_id: auth.user.id,
          preset: next,
          change_note: 'Instructor switched their WLD 205 lesson presentation.',
        });
      if (insertError) throw insertError;
      setPreset(next);
      setSource('instructor');
      setLoadedSectionId(section.section_id);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }, [supabase, section?.school_id, section?.section_id, eligible, saving]);

  return {
    eligible,
    preset: eligible && section?.section_id === loadedSectionId ? preset : 'standard',
    source,
    loading,
    saving,
    error,
    saveInstructorPreset,
    isStreamlined: eligible
      && section?.section_id === loadedSectionId
      && preset === ANTHONY_WLD205_PRESET,
  };
}
