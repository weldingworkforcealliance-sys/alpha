'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ANTHONY_WLD205_PRESET,
  isAnthonyWld205PilotSection,
  resolvePlannerViewPreset,
  type PlannerViewPreset,
  type PlannerViewChoice,
  type PlannerViewRevision,
  type PlannerViewSection,
} from '@/lib/wld205-anthony-view';

export function usePlannerViewPreference(
  supabase: SupabaseClient,
  section: PlannerViewSection | null
) {
  const eligible = useMemo(
    () => isAnthonyWld205PilotSection(section),
    [section?.course_code, section?.section_code]
  );
  const [preset, setPreset] = useState<PlannerViewPreset>('standard');
  const [source, setSource] = useState<'core' | 'school' | 'instructor'>('core');
  const [schoolPreset, setSchoolPreset] = useState<PlannerViewPreset>('standard');
  const [hasSchoolRevision, setHasSchoolRevision] = useState(false);
  const [personalChoice, setPersonalChoice] = useState<PlannerViewChoice>('inherit');
  const [canManageSchool, setCanManageSchool] = useState(false);
  const [loadedSectionId, setLoadedSectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [revisionEpoch, setRevisionEpoch] = useState(0);

  useEffect(() => {
    const onRevision = () => setRevisionEpoch((value) => value + 1);
    window.addEventListener('ltg:planner-view-changed', onRevision);
    return () => window.removeEventListener('ltg:planner-view-changed', onRevision);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPreset('standard');
    setSource('core');
    setSchoolPreset('standard');
    setHasSchoolRevision(false);
    setPersonalChoice('inherit');
    setCanManageSchool(false);
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
      const { data: schoolManagement } = await supabase.rpc('can_manage_memberships', {
        check_school_id: schoolId,
      });
      const latestSchool = (data ?? []).find(
        (revision: PlannerViewRevision) => revision.scope === 'school'
      );
      const latestPersonal = (data ?? []).find(
        (revision: PlannerViewRevision) =>
          revision.scope === 'instructor' && revision.instructor_id === auth.user.id
      );
      const effective = resolvePlannerViewPreset(
        (data ?? []) as PlannerViewRevision[],
        auth.user.id
      );
      if (!cancelled) {
        setPreset(effective.preset);
        setSource(effective.source);
        setSchoolPreset(latestSchool?.preset === ANTHONY_WLD205_PRESET ? ANTHONY_WLD205_PRESET : 'standard');
        setHasSchoolRevision(Boolean(latestSchool));
        setPersonalChoice(
          latestPersonal?.preset === ANTHONY_WLD205_PRESET || latestPersonal?.preset === 'standard'
            ? latestPersonal.preset
            : 'inherit'
        );
        setCanManageSchool(Boolean(schoolManagement));
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
  }, [supabase, section?.school_id, section?.section_id, eligible, revisionEpoch]);

  const saveInstructorPreset = useCallback(async (next: PlannerViewChoice) => {
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
      setPersonalChoice(next);
      setPreset(next === 'inherit' ? schoolPreset : next);
      setSource(next === 'inherit' ? (hasSchoolRevision ? 'school' : 'core') : 'instructor');
      setLoadedSectionId(section.section_id);
      window.dispatchEvent(new Event('ltg:planner-view-changed'));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }, [supabase, section?.school_id, section?.section_id, eligible, saving, schoolPreset, hasSchoolRevision]);

  const saveSchoolPreset = useCallback(async (next: PlannerViewPreset) => {
    if (!section || !eligible || !canManageSchool || saving) return;
    setSaving(true);
    setError('');
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw authError || new Error('Sign in to change school defaults.');
      const { error: insertError } = await supabase.from('planner_view_revisions').insert({
        school_id: section.school_id,
        section_id: section.section_id,
        scope: 'school',
        instructor_id: null,
        preset: next,
        change_note: 'School administrator changed the section presentation default.',
      });
      if (insertError) throw insertError;
      setSchoolPreset(next);
      setHasSchoolRevision(true);
      if (personalChoice === 'inherit') {
        setPreset(next);
        setSource('school');
      }
      window.dispatchEvent(new Event('ltg:planner-view-changed'));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }, [supabase, section?.school_id, section?.section_id, eligible, canManageSchool, saving, personalChoice]);

  return {
    eligible,
    schoolPreset,
    personalChoice,
    canManageSchool,
    saveSchoolPreset,
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
