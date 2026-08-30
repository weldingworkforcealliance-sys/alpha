'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

type TabName = 'overview' | 'instructors' | 'sections' | 'activity' | 'reports';

interface School {
  id: string;
  name: string;
  status: string | null;
}

interface Membership {
  id: string;
  school_id: string;
  user_id: string;
  role: string;
  status: string;
}

interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
}

interface Course {
  id: string;
  school_id: string;
  course_code: string | null;
  course_name: string | null;
  status: string | null;
}

interface Section {
  id: string;
  school_id: string;
  course_id: string;
  section_name: string | null;
  section_code: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  planned_instructional_days: number | null;
  planned_minutes_per_day: number | null;
  start_time: string | null;
  end_time: string | null;
}

interface SectionProgress {
  section_id: string;
  current_planner_day_number: number | null;
  started_at: string | null;
  last_advanced_at: string | null;
  manual_hold: boolean;
  hold_reason: string | null;
  completed_at: string | null;
}

interface SectionInstructor {
  id: string;
  section_id: string;
  instructor_id: string;
  instructor_role: string | null;
  active: boolean;
}

interface PlannerDay {
  id: string;
  section_id: string;
  planner_day_number: number;
  scheduled_date: string;
  status: string | null;
}

interface Delivery {
  id: string;
  section_id: string;
  planner_day_id: string;
  delivery_status: string;
  actual_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  instructor_id: string | null;
  actual_minutes: number | null;
  deviation_summary: string | null;
  follow_up_needed: boolean;
  follow_up_notes: string | null;
  updated_at: string;
}

