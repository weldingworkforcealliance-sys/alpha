'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';
import styles from './resources.module.css';

type School = { id: string; name: string };
type Course = {
  id: string;
  school_id: string;
  course_code: string | null;
  course_name: string | null;
};
type GuideDay = {
  id: string;
  course_id: string;
  planner_day_number: number;
  title: string | null;
};
type Outcome = {
  id: string;
  outcome_code: string | null;
  outcome_text: string;
};
type ResourceSource = {
  id: string;
  school_id: string | null;
  name: string;
  source_kind: string;
  website_url: string | null;
  system_defined: boolean;
};
type DayResource = {
  id: string;
  sequence_number: number;
  source_id: string | null;
  resource_type: string;
  resource_title: string;
  resource_url: string | null;
  resource_notes: string | null;
  required: boolean;
  integration_mode: string;
  rights_basis: string;
  external_resource_id: string | null;
  outcome_id: string | null;
  student_safe: boolean;
  license_notes: string | null;
};

const INTEGRATION_OPTIONS = [
  ['native', 'LTG / school-native'],
  ['url', 'External URL'],
  ['file_reference', 'Authorized file reference'],
  ['simulator_launch', 'Simulator launch'],
  ['lti_1_3', 'LTI 1.3'],
  ['scorm', 'SCORM package'],
  ['common_cartridge', 'Common Cartridge'],
  ['qti', 'QTI assessment'],
  ['api', 'Provider API'],
] as const;

const RIGHTS_OPTIONS = [
  ['school_authorized', 'School authorized'],
  ['school_owned', 'School owned'],
  ['licensed', 'Licensed'],
  ['public', 'Public / open resource'],
  ['linked_external', 'Linked external content'],
  ['permission_required', 'Permission required'],
  ['unknown', 'Rights not yet verified'],
] as const;

const SOURCE_KIND_OPTIONS = [
  ['standards_body', 'Standards / credentialing body'],
  ['manufacturer', 'Manufacturer'],
  ['publisher', 'Publisher / textbook'],
  ['school', 'School / program'],
  ['media', 'Video / media'],
  ['simulator', 'Welding simulator'],
  ['external', 'External training provider'],
  ['other', 'Other'],
] as const;

const RESOURCE_TYPE_OPTIONS = [
  ['student_resource', 'Student resource'],
  ['resource', 'General resource'],
  ['book_reference', 'Book / publisher reference'],
  ['aws_reference', 'AWS reference'],
  ['video', 'Video'],
  ['handout', 'Handout'],
  ['assessment', 'Assessment'],
  ['print', 'Print / drawing'],
  ['wps_swps', 'WPS / SWPS'],
  ['instructor_report', 'Instructor report'],
  ['instructor_only', 'Instructor-only resource'],
  ['secure_exam', 'Secure exam'],
] as const;

const DIRECT_LAUNCH_MODES = new Set([
  'native',
  'url',
  'file_reference',
  'simulator_launch',
]);
const INSTRUCTOR_ONLY_TYPES = new Set([
  'instructor_report',
  'instructor_only',
  'secure_exam',
]);

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ResourcesPage() {
  const router = useRouter();
  const [supabase] = useState(getSupabase);

  const [schools, setSchools] = useState<School[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [days, setDays] = useState<GuideDay[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [sources, setSources] = useState<ResourceSource[]>([]);
  const [resources, setResources] = useState<DayResource[]>([]);

  const [schoolId, setSchoolId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [guideDayId, setGuideDayId] = useState('');

  const [sourceId, setSourceId] = useState('');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceType, setResourceType] = useState('student_resource');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceNotes, setResourceNotes] = useState('');
  const [integrationMode, setIntegrationMode] = useState('url');
  const [rightsBasis, setRightsBasis] = useState('linked_external');
  const [externalResourceId, setExternalResourceId] = useState('');
  const [outcomeId, setOutcomeId] = useState('');
  const [licenseNotes, setLicenseNotes] = useState('');
  const [required, setRequired] = useState(false);

  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceKind, setNewSourceKind] = useState('other');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const sourceMap = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources]
  );
  const outcomeMap = useMemo(
    () => new Map(outcomes.map((outcome) => [outcome.id, outcome])),
    [outcomes]
  );
  const selectedDay = useMemo(
    () => days.find((day) => day.id === guideDayId) ?? null,
    [days, guideDayId]
  );

  const loadSchools = async () => {
    const { data: owner, error: ownerError } = await supabase.rpc('is_platform_owner');
    if (ownerError) throw ownerError;

    if (owner) {
      const { data, error: queryError } = await supabase
        .from('schools')
        .select('id,name')
        .order('name');
      if (queryError) throw queryError;
      const loaded = (data ?? []) as School[];
      setSchools(loaded);
      setSchoolId((current) => current || loaded[0]?.id || '');
      return;
    }

    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId) throw new Error('Authentication required.');

    const { data: memberships, error: membershipError } = await supabase
      .from('school_memberships')
      .select('school_id')
      .eq('user_id', userId)
      .eq('status', 'active');
    if (membershipError) throw membershipError;

    const ids = Array.from(
      new Set((memberships ?? []).map((row: { school_id: string }) => row.school_id))
    );
    if (!ids.length) throw new Error('No active school membership was found for this account.');

    const { data, error: queryError } = await supabase
      .from('schools')
      .select('id,name')
      .in('id', ids)
      .order('name');
    if (queryError) throw queryError;
    const loaded = (data ?? []) as School[];
    setSchools(loaded);
    setSchoolId((current) => current || loaded[0]?.id || '');
  };

  const loadSchoolData = async (targetSchoolId: string) => {
    const [courseResult, sourceResult] = await Promise.all([
      supabase
        .from('courses')
        .select('id,school_id,course_code,course_name')
        .eq('school_id', targetSchoolId)
        .eq('status', 'active')
        .order('course_code'),
      supabase
        .from('resource_sources')
        .select('id,school_id,name,source_kind,website_url,system_defined')
        .or(`school_id.is.null,school_id.eq.${targetSchoolId}`)
        .eq('active', true)
        .order('system_defined', { ascending: false })
        .order('name'),
    ]);

    if (courseResult.error) throw courseResult.error;
    if (sourceResult.error) throw sourceResult.error;

    const loadedCourses = (courseResult.data ?? []) as Course[];
    const loadedSources = (sourceResult.data ?? []) as ResourceSource[];
    setCourses(loadedCourses);
    setSources(loadedSources);
    setCourseId(loadedCourses[0]?.id || '');
    setSourceId(loadedSources[0]?.id || '');
    setDays([]);
    setOutcomes([]);
    setResources([]);
    setGuideDayId('');
  };

  const loadCourseData = async (targetCourseId: string) => {
    const [dayResult, outcomeResult] = await Promise.all([
      supabase
        .from('course_guide_days')
        .select('id,course_id,planner_day_number,title')
        .eq('course_id', targetCourseId)
        .order('planner_day_number'),
      supabase
        .from('course_outcomes')
        .select('id,outcome_code,outcome_text')
        .eq('course_id', targetCourseId)
        .order('outcome_code'),
    ]);

    if (dayResult.error) throw dayResult.error;
    if (outcomeResult.error) throw outcomeResult.error;

    const loadedDays = (dayResult.data ?? []) as GuideDay[];
    setDays(loadedDays);
    setOutcomes((outcomeResult.data ?? []) as Outcome[]);
    setGuideDayId(loadedDays[0]?.id || '');
    setResources([]);
    setOutcomeId('');
  };

  const loadResources = async (targetGuideDayId: string) => {
    const { data, error: queryError } = await supabase
      .from('course_guide_day_resources')
      .select(
        'id,sequence_number,source_id,resource_type,resource_title,resource_url,resource_notes,required,integration_mode,rights_basis,external_resource_id,outcome_id,student_safe,license_notes'
      )
      .eq('guide_day_id', targetGuideDayId)
      .order('sequence_number');
    if (queryError) throw queryError;
    setResources((data ?? []) as DayResource[]);
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getSession();
        if (!auth.session) {
          router.replace('/login');
          return;
        }
        await loadSchools();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [router, supabase]);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setBusy(true);
      setError('');
      try {
        await loadSchoolData(schoolId);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    })();
  }, [schoolId]);

  useEffect(() => {
    if (!courseId) return;
    (async () => {
      setBusy(true);
      setError('');
      try {
        await loadCourseData(courseId);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    })();
  }, [courseId]);

  useEffect(() => {
    if (!guideDayId) return;
    (async () => {
      setBusy(true);
      setError('');
      try {
        await loadResources(guideDayId);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    })();
  }, [guideDayId]);

  const addSource = async () => {
    if (!schoolId || !newSourceName.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data, error: insertError } = await supabase
        .from('resource_sources')
        .insert({
          school_id: schoolId,
          name: newSourceName.trim(),
          source_kind: newSourceKind,
          system_defined: false,
          active: true,
        })
        .select('id,school_id,name,source_kind,website_url,system_defined')
        .single();
      if (insertError) throw insertError;

      setSources((current) => [...current, data as ResourceSource].sort((a, b) => a.name.localeCompare(b.name)));
      setSourceId((data as ResourceSource).id);
      setNewSourceName('');
      setNewSourceKind('other');
      setNotice('Provider/source added for this school. It can now be attached to any planner-day resource.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const addResource = async () => {
    if (!schoolId || !courseId || !guideDayId || !resourceTitle.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const directLaunch = DIRECT_LAUNCH_MODES.has(integrationMode);
      const studentSafe = !INSTRUCTOR_ONLY_TYPES.has(resourceType);
      const pendingLaunchNote = directLaunch
        ? ''
        : `${humanize(integrationMode)} integration profile recorded. Secure provider launch configuration is still required before this resource can be launched from LTG.`;
      const combinedNotes = [resourceNotes.trim(), pendingLaunchNote].filter(Boolean).join(' ');
      const nextSequence =
        resources.reduce((highest, resource) => Math.max(highest, resource.sequence_number), 0) + 1;

      const { data, error: insertError } = await supabase
        .from('course_guide_day_resources')
        .insert({
          school_id: schoolId,
          course_id: courseId,
          guide_day_id: guideDayId,
          sequence_number: nextSequence,
          resource_type: resourceType,
          resource_title: resourceTitle.trim(),
          resource_url: directLaunch ? resourceUrl.trim() || null : null,
          resource_notes: combinedNotes || null,
          required,
          source_id: sourceId || null,
          integration_mode: integrationMode,
          rights_basis: rightsBasis,
          external_resource_id: externalResourceId.trim() || null,
          outcome_id: outcomeId || null,
          student_safe: studentSafe,
          license_notes: licenseNotes.trim() || null,
        })
        .select(
          'id,sequence_number,source_id,resource_type,resource_title,resource_url,resource_notes,required,integration_mode,rights_basis,external_resource_id,outcome_id,student_safe,license_notes'
        )
        .single();
      if (insertError) throw insertError;

      setResources((current) => [...current, data as DayResource].sort((a, b) => a.sequence_number - b.sequence_number));
      setResourceTitle('');
      setResourceUrl('');
      setResourceNotes('');
      setExternalResourceId('');
      setOutcomeId('');
      setLicenseNotes('');
      setRequired(false);
      setNotice(
        directLaunch
          ? 'Resource attached. It will appear in the existing Teaching Console for this planner day.'
          : 'Integration metadata saved. The resource will remain non-launchable until its secure provider connection is configured.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <main className={styles.page}>Loading LTG content and resource integration…</main>;
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>LTG · Welding Education Operating System</div>
          <h1>Content &amp; Resource Integration</h1>
          <p>
            Attach welding standards, publisher references, manufacturer resources, school material,
            assessments, media, and simulator activities to the same planner-day structure already used
            by the Teaching Console.
          </p>
        </div>
        <a className={styles.backLink} href="/planner">Back to Planner</a>
      </header>

      {error && <div className={`${styles.notice} ${styles.error}`}>{error}</div>}
      {notice && <div className={`${styles.notice} ${styles.success}`}>{notice}</div>}

      <section className={styles.guardrail}>
        <strong>Content ownership guardrail</strong>
        <p>
          LTG stores authorized links, references, integration metadata, and school-owned content. Do not
          copy a publisher&apos;s, manufacturer&apos;s, standards body&apos;s, or other provider&apos;s protected content
          into LTG unless the school has the right to distribute it. Linking a resource does not transfer
          ownership or create a license.
        </p>
      </section>

      <section className={styles.selectionCard}>
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>Instructional location</span>
          <h2>Choose where the resource belongs</h2>
        </div>
        <div className={styles.selectionGrid}>
          <label>
            School
            <select value={schoolId} onChange={(event) => setSchoolId(event.target.value)} disabled={busy}>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>{school.name}</option>
              ))}
            </select>
          </label>
          <label>
            Course
            <select value={courseId} onChange={(event) => setCourseId(event.target.value)} disabled={busy || !courses.length}>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.course_code || course.course_name || 'Course'}{course.course_code && course.course_name ? ` · ${course.course_name}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Planner day
            <select value={guideDayId} onChange={(event) => setGuideDayId(event.target.value)} disabled={busy || !days.length}>
              {days.map((day) => (
                <option key={day.id} value={day.id}>
                  Day {day.planner_day_number}{day.title ? ` · ${day.title}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className={styles.twoColumn}>
        <section className={styles.card}>
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>Provider registry</span>
            <h2>Sources available to this school</h2>
          </div>

          <div className={styles.sourceList}>
            {sources.map((source) => (
              <div className={styles.sourceRow} key={source.id}>
                <div>
                  <strong>{source.name}</strong>
                  <span>{humanize(source.source_kind)}{source.system_defined ? ' · LTG catalog' : ' · School source'}</span>
                </div>
                {source.website_url && (
                  <a href={source.website_url} target="_blank" rel="noreferrer">Provider site</a>
                )}
              </div>
            ))}
          </div>

          <div className={styles.inlineForm}>
            <label>
              Add another provider/source
              <input
                value={newSourceName}
                onChange={(event) => setNewSourceName(event.target.value)}
                placeholder="Example: NCCER, local textbook publisher, simulator vendor"
              />
            </label>
            <label>
              Source type
              <select value={newSourceKind} onChange={(event) => setNewSourceKind(event.target.value)}>
                {SOURCE_KIND_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={addSource} disabled={busy || !newSourceName.trim()}>
              Add Source
            </button>
          </div>
          <p className={styles.permissionNote}>
            School provider creation is restricted by existing school-management permissions. A provider
            can be cataloged without granting LTG access to that provider&apos;s copyrighted material.
          </p>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>Planner connection</span>
            <h2>Attach a resource</h2>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.fullWidth}>
              Resource title
              <input
                value={resourceTitle}
                onChange={(event) => setResourceTitle(event.target.value)}
                placeholder="Example: AWS Fundamentals module · Fillet Weld Symbols"
              />
            </label>
            <label>
              Source
              <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                <option value="">Unspecified</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>{source.name}</option>
                ))}
              </select>
            </label>
            <label>
              Resource role
              <select value={resourceType} onChange={(event) => setResourceType(event.target.value)}>
                {RESOURCE_TYPE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              Integration mode
              <select value={integrationMode} onChange={(event) => setIntegrationMode(event.target.value)}>
                {INTEGRATION_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              Rights / permission basis
              <select value={rightsBasis} onChange={(event) => setRightsBasis(event.target.value)}>
                {RIGHTS_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className={styles.fullWidth}>
              Direct launch URL or LTG path
              <input
                value={resourceUrl}
                onChange={(event) => setResourceUrl(event.target.value)}
                placeholder="https://provider.example/resource or /classroom?..."
                disabled={!DIRECT_LAUNCH_MODES.has(integrationMode)}
              />
              {!DIRECT_LAUNCH_MODES.has(integrationMode) && (
                <small>Secure {humanize(integrationMode)} launch setup is recorded as metadata first; credentials are not stored here.</small>
              )}
            </label>
            <label>
              Provider resource ID
              <input
                value={externalResourceId}
                onChange={(event) => setExternalResourceId(event.target.value)}
                placeholder="Optional provider/module identifier"
              />
            </label>
            <label>
              Protected course outcome
              <select value={outcomeId} onChange={(event) => setOutcomeId(event.target.value)}>
                <option value="">No direct outcome link</option>
                {outcomes.map((outcome) => (
                  <option key={outcome.id} value={outcome.id}>
                    {outcome.outcome_code ? `${outcome.outcome_code} · ` : ''}{outcome.outcome_text}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.fullWidth}>
              Instructor/resource notes
              <textarea
                rows={3}
                value={resourceNotes}
                onChange={(event) => setResourceNotes(event.target.value)}
                placeholder="Page/chapter, setup instructions, equipment notes, or what the instructor should launch."
              />
            </label>
            <label className={styles.fullWidth}>
              License / permission notes
              <textarea
                rows={2}
                value={licenseNotes}
                onChange={(event) => setLicenseNotes(event.target.value)}
                placeholder="Optional: school subscription, seat license, public resource, permission owner, renewal note."
              />
            </label>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} />
              Required for this planner day
            </label>
          </div>

          <button
            className={styles.primaryButton}
            type="button"
            onClick={addResource}
            disabled={busy || !guideDayId || !resourceTitle.trim()}
          >
            Attach to {selectedDay ? `Day ${selectedDay.planner_day_number}` : 'Planner Day'}
          </button>
        </section>
      </div>

      <section className={styles.card}>
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>Current planner day</span>
          <h2>{selectedDay ? `Day ${selectedDay.planner_day_number} · ${selectedDay.title || 'Untitled day'}` : 'No planner day selected'}</h2>
        </div>

        <div className={styles.resourceList}>
          {resources.length ? resources.map((resource) => {
            const source = resource.source_id ? sourceMap.get(resource.source_id) : null;
            const outcome = resource.outcome_id ? outcomeMap.get(resource.outcome_id) : null;
            return (
              <article className={styles.resourceCard} key={resource.id}>
                <div className={styles.resourceTopline}>
                  <span>#{resource.sequence_number}</span>
                  {resource.required && <span className={styles.requiredBadge}>Required</span>}
                  <span className={resource.student_safe ? styles.studentBadge : styles.instructorBadge}>
                    {resource.student_safe ? 'Student-safe type' : 'Instructor only'}
                  </span>
                </div>
                <h3>{resource.resource_title}</h3>
                <div className={styles.metaGrid}>
                  <span><b>Source:</b> {source?.name || 'Unspecified'}</span>
                  <span><b>Integration:</b> {humanize(resource.integration_mode)}</span>
                  <span><b>Rights:</b> {humanize(resource.rights_basis)}</span>
                  <span><b>Type:</b> {humanize(resource.resource_type)}</span>
                </div>
                {outcome && (
                  <p className={styles.outcomeLine}>
                    <b>Outcome:</b> {outcome.outcome_code ? `${outcome.outcome_code} · ` : ''}{outcome.outcome_text}
                  </p>
                )}
                {resource.resource_notes && <p>{resource.resource_notes}</p>}
                {resource.license_notes && <p className={styles.licenseLine}><b>License:</b> {resource.license_notes}</p>}
                <div className={styles.resourceActions}>
                  {resource.resource_url ? (
                    <a href={resource.resource_url} target="_blank" rel="noreferrer">Open Resource</a>
                  ) : (
                    <span>Launch configuration pending / reference only</span>
                  )}
                  {resource.external_resource_id && <code>{resource.external_resource_id}</code>}
                </div>
              </article>
            );
          }) : (
            <div className={styles.empty}>No resources are attached to this planner day yet.</div>
          )}
        </div>
      </section>

      <section className={styles.integrationNote}>
        <strong>Integration readiness</strong>
        <p>
          LTG can now classify resources for LTI 1.3, SCORM, Common Cartridge, QTI, provider APIs,
          simulators, files, and ordinary URLs. Selecting one of the secure integration modes does not
          fabricate vendor credentials or bypass licensing. Provider-specific authentication and launch
          handshakes are configured only when that provider supports and authorizes the connection.
        </p>
      </section>
    </main>
  );
}