function localDateKey() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatDate(date: string | null) {
  if (!date) return '—';
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(timestamp: string | null) {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatMinutes(minutes: number | null) {
  if (minutes === null || Number.isNaN(minutes)) return '—';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  if (!remainder) return `${hours} hr`;
  return `${hours} hr ${remainder} min`;
}

function titleCase(value: string | null | undefined) {
  if (!value) return '—';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function SchoolDashboardPage() {
  const router = useRouter();

  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  );

  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabName>('overview');

  const [userId, setUserId] = useState<string | null>(null);
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [myMembership, setMyMembership] = useState<Membership | null>(null);

  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [progress, setProgress] = useState<SectionProgress[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sectionInstructors, setSectionInstructors] = useState<SectionInstructor[]>([]);
  const [plannerDays, setPlannerDays] = useState<PlannerDay[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  useEffect(() => {
    const initialize = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();

        if (!sessionData.session) {
          router.push('/login');
          return;
        }

        const currentUserId = sessionData.session.user.id;
        setUserId(currentUserId);

        const [ownerResult, schoolsResult, membershipsResult] = await Promise.all([
          supabase.rpc('is_platform_owner'),
          supabase.from('schools').select('id, name, status').order('name'),
          supabase
            .from('school_memberships')
            .select('id, school_id, user_id, role, status')
            .eq('user_id', currentUserId)
            .eq('status', 'active'),
        ]);

        if (ownerResult.error) {
          console.error('Owner check failed:', ownerResult.error);
        }

        if (schoolsResult.error) {
          throw new Error(schoolsResult.error.message);
        }

        if (membershipsResult.error) {
          throw new Error(membershipsResult.error.message);
        }

        const owner = Boolean(ownerResult.data);
        const visibleSchools = (schoolsResult.data ?? []) as School[];
        const myMemberships = (membershipsResult.data ?? []) as Membership[];

        const managementRoles = new Set([
          'school_admin',
          'program_lead',
          'lead_instructor',
          'viewer',
        ]);

        const allowedSchoolIds = owner
          ? new Set(visibleSchools.map((school) => school.id))
          : new Set(
              myMemberships
                .filter((membership) => managementRoles.has(membership.role))
                .map((membership) => membership.school_id)
            );

        const allowedSchools = visibleSchools.filter((school) =>
          allowedSchoolIds.has(school.id)
        );

        setIsPlatformOwner(owner);
        setSchools(allowedSchools);

        if (allowedSchools.length === 0) {
          setError(
            'This account does not have School Dashboard access. Instructors should use the Teacher Dashboard.'
          );
          return;
        }

        setSelectedSchoolId(allowedSchools[0].id);
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : 'Failed to load School Dashboard.'
        );
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [router, supabase]);

  useEffect(() => {
    if (!selectedSchoolId || !userId) return;

    const loadSchool = async () => {
      setDataLoading(true);
      setError('');

      try {
        const [
          coursesResult,
          sectionsResult,
          progressResult,
          membershipsResult,
          instructorsResult,
          daysResult,
          deliveriesResult,
        ] = await Promise.all([
          supabase
            .from('courses')
            .select('id, school_id, course_code, course_name, status')
            .eq('school_id', selectedSchoolId)
            .order('course_code'),
          supabase
            .from('sections')
            .select(
              'id, school_id, course_id, section_name, section_code, status, start_date, end_date, planned_instructional_days, planned_minutes_per_day, start_time, end_time'
            )
            .eq('school_id', selectedSchoolId)
            .order('section_name'),
          supabase
            .from('section_progress')
            .select(
              'section_id, current_planner_day_number, started_at, last_advanced_at, manual_hold, hold_reason, completed_at'
            )
            .eq('school_id', selectedSchoolId),
          supabase
            .from('school_memberships')
            .select('id, school_id, user_id, role, status')
            .eq('school_id', selectedSchoolId)
            .eq('status', 'active'),
          supabase
            .from('section_instructors')
            .select(
              'id, section_id, instructor_id, instructor_role, active'
            )
            .eq('school_id', selectedSchoolId)
            .eq('active', true),
          supabase
            .from('planner_days')
            .select(
              'id, section_id, planner_day_number, scheduled_date, status'
            )
            .eq('school_id', selectedSchoolId)
            .order('scheduled_date'),
          supabase
            .from('planner_day_delivery')
            .select(
              'id, section_id, planner_day_id, delivery_status, actual_date, started_at, completed_at, instructor_id, actual_minutes, deviation_summary, follow_up_needed, follow_up_notes, updated_at'
            )
            .eq('school_id', selectedSchoolId)
            .order('updated_at', { ascending: false }),
        ]);

        const firstError = [
          coursesResult.error,
          sectionsResult.error,
          progressResult.error,
          membershipsResult.error,
          instructorsResult.error,
          daysResult.error,
          deliveriesResult.error,
        ].find(Boolean);

        if (firstError) {
          throw new Error(firstError?.message ?? 'School data query failed.');
        }

        const loadedMemberships = (membershipsResult.data ?? []) as Membership[];

        const profileIds = Array.from(
          new Set(loadedMemberships.map((membership) => membership.user_id))
        );

        let loadedProfiles: Profile[] = [];

        if (profileIds.length > 0) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id, display_name, email')
            .in('id', profileIds);

          if (profileError) {
            throw new Error(profileError.message);
          }

          loadedProfiles = (profileData ?? []) as Profile[];
        }

        setCourses((coursesResult.data ?? []) as Course[]);
        setSections((sectionsResult.data ?? []) as Section[]);
        setProgress((progressResult.data ?? []) as SectionProgress[]);
        setMemberships(loadedMemberships);
        setProfiles(loadedProfiles);
        setSectionInstructors(
          (instructorsResult.data ?? []) as SectionInstructor[]
        );
        setPlannerDays((daysResult.data ?? []) as PlannerDay[]);
        setDeliveries((deliveriesResult.data ?? []) as Delivery[]);

        setMyMembership(
          loadedMemberships.find(
            (membership) => membership.user_id === userId
          ) ?? null
        );
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : 'Failed to load school data.'
        );
      } finally {
        setDataLoading(false);
      }
    };

    loadSchool();
  }, [selectedSchoolId, supabase, userId]);

  const selectedSchool = useMemo(
    () => schools.find((school) => school.id === selectedSchoolId) ?? null,
    [schools, selectedSchoolId]
  );

  const courseMap = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses]
  );

  const progressMap = useMemo(
    () => new Map(progress.map((item) => [item.section_id, item])),
    [progress]
  );

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );

  const sectionMap = useMemo(
    () => new Map(sections.map((section) => [section.id, section])),
    [sections]
  );

  const today = localDateKey();

  const teachingMemberships = useMemo(
    () =>
      memberships.filter((membership) =>
        ['lead_instructor', 'instructor'].includes(membership.role)
      ),
    [memberships]
  );

  const activeSections = useMemo(
    () =>
      sections.filter(
        (section) =>
          !['inactive', 'archived', 'completed'].includes(
            (section.status ?? '').toLowerCase()
          )
      ),
    [sections]
  );

  const todayPlannerDays = useMemo(
    () => plannerDays.filter((day) => day.scheduled_date === today),
    [plannerDays, today]
  );

  const todayDeliveries = useMemo(
    () => deliveries.filter((delivery) => delivery.actual_date === today),
    [deliveries, today]
  );

  const completedDeliveries = useMemo(
    () =>
      deliveries.filter(
        (delivery) =>
          delivery.delivery_status === 'completed' &&
          delivery.actual_minutes !== null
      ),
    [deliveries]
  );

  const totalActualMinutes = completedDeliveries.reduce(
    (sum, delivery) => sum + (delivery.actual_minutes ?? 0),
    0
  );

  const averageMinutes =
    completedDeliveries.length > 0
      ? Math.round(totalActualMinutes / completedDeliveries.length)
      : 0;

  const followUpsFlagged = deliveries.filter(
    (delivery) => delivery.follow_up_needed
  ).length;

  const heldSections = progress.filter((item) => item.manual_hold).length;

  const sectionRows = useMemo(
    () =>
      sections.map((section) => {
        const course = courseMap.get(section.course_id);
        const sectionProgress = progressMap.get(section.id);
        const assigned = sectionInstructors.filter(
          (assignment) => assignment.section_id === section.id
        );
        const names = assigned
          .map((assignment) => profileMap.get(assignment.instructor_id)?.display_name)
          .filter((name): name is string => Boolean(name));

        const currentDay = sectionProgress?.current_planner_day_number ?? 1;
        const plannedDays = section.planned_instructional_days ?? 0;
        const percent =
          plannedDays > 0
            ? Math.min(100, Math.round((currentDay / plannedDays) * 100))
            : 0;

        return {
          section,
          course,
          sectionProgress,
          instructorNames: names,
          currentDay,
          plannedDays,
          percent,
        };
      }),
    [sections, courseMap, progressMap, sectionInstructors, profileMap]
  );

  const instructorRows = useMemo(
    () =>
      teachingMemberships.map((membership) => {
        const profile = profileMap.get(membership.user_id);
        const assignments = sectionInstructors.filter(
          (assignment) => assignment.instructor_id === membership.user_id
        );
        const assignedSections = assignments
          .map((assignment) => sectionMap.get(assignment.section_id))
          .filter((section): section is Section => Boolean(section));

        return {
          membership,
          profile,
          assignedSections,
        };
      }),
    [teachingMemberships, profileMap, sectionInstructors, sectionMap]
  );

  const canManage =
    isPlatformOwner ||
    ['school_admin', 'program_lead'].includes(myMembership?.role ?? '');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const downloadSectionCsv = () => {
    const rows = [
      [
        'Section',
        'Course',
        'Status',
        'Current Day',
        'Planned Days',
        'Percent Complete',
        'Instructor(s)',
      ],
      ...sectionRows.map((row) => [
        row.section.section_name ?? row.section.section_code ?? '',
        row.course?.course_code ?? '',
        row.section.status ?? '',
        String(row.currentDay),
        String(row.plannedDays),
        String(row.percent),
        row.instructorNames.join('; '),
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(selectedSchool?.name ?? 'school')
      .replace(/[^a-z0-9]+/gi, '_')
      .toLowerCase()}_section_report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <main className="school-shell centered">
        <div className="spinner" />
        <p>Loading School Dashboard…</p>
        <style jsx>{styles}</style>
      </main>
    );
  }

  if (!selectedSchoolId) {
    return (
      <main className="school-shell centered">
        <div className="access-card">
          <div className="eyebrow">School Dashboard</div>
          <h1>Access unavailable</h1>
          <p>{error || 'No school-management access was found for this account.'}</p>
          <button onClick={() => router.push('/dashboard')}>
            Return to Teacher Dashboard
          </button>
        </div>
        <style jsx>{styles}</style>
      </main>
    );
  }

  return (
    <div className="school-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Living Teacher Planner</div>
          <h1>School Dashboard</h1>
        </div>

        <div className="header-actions">
          <button className="secondary" onClick={() => router.push('/dashboard')}>
            Teacher Dashboard
          </button>
          <button className="secondary" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </header>

      <main className="page">
        <section className="school-heading">
          <div>
            <div className="eyebrow">Program Management</div>
            <h2>{selectedSchool?.name ?? 'School'}</h2>
            <p>
              {isPlatformOwner
                ? 'Platform Owner view'
                : `${titleCase(myMembership?.role)} access`}
            </p>
          </div>

          {schools.length > 1 && (
            <label className="school-selector">
              <span>School</span>
              <select
                value={selectedSchoolId}
                onChange={(event) => setSelectedSchoolId(event.target.value)}
              >
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>

        {error && <div className="error-box">{error}</div>}

        <nav className="tabs" aria-label="School Dashboard sections">
          {(
            [
              ['overview', 'Overview'],
              ['instructors', 'Instructors'],
              ['sections', 'Sections'],
              ['activity', 'Activity'],
              ['reports', 'Reports'],
            ] as [TabName, string][]
          ).map(([tab, label]) => (
            <button
              key={tab}
              className={activeTab === tab ? 'active' : ''}
              onClick={() => setActiveTab(tab)}
            >
              {label}
            </button>
          ))}
        </nav>

        {dataLoading ? (
          <section className="loading-panel">
            <div className="spinner" />
            <p>Loading school information…</p>
          </section>
        ) : (
          <>
            {activeTab === 'overview' && (
              <section className="stack">
                <div className="metric-grid">
                  <Metric label="Active Sections" value={activeSections.length} />
                  <Metric label="Instructors" value={teachingMemberships.length} />
                  <Metric label="Classes Today" value={todayPlannerDays.length} />
                  <Metric
                    label="In Progress"
                    value={
                      todayDeliveries.filter(
                        (delivery) => delivery.delivery_status === 'in_progress'
                      ).length
                    }
                    accent
                  />
                  <Metric
                    label="Completed Today"
                    value={
                      todayDeliveries.filter(
                        (delivery) => delivery.delivery_status === 'completed'
                      ).length
                    }
                  />
                  <Metric label="Follow-Ups Flagged" value={followUpsFlagged} warn />
                </div>

                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <div className="eyebrow">Current Progress</div>
                      <h3>Sections</h3>
                    </div>
                    <span>{sectionRows.length} total</span>
                  </div>

                  <div className="section-list">
                    {sectionRows.length === 0 ? (
                      <div className="empty">No sections found.</div>
                    ) : (
                      sectionRows.map((row) => (
                        <article className="section-row" key={row.section.id}>
                          <div className="section-main">
                            <strong>
                              {row.section.section_name ??
                                row.section.section_code ??
                                'Unnamed Section'}
                            </strong>
                            <span>
                              {row.course?.course_code ?? 'Course'} ·{' '}
                              {row.instructorNames.join(', ') || 'Instructor not assigned'}
                            </span>
                          </div>

                          <div className="progress-block">
                            <div className="progress-copy">
                              <span>
                                Day {row.currentDay} of {row.plannedDays || '—'}
                              </span>
                              <strong>{row.percent}%</strong>
                            </div>
                            <div className="progress-track">
                              <div
                                className="progress-fill"
                                style={{ width: `${row.percent}%` }}
                              />
                            </div>
                          </div>

                          <div className="status-stack">
                            <span
                              className={`status ${
                                row.sectionProgress?.manual_hold ? 'hold' : 'normal'
                              }`}
                            >
                              {row.sectionProgress?.manual_hold
                                ? 'On Hold'
                                : titleCase(row.section.status)}
                            </span>
                            {row.sectionProgress?.last_advanced_at && (
                              <small>
                                Updated{' '}
                                {formatDateTime(row.sectionProgress.last_advanced_at)}
                              </small>
                            )}
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </div>

                <div className="two-column">
                  <div className="panel">
                    <div className="eyebrow">Instructional Time</div>
                    <h3>{formatMinutes(totalActualMinutes)}</h3>
                    <p>Recorded completed instructional time</p>
                    <div className="mini-stats">
                      <span>
                        <strong>{completedDeliveries.length}</strong>
                        completed teaching days
                      </span>
                      <span>
                        <strong>{averageMinutes || '—'}</strong>
                        average minutes per completed class
                      </span>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="eyebrow">Attention</div>
                    <h3>{followUpsFlagged + heldSections}</h3>
                    <p>Items requiring review</p>
                    <div className="mini-stats">
                      <span>
                        <strong>{followUpsFlagged}</strong>
                        follow-ups flagged
                      </span>
                      <span>
                        <strong>{heldSections}</strong>
                        sections on manual hold
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'instructors' && (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">Staff Organization</div>
                    <h3>Instructors</h3>
                  </div>
                  <span>
                    {canManage ? 'Management access' : 'Read-only access'}
                  </span>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Instructor</th>
                        <th>Role</th>
                        <th>Assigned Sections</th>
                        <th>Section Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {instructorRows.map((row) => (
                        <tr key={row.membership.id}>
                          <td>
                            <strong>
                              {row.profile?.display_name ?? 'Name unavailable'}
                            </strong>
                            <small>{row.profile?.email ?? ''}</small>
                          </td>
                          <td>{titleCase(row.membership.role)}</td>
                          <td>
                            {row.assignedSections
                              .map(
                                (section) =>
                                  section.section_name ??
                                  section.section_code ??
                                  'Unnamed section'
                              )
                              .join(', ') || 'No active section assignment'}
                          </td>
                          <td>{row.assignedSections.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {canManage && (
                  <div className="management-note">
                    Instructor assignment controls will be added after this dashboard
                    view is verified against real school data.
                  </div>
                )}
              </section>
            )}

            {activeTab === 'sections' && (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">Course Delivery</div>
                    <h3>Sections</h3>
                  </div>
                  <span>{sectionRows.length} sections</span>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Section</th>
                        <th>Course</th>
                        <th>Instructor</th>
                        <th>Progress</th>
                        <th>Schedule</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionRows.map((row) => (
                        <tr key={row.section.id}>
                          <td>
                            <strong>
                              {row.section.section_name ??
                                row.section.section_code ??
                                'Unnamed Section'}
                            </strong>
                            <small>{row.section.section_code ?? ''}</small>
                          </td>
                          <td>{row.course?.course_code ?? '—'}</td>
                          <td>{row.instructorNames.join(', ') || 'Unassigned'}</td>
                          <td>
                            Day {row.currentDay} / {row.plannedDays || '—'}
                          </td>
                          <td>
                            {formatDate(row.section.start_date)} to{' '}
                            {formatDate(row.section.end_date)}
                          </td>
                          <td>
                            <span
                              className={`status ${
                                row.sectionProgress?.manual_hold ? 'hold' : 'normal'
                              }`}
                            >
                              {row.sectionProgress?.manual_hold
                                ? 'On Hold'
                                : titleCase(row.section.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab === 'activity' && (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">Recent Instruction</div>
                    <h3>Activity</h3>
                  </div>
                  <span>{deliveries.length} delivery records</span>
                </div>

                <div className="activity-list">
                  {deliveries.slice(0, 50).map((delivery) => {
                    const section = sectionMap.get(delivery.section_id);
                    const instructor = delivery.instructor_id
                      ? profileMap.get(delivery.instructor_id)
                      : null;

                    return (
                      <article className="activity-row" key={delivery.id}>
                        <div>
                          <strong>
                            {section?.section_name ??
                              section?.section_code ??
                              'Section'}
                          </strong>
                          <span>
                            {instructor?.display_name ?? 'Instructor'} ·{' '}
                            {formatDate(delivery.actual_date)}
                          </span>
                        </div>

                        <div>
                          <span className={`status ${delivery.delivery_status}`}>
                            {titleCase(delivery.delivery_status)}
                          </span>
                          <small>
                            {delivery.actual_minutes !== null
                              ? `${delivery.actual_minutes} min`
                              : 'Time not completed'}
                          </small>
                        </div>

                        <div className="activity-note">
                          {delivery.deviation_summary || 'No daily deviation/comment'}
                          {delivery.follow_up_needed && (
                            <span className="follow-up">Follow-up flagged</span>
                          )}
                        </div>
                      </article>
                    );
                  })}

                  {deliveries.length === 0 && (
                    <div className="empty">No instructional activity recorded yet.</div>
                  )}
                </div>
              </section>
            )}

            {activeTab === 'reports' && (
              <section className="stack">
                <div className="report-actions">
                  <button onClick={() => window.print()}>Print School Report</button>
                  <button onClick={downloadSectionCsv}>Download Section CSV</button>
                </div>

                <div className="metric-grid">
                  <Metric
                    label="Recorded Instruction"
                    value={formatMinutes(totalActualMinutes)}
                  />
                  <Metric
                    label="Completed Teaching Days"
                    value={completedDeliveries.length}
                  />
                  <Metric
                    label="Average Class"
                    value={averageMinutes ? `${averageMinutes} min` : '—'}
                  />
                  <Metric label="Sections On Hold" value={heldSections} warn />
                  <Metric label="Follow-Ups Flagged" value={followUpsFlagged} warn />
                  <Metric label="Active Courses" value={courses.length} />
                </div>

                <div className="panel">
                  <div className="eyebrow">Section Report</div>
                  <h3>Progress Summary</h3>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Section</th>
                          <th>Course</th>
                          <th>Day</th>
                          <th>Completion</th>
                          <th>Instructor</th>
                          <th>Hold</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectionRows.map((row) => (
                          <tr key={row.section.id}>
                            <td>
                              {row.section.section_name ??
                                row.section.section_code ??
                                'Unnamed Section'}
                            </td>
                            <td>{row.course?.course_code ?? '—'}</td>
                            <td>
                              {row.currentDay} / {row.plannedDays || '—'}
                            </td>
                            <td>{row.percent}%</td>
                            <td>
                              {row.instructorNames.join(', ') || 'Unassigned'}
                            </td>
                            <td>
                              {row.sectionProgress?.manual_hold ? 'Yes' : 'No'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="report-footnote">
                  This first report layer summarizes operational teaching data. Formal
                  semester, instructor, course, regional, and cross-school report
                  formats can now build on the same records without creating duplicate
                  reporting data.
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <style jsx>{styles}</style>
    </div>
  );
}

function Metric({
  label,
  value,
  accent = false,
  warn = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className={`metric ${accent ? 'accent' : ''} ${warn ? 'warn' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles = `
  :global(body) {
    background: #0a0a0a;
  }

  .school-shell {
    min-height: 100vh;
    background:
      radial-gradient(circle at 18% 0%, rgba(0,255,136,.07), transparent 26rem),
      #0a0a0a;
    color: #e0e0e0;
  }

  .centered {
    min-height: 100vh;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 18px;
    padding: 24px;
  }

  .topbar {
    min-height: 82px;
    padding: 18px 28px;
    border-bottom: 1px solid #252525;
    background: rgba(18,18,18,.94);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
  }

  h1, h2, h3, p {
    margin: 0;
  }

  h1 {
    color: #fff;
    font-size: 25px;
  }

  h2 {
    color: #fff;
    font-size: clamp(25px, 3vw, 38px);
    margin-top: 3px;
  }

  h3 {
    color: #fff;
    font-size: 21px;
    margin-top: 4px;
  }

  .eyebrow {
    color: #00ff88;
    text-transform: uppercase;
    letter-spacing: .12em;
    font-size: 11px;
    font-weight: 800;
  }

  .header-actions, .report-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  button, select {
    font: inherit;
  }

  button {
    cursor: pointer;
  }

  .secondary,
  .report-actions button,
  .access-card button {
    padding: 10px 15px;
    border-radius: 7px;
    border: 1px solid #303030;
    background: #171717;
    color: #e8e8e8;
    font-weight: 700;
  }

  .secondary:hover,
  .report-actions button:hover,
  .access-card button:hover {
    border-color: #00ff88;
    color: #00ff88;
  }

  .page {
    width: min(1500px, calc(100% - 36px));
    margin: 0 auto;
    padding: 30px 0 60px;
  }

  .school-heading {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 24px;
    margin-bottom: 24px;
  }

  .school-heading p {
    color: #929292;
    margin-top: 6px;
  }

  .school-selector {
    display: grid;
    gap: 6px;
    min-width: 260px;
  }

  .school-selector span {
    color: #777;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .08em;
  }

  .school-selector select {
    width: 100%;
    padding: 11px 13px;
    border-radius: 7px;
    border: 1px solid #303030;
    background: #171717;
    color: #eee;
  }

  .tabs {
    display: flex;
    gap: 7px;
    overflow-x: auto;
    padding-bottom: 12px;
    margin-bottom: 18px;
    border-bottom: 1px solid #242424;
  }

  .tabs button {
    white-space: nowrap;
    padding: 10px 16px;
    border-radius: 7px;
    border: 1px solid transparent;
    background: transparent;
    color: #999;
    font-weight: 800;
  }

  .tabs button:hover {
    color: #ddd;
    background: #151515;
  }

  .tabs button.active {
    color: #00ff88;
    border-color: rgba(0,255,136,.45);
    background: rgba(0,255,136,.08);
  }

  .stack {
    display: grid;
    gap: 18px;
  }

  .metric-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(140px, 1fr));
    gap: 12px;
  }

  .metric {
    min-height: 110px;
    padding: 17px;
    border: 1px solid #292929;
    border-radius: 10px;
    background: linear-gradient(180deg, #191919, #131313);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .metric span {
    color: #858585;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: .06em;
    font-weight: 800;
  }

  .metric strong {
    color: #fff;
    font-size: 28px;
    line-height: 1.1;
  }

  .metric.accent {
    border-color: rgba(0,255,136,.55);
    box-shadow: inset 0 0 24px rgba(0,255,136,.04);
  }

  .metric.accent strong {
    color: #00ff88;
  }

  .metric.warn strong {
    color: #ff9a52;
  }

  .panel {
    border: 1px solid #292929;
    border-radius: 10px;
    background: #151515;
    padding: 22px;
  }

  .panel > p {
    color: #8c8c8c;
    margin-top: 7px;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: start;
    gap: 18px;
    margin-bottom: 18px;
  }

  .panel-header > span {
    color: #777;
    font-size: 12px;
  }

  .section-list,
  .activity-list {
    display: grid;
    gap: 9px;
  }

  .section-row {
    display: grid;
    grid-template-columns: minmax(220px, 1.2fr) minmax(260px, 1fr) 170px;
    gap: 24px;
    align-items: center;
    padding: 16px;
    border: 1px solid #262626;
    border-radius: 8px;
    background: #111;
  }

  .section-main,
  .status-stack,
  .activity-row > div {
    display: grid;
    gap: 4px;
  }

  .section-main strong {
    color: #f2f2f2;
  }

  .section-main span,
  .activity-row span,
  small {
    color: #828282;
    font-size: 12px;
  }

  .progress-block {
    display: grid;
    gap: 8px;
  }

  .progress-copy {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    color: #a7a7a7;
    font-size: 12px;
  }

  .progress-copy strong {
    color: #00ff88;
  }

  .progress-track {
    height: 7px;
    border-radius: 999px;
    background: #282828;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #00ff88;
    border-radius: inherit;
  }

  .status-stack {
    justify-items: start;
  }

  .status {
    display: inline-flex;
    width: fit-content;
    padding: 4px 8px;
    border-radius: 999px;
    background: #222;
    color: #bbb;
    font-size: 11px;
    font-weight: 800;
  }

  .status.normal,
  .status.completed {
    color: #00ff88;
    background: rgba(0,255,136,.08);
  }

  .status.hold {
    color: #ff9a52;
    background: rgba(255,154,82,.1);
  }

  .status.in_progress {
    color: #00b4ff;
    background: rgba(0,180,255,.1);
  }

  .two-column {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }

  .mini-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 18px;
  }

  .mini-stats span {
    padding: 12px;
    border-radius: 8px;
    background: #101010;
    color: #7e7e7e;
    font-size: 12px;
  }

  .mini-stats strong {
    display: block;
    color: #e7e7e7;
    font-size: 19px;
    margin-bottom: 3px;
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 760px;
  }

  th {
    padding: 11px 12px;
    text-align: left;
    color: #666;
    text-transform: uppercase;
    letter-spacing: .06em;
    font-size: 10px;
    border-bottom: 1px solid #2b2b2b;
  }

  td {
    padding: 14px 12px;
    border-bottom: 1px solid #242424;
    color: #cfcfcf;
    font-size: 13px;
    vertical-align: top;
  }

  td strong,
  td small {
    display: block;
  }

  td small {
    margin-top: 4px;
  }

  tr:last-child td {
    border-bottom: 0;
  }

  .management-note,
  .report-footnote {
    margin-top: 18px;
    padding: 13px 15px;
    border: 1px solid #2b2b2b;
    border-radius: 8px;
    background: #101010;
    color: #7f7f7f;
    font-size: 12px;
  }

  .activity-row {
    display: grid;
    grid-template-columns: minmax(180px, .7fr) 170px minmax(240px, 1.3fr);
    gap: 20px;
    padding: 14px;
    border: 1px solid #252525;
    border-radius: 8px;
    background: #101010;
  }

  .activity-note {
    color: #b5b5b5;
    font-size: 13px;
  }

  .follow-up {
    width: fit-content;
    margin-top: 7px;
    padding: 3px 7px;
    border-radius: 999px;
    color: #ff9a52 !important;
    background: rgba(255,154,82,.1);
    font-size: 10px !important;
    font-weight: 800;
  }

  .report-actions {
    justify-content: flex-end;
  }

  .report-actions button:first-child {
    border-color: rgba(0,255,136,.45);
    color: #00ff88;
  }

  .error-box {
    margin-bottom: 18px;
    padding: 12px 15px;
    border: 1px solid rgba(255,90,90,.35);
    background: rgba(255,90,90,.08);
    color: #ff8b8b;
    border-radius: 8px;
    font-size: 13px;
  }

  .loading-panel {
    min-height: 360px;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 16px;
    color: #888;
  }

  .spinner {
    width: 42px;
    height: 42px;
    border: 3px solid #2b2b2b;
    border-top-color: #00ff88;
    border-radius: 50%;
    animation: spin .8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty {
    padding: 28px 15px;
    text-align: center;
    color: #6f6f6f;
  }

  .access-card {
    width: min(520px, 100%);
    padding: 28px;
    border: 1px solid #292929;
    border-radius: 10px;
    background: #151515;
  }

  .access-card h1 {
    margin: 5px 0 10px;
  }

  .access-card p {
    color: #999;
    margin-bottom: 20px;
  }

  @media (max-width: 1180px) {
    .metric-grid {
      grid-template-columns: repeat(3, 1fr);
    }

    .section-row {
      grid-template-columns: 1fr 1fr;
    }

    .status-stack {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 760px) {
    .topbar,
    .school-heading {
      align-items: flex-start;
      flex-direction: column;
    }

    .header-actions {
      width: 100%;
    }

    .header-actions button {
      flex: 1;
    }

    .page {
      width: min(100% - 24px, 1500px);
      padding-top: 22px;
    }

    .school-selector {
      width: 100%;
      min-width: 0;
    }

    .metric-grid,
    .two-column,
    .mini-stats {
      grid-template-columns: 1fr 1fr;
    }

    .section-row,
    .activity-row {
      grid-template-columns: 1fr;
      gap: 13px;
    }

    .status-stack {
      grid-column: auto;
    }
  }

  @media (max-width: 480px) {
    .metric-grid,
    .mini-stats {
      grid-template-columns: 1fr;
    }

    .panel {
      padding: 16px;
    }

    .metric {
      min-height: 94px;
    }
  }

  @media print {
    .topbar,
    .tabs,
    .report-actions,
    .school-selector {
      display: none !important;
    }

    .school-shell {
      background: white;
      color: black;
    }

    .page {
      width: 100%;
      padding: 0;
    }

    .panel,
    .metric {
      border-color: #bbb;
      background: white;
      color: black;
      break-inside: avoid;
    }

    h2, h3, .metric strong, td {
      color: black;
    }

    .eyebrow,
    .metric span,
    th,
    .report-footnote {
      color: #444;
    }
  }
`;

