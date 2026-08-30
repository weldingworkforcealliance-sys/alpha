'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

type OwnerTab = 'overview' | 'schools' | 'instructors' | 'activity' | 'reports';

interface School {
  id: string;
  name: string;
  status: string | null;
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
}

interface SectionProgress {
  section_id: string;
  school_id: string;
  current_planner_day_number: number | null;
  manual_hold: boolean;
  hold_reason: string | null;
  completed_at: string | null;
  updated_at: string | null;
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

interface SectionInstructor {
  id: string;
  school_id: string;
  section_id: string;
  instructor_id: string;
  instructor_role: string | null;
  active: boolean;
}

interface PlannerDay {
  id: string;
  school_id: string;
  section_id: string;
  planner_day_number: number;
  scheduled_date: string;
  status: string | null;
}

interface Delivery {
  id: string;
  school_id: string;
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

function formatMinutes(minutes: number) {
  if (!minutes) return '0 hr';
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

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export default function OwnerDashboardPage() {
  const router = useRouter();

  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  );

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<OwnerTab>('overview');
  const [schoolFilter, setSchoolFilter] = useState('all');

  const [schools, setSchools] = useState<School[]>([]);
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

        const { data: ownerData, error: ownerError } = await supabase.rpc(
          'is_platform_owner'
        );

        if (ownerError) {
          throw new Error(`Owner authorization failed: ${ownerError.message}`);
        }

        if (!ownerData) {
          setAuthorized(false);
          return;
        }

        setAuthorized(true);

        const [
          schoolsResult,
          coursesResult,
          sectionsResult,
          progressResult,
          membershipsResult,
          instructorsResult,
          daysResult,
          deliveriesResult,
        ] = await Promise.all([
          supabase.from('schools').select('id, name, status').order('name'),
          supabase
            .from('courses')
            .select('id, school_id, course_code, course_name, status')
            .order('course_code'),
          supabase
            .from('sections')
            .select(
              'id, school_id, course_id, section_name, section_code, status, start_date, end_date, planned_instructional_days, planned_minutes_per_day'
            )
            .order('section_name'),
          supabase
            .from('section_progress')
            .select(
              'section_id, school_id, current_planner_day_number, manual_hold, hold_reason, completed_at, updated_at'
            ),
          supabase
            .from('school_memberships')
            .select('id, school_id, user_id, role, status')
            .eq('status', 'active'),
          supabase
            .from('section_instructors')
            .select(
              'id, school_id, section_id, instructor_id, instructor_role, active'
            )
            .eq('active', true),
          supabase
            .from('planner_days')
            .select(
              'id, school_id, section_id, planner_day_number, scheduled_date, status'
            )
            .order('scheduled_date'),
          supabase
            .from('planner_day_delivery')
            .select(
              'id, school_id, section_id, planner_day_id, delivery_status, actual_date, started_at, completed_at, instructor_id, actual_minutes, deviation_summary, follow_up_needed, follow_up_notes, updated_at'
            )
            .order('updated_at', { ascending: false }),
        ]);

        const firstError = [
          schoolsResult.error,
          coursesResult.error,
          sectionsResult.error,
          progressResult.error,
          membershipsResult.error,
          instructorsResult.error,
          daysResult.error,
          deliveriesResult.error,
        ].find(Boolean);

        if (firstError) {
          throw new Error(firstError?.message ?? 'Platform data query failed.');
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

        setSchools((schoolsResult.data ?? []) as School[]);
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
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : 'Failed to load Owner Dashboard.'
        );
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [router, supabase]);

  const schoolMap = useMemo(
    () => new Map(schools.map((school) => [school.id, school])),
    [schools]
  );

  const courseMap = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses]
  );

  const sectionMap = useMemo(
    () => new Map(sections.map((section) => [section.id, section])),
    [sections]
  );

  const progressMap = useMemo(
    () => new Map(progress.map((item) => [item.section_id, item])),
    [progress]
  );

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );

  const today = localDateKey();

  const filteredSchoolIds = useMemo(() => {
    if (schoolFilter === 'all') return new Set(schools.map((school) => school.id));
    return new Set([schoolFilter]);
  }, [schoolFilter, schools]);

  const filteredSections = useMemo(
    () => sections.filter((section) => filteredSchoolIds.has(section.school_id)),
    [sections, filteredSchoolIds]
  );

  const filteredDeliveries = useMemo(
    () =>
      deliveries.filter((delivery) => filteredSchoolIds.has(delivery.school_id)),
    [deliveries, filteredSchoolIds]
  );

  const filteredPlannerDays = useMemo(
    () => plannerDays.filter((day) => filteredSchoolIds.has(day.school_id)),
    [plannerDays, filteredSchoolIds]
  );

  const activeSections = useMemo(
    () =>
      filteredSections.filter(
        (section) =>
          !['inactive', 'archived', 'completed'].includes(
            (section.status ?? '').toLowerCase()
          )
      ),
    [filteredSections]
  );

  const completedDeliveries = useMemo(
    () =>
      filteredDeliveries.filter(
        (delivery) =>
          delivery.delivery_status === 'completed' &&
          delivery.actual_minutes !== null
      ),
    [filteredDeliveries]
  );

  const totalActualMinutes = completedDeliveries.reduce(
    (sum, delivery) => sum + (delivery.actual_minutes ?? 0),
    0
  );

  const averageClassMinutes =
    completedDeliveries.length > 0
      ? Math.round(totalActualMinutes / completedDeliveries.length)
      : 0;

  const todayPlannerDays = filteredPlannerDays.filter(
    (day) => day.scheduled_date === today
  );

  const todayDeliveries = filteredDeliveries.filter(
    (delivery) => delivery.actual_date === today
  );

  const followUps = filteredDeliveries.filter(
    (delivery) => delivery.follow_up_needed
  );

  const holds = progress.filter(
    (item) => filteredSchoolIds.has(item.school_id) && item.manual_hold
  );

  const teachingUserIds = useMemo(() => {
    const ids = new Set<string>();

    memberships.forEach((membership) => {
      if (
        filteredSchoolIds.has(membership.school_id) &&
        ['instructor', 'lead_instructor'].includes(membership.role)
      ) {
        ids.add(membership.user_id);
      }
    });

    sectionInstructors.forEach((assignment) => {
      if (
        filteredSchoolIds.has(assignment.school_id) &&
        assignment.active
      ) {
        ids.add(assignment.instructor_id);
      }
    });

    return ids;
  }, [memberships, sectionInstructors, filteredSchoolIds]);

  const schoolRows = useMemo(
    () =>
      schools.map((school) => {
        const schoolCourses = courses.filter(
          (course) => course.school_id === school.id
        );

        const schoolSections = sections.filter(
          (section) => section.school_id === school.id
        );

        const schoolAssignments = sectionInstructors.filter(
          (assignment) => assignment.school_id === school.id && assignment.active
        );

        const instructorIds = new Set(
          schoolAssignments.map((assignment) => assignment.instructor_id)
        );

        memberships
          .filter(
            (membership) =>
              membership.school_id === school.id &&
              ['instructor', 'lead_instructor'].includes(membership.role)
          )
          .forEach((membership) => instructorIds.add(membership.user_id));

        const schoolDeliveries = deliveries.filter(
          (delivery) => delivery.school_id === school.id
        );

        const schoolCompleted = schoolDeliveries.filter(
          (delivery) =>
            delivery.delivery_status === 'completed' &&
            delivery.actual_minutes !== null
        );

        const minutes = schoolCompleted.reduce(
          (sum, delivery) => sum + (delivery.actual_minutes ?? 0),
          0
        );

        const schoolProgress = progress.filter(
          (item) => item.school_id === school.id
        );

        const averagePercent =
          schoolSections.length > 0
            ? Math.round(
                schoolSections.reduce((sum, section) => {
                  const currentDay =
                    progressMap.get(section.id)?.current_planner_day_number ?? 1;
                  const plannedDays = section.planned_instructional_days ?? 0;
                  const percent =
                    plannedDays > 0
                      ? Math.min(100, (currentDay / plannedDays) * 100)
                      : 0;
                  return sum + percent;
                }, 0) / schoolSections.length
              )
            : 0;

        return {
          school,
          courses: schoolCourses.length,
          sections: schoolSections.length,
          instructors: instructorIds.size,
          completedDays: schoolCompleted.length,
          minutes,
          followUps: schoolDeliveries.filter(
            (delivery) => delivery.follow_up_needed
          ).length,
          holds: schoolProgress.filter((item) => item.manual_hold).length,
          averagePercent,
        };
      }),
    [
      schools,
      courses,
      sections,
      sectionInstructors,
      memberships,
      deliveries,
      progress,
      progressMap,
    ]
  );

  const instructorRows = useMemo(() => {
    const rows = Array.from(teachingUserIds).map((userId) => {
      const profile = profileMap.get(userId);

      const assignments = sectionInstructors.filter(
        (assignment) =>
          assignment.instructor_id === userId &&
          assignment.active &&
          filteredSchoolIds.has(assignment.school_id)
      );

      const schoolIds = new Set(assignments.map((assignment) => assignment.school_id));

      memberships
        .filter(
          (membership) =>
            membership.user_id === userId &&
            filteredSchoolIds.has(membership.school_id) &&
            ['instructor', 'lead_instructor'].includes(membership.role)
        )
        .forEach((membership) => schoolIds.add(membership.school_id));

      const instructorDeliveries = filteredDeliveries.filter(
        (delivery) => delivery.instructor_id === userId
      );

      const completed = instructorDeliveries.filter(
        (delivery) =>
          delivery.delivery_status === 'completed' &&
          delivery.actual_minutes !== null
      );

      const minutes = completed.reduce(
        (sum, delivery) => sum + (delivery.actual_minutes ?? 0),
        0
      );

      return {
        userId,
        profile,
        schools: Array.from(schoolIds)
          .map((schoolId) => schoolMap.get(schoolId)?.name)
          .filter((name): name is string => Boolean(name)),
        assignments,
        completedDays: completed.length,
        minutes,
        followUps: instructorDeliveries.filter(
          (delivery) => delivery.follow_up_needed
        ).length,
      };
    });

    return rows.sort((a, b) =>
      (a.profile?.display_name ?? a.profile?.email ?? '').localeCompare(
        b.profile?.display_name ?? b.profile?.email ?? ''
      )
    );
  }, [
    teachingUserIds,
    profileMap,
    sectionInstructors,
    filteredSchoolIds,
    memberships,
    filteredDeliveries,
    schoolMap,
  ]);

  const sectionRows = useMemo(
    () =>
      filteredSections
        .map((section) => {
          const school = schoolMap.get(section.school_id);
          const course = courseMap.get(section.course_id);
          const sectionProgress = progressMap.get(section.id);

          const assignments = sectionInstructors.filter(
            (assignment) =>
              assignment.section_id === section.id && assignment.active
          );

          const instructors = assignments
            .map((assignment) => profileMap.get(assignment.instructor_id)?.display_name)
            .filter((name): name is string => Boolean(name));

          const currentDay = sectionProgress?.current_planner_day_number ?? 1;
          const plannedDays = section.planned_instructional_days ?? 0;
          const percent =
            plannedDays > 0
              ? Math.min(100, Math.round((currentDay / plannedDays) * 100))
              : 0;

          const sectionDeliveries = filteredDeliveries.filter(
            (delivery) => delivery.section_id === section.id
          );

          const completed = sectionDeliveries.filter(
            (delivery) =>
              delivery.delivery_status === 'completed' &&
              delivery.actual_minutes !== null
          );

          const minutes = completed.reduce(
            (sum, delivery) => sum + (delivery.actual_minutes ?? 0),
            0
          );

          return {
            section,
            school,
            course,
            sectionProgress,
            instructors,
            currentDay,
            plannedDays,
            percent,
            completedDays: completed.length,
            minutes,
            followUps: sectionDeliveries.filter(
              (delivery) => delivery.follow_up_needed
            ).length,
          };
        })
        .sort((a, b) => {
          const schoolCompare = (a.school?.name ?? '').localeCompare(
            b.school?.name ?? ''
          );
          if (schoolCompare !== 0) return schoolCompare;
          return (a.section.section_name ?? '').localeCompare(
            b.section.section_name ?? ''
          );
        }),
    [
      filteredSections,
      schoolMap,
      courseMap,
      progressMap,
      sectionInstructors,
      profileMap,
      filteredDeliveries,
    ]
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const downloadPlatformCsv = () => {
    const rows = [
      [
        'School',
        'Section',
        'Course',
        'Current Day',
        'Planned Days',
        'Percent Complete',
        'Instructor(s)',
        'Completed Teaching Days',
        'Recorded Minutes',
        'Follow-Ups',
        'Manual Hold',
      ],
      ...sectionRows.map((row) => [
        row.school?.name ?? '',
        row.section.section_name ?? row.section.section_code ?? '',
        row.course?.course_code ?? '',
        row.currentDay,
        row.plannedDays,
        row.percent,
        row.instructors.join('; '),
        row.completedDays,
        row.minutes,
        row.followUps,
        row.sectionProgress?.manual_hold ? 'Yes' : 'No',
      ]),
    ];

    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download =
      schoolFilter === 'all'
        ? 'living_teacher_planner_platform_report.csv'
        : `${(schoolMap.get(schoolFilter)?.name ?? 'school')
            .replace(/[^a-z0-9]+/gi, '_')
            .toLowerCase()}_owner_report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <main className="owner-shell centered">
        <div className="spinner" />
        <p>Verifying Platform Owner access…</p>
        <style jsx>{styles}</style>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="owner-shell centered">
        <section className="access-card">
          <div className="eyebrow">Private Platform Area</div>
          <h1>Access denied</h1>
          <p>
            This dashboard is restricted to the Platform Owner account.
          </p>
          <button onClick={() => router.push('/dashboard')}>
            Return to Teacher Dashboard
          </button>
        </section>
        <style jsx>{styles}</style>
      </main>
    );
  }

  return (
    <div className="owner-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Living Teacher Planner</div>
          <h1>Platform Owner Dashboard</h1>
        </div>

        <div className="header-actions">
          <button className="secondary" onClick={() => router.push('/owner/admin')}>
            ADMIN
          </button>
          <button className="secondary" onClick={() => router.push('/training')}>
            Training Mode
          </button>
          <button className="secondary" onClick={() => router.push('/accounts')}>
            Account Management
          </button>
          <button className="secondary" onClick={() => router.push('/school')}>
            School Dashboard
          </button>
          <button className="secondary" onClick={() => router.push('/dashboard')}>
            Teacher Dashboard
          </button>
          <button className="secondary" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </header>

      <main className="page">
        <section className="heading-row">
          <div>
            <div className="eyebrow">Platform Operations</div>
            <h2>Network Overview</h2>
            <p>
              Cross-school instructional delivery, staffing, progress, and follow-up
              reporting.
            </p>
          </div>

          <label className="school-filter">
            <span>Reporting Scope</span>
            <select
              value={schoolFilter}
              onChange={(event) => setSchoolFilter(event.target.value)}
            >
              <option value="all">All Schools</option>
              {schools.map((school) => (
                <option value={school.id} key={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        {error && <div className="error-box">{error}</div>}

        <nav className="tabs" aria-label="Owner dashboard sections">
          {(
            [
              ['overview', 'Overview'],
              ['schools', 'Schools'],
              ['instructors', 'Instructors'],
              ['activity', 'Activity'],
              ['reports', 'Reports'],
            ] as [OwnerTab, string][]
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

        {activeTab === 'overview' && (
          <section className="stack">
            <div className="metric-grid">
              <Metric
                label={schoolFilter === 'all' ? 'Schools' : 'Selected Schools'}
                value={
                  schoolFilter === 'all'
                    ? schools.length
                    : schools.filter((school) => school.id === schoolFilter).length
                }
              />
              <Metric label="Active Sections" value={activeSections.length} />
              <Metric label="Instructors" value={teachingUserIds.size} />
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
              <Metric
                label="Recorded Instruction"
                value={formatMinutes(totalActualMinutes)}
              />
              <Metric
                label="Avg. Completed Class"
                value={averageClassMinutes ? `${averageClassMinutes} min` : '—'}
              />
              <Metric label="Follow-Ups" value={followUps.length} warn />
              <Metric label="Sections On Hold" value={holds.length} warn />
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <div className="eyebrow">School Performance</div>
                  <h3>Operational Overview</h3>
                </div>
                <span>{schools.length} participating schools</span>
              </div>

              <div className="school-card-grid">
                {schoolRows
                  .filter(
                    (row) =>
                      schoolFilter === 'all' || row.school.id === schoolFilter
                  )
                  .map((row) => (
                    <article className="school-card" key={row.school.id}>
                      <div className="school-card-top">
                        <div>
                          <strong>{row.school.name}</strong>
                          <span>{titleCase(row.school.status)}</span>
                        </div>
                        <div className="percent">{row.averagePercent}%</div>
                      </div>

                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${row.averagePercent}%` }}
                        />
                      </div>

                      <div className="school-stats">
                        <span>
                          <strong>{row.sections}</strong>
                          sections
                        </span>
                        <span>
                          <strong>{row.instructors}</strong>
                          instructors
                        </span>
                        <span>
                          <strong>{row.completedDays}</strong>
                          completed days
                        </span>
                        <span>
                          <strong>{formatMinutes(row.minutes)}</strong>
                          recorded
                        </span>
                      </div>

                      <div className="attention-row">
                        <span className={row.followUps ? 'warn-text' : ''}>
                          {row.followUps} follow-ups
                        </span>
                        <span className={row.holds ? 'warn-text' : ''}>
                          {row.holds} holds
                        </span>
                      </div>
                    </article>
                  ))}
              </div>
            </div>

            <div className="two-column">
              <div className="panel">
                <div className="eyebrow">Instructional Delivery</div>
                <h3>{completedDeliveries.length}</h3>
                <p>Completed teaching days recorded across the selected scope.</p>
                <div className="mini-stats">
                  <span>
                    <strong>{formatMinutes(totalActualMinutes)}</strong>
                    total instruction
                  </span>
                  <span>
                    <strong>{averageClassMinutes || '—'}</strong>
                    average minutes
                  </span>
                </div>
              </div>

              <div className="panel">
                <div className="eyebrow">Needs Attention</div>
                <h3>{followUps.length + holds.length}</h3>
                <p>Operational items currently flagged for review.</p>
                <div className="mini-stats">
                  <span>
                    <strong>{followUps.length}</strong>
                    teacher follow-ups
                  </span>
                  <span>
                    <strong>{holds.length}</strong>
                    section holds
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'schools' && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Participating Programs</div>
                <h3>Schools</h3>
              </div>
              <span>{schools.length} schools</span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Courses</th>
                    <th>Sections</th>
                    <th>Instructors</th>
                    <th>Avg. Progress</th>
                    <th>Completed Days</th>
                    <th>Recorded Time</th>
                    <th>Attention</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolRows.map((row) => (
                    <tr key={row.school.id}>
                      <td>
                        <strong>{row.school.name}</strong>
                        <small>{titleCase(row.school.status)}</small>
                      </td>
                      <td>{row.courses}</td>
                      <td>{row.sections}</td>
                      <td>{row.instructors}</td>
                      <td>{row.averagePercent}%</td>
                      <td>{row.completedDays}</td>
                      <td>{formatMinutes(row.minutes)}</td>
                      <td>
                        <span className={row.followUps || row.holds ? 'warn-text' : ''}>
                          {row.followUps} follow-ups · {row.holds} holds
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'instructors' && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Network Staffing</div>
                <h3>Instructors</h3>
              </div>
              <span>{instructorRows.length} instructors</span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Instructor</th>
                    <th>School(s)</th>
                    <th>Active Sections</th>
                    <th>Completed Days</th>
                    <th>Recorded Time</th>
                    <th>Follow-Ups</th>
                  </tr>
                </thead>
                <tbody>
                  {instructorRows.map((row) => (
                    <tr key={row.userId}>
                      <td>
                        <strong>{row.profile?.display_name ?? 'Name unavailable'}</strong>
                        <small>{row.profile?.email ?? ''}</small>
                      </td>
                      <td>{row.schools.join(', ') || '—'}</td>
                      <td>{row.assignments.length}</td>
                      <td>{row.completedDays}</td>
                      <td>{formatMinutes(row.minutes)}</td>
                      <td>
                        <span className={row.followUps ? 'warn-text' : ''}>
                          {row.followUps}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {instructorRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty-cell">
                        No instructors found in the selected scope.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'activity' && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Recent Delivery</div>
                <h3>Instructional Activity</h3>
              </div>
              <span>Latest 75 records</span>
            </div>

            <div className="activity-list">
              {filteredDeliveries.slice(0, 75).map((delivery) => {
                const school = schoolMap.get(delivery.school_id);
                const section = sectionMap.get(delivery.section_id);
                const instructor = delivery.instructor_id
                  ? profileMap.get(delivery.instructor_id)
                  : null;

                return (
                  <article className="activity-row" key={delivery.id}>
                    <div>
                      <strong>{school?.name ?? 'School'}</strong>
                      <span>
                        {section?.section_name ??
                          section?.section_code ??
                          'Section'}
                      </span>
                    </div>

                    <div>
                      <strong>
                        {instructor?.display_name ?? 'Instructor'}
                      </strong>
                      <span>{formatDate(delivery.actual_date)}</span>
                    </div>

                    <div>
                      <span className={`status ${delivery.delivery_status}`}>
                        {titleCase(delivery.delivery_status)}
                      </span>
                      <small>
                        {delivery.actual_minutes !== null
                          ? `${delivery.actual_minutes} min`
                          : formatDateTime(delivery.started_at)}
                      </small>
                    </div>

                    <div className="activity-note">
                      {delivery.deviation_summary || 'No daily comment recorded'}
                      {delivery.follow_up_needed && (
                        <span className="follow-up">Follow-up flagged</span>
                      )}
                    </div>
                  </article>
                );
              })}

              {filteredDeliveries.length === 0 && (
                <div className="empty">
                  No instructional activity found in the selected scope.
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'reports' && (
          <section className="stack">
            <div className="report-actions">
              <button onClick={() => window.print()}>Print Owner Report</button>
              <button onClick={downloadPlatformCsv}>Download Platform CSV</button>
            </div>

            <div className="metric-grid compact">
              <Metric
                label="Schools"
                value={
                  schoolFilter === 'all'
                    ? schools.length
                    : schools.filter((school) => school.id === schoolFilter).length
                }
              />
              <Metric label="Sections" value={filteredSections.length} />
              <Metric label="Instructors" value={teachingUserIds.size} />
              <Metric
                label="Completed Days"
                value={completedDeliveries.length}
              />
              <Metric
                label="Recorded Instruction"
                value={formatMinutes(totalActualMinutes)}
              />
              <Metric label="Follow-Ups" value={followUps.length} warn />
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <div className="eyebrow">Detailed Report</div>
                  <h3>Section Progress</h3>
                </div>
                <span>{sectionRows.length} sections</span>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>School</th>
                      <th>Section</th>
                      <th>Course</th>
                      <th>Progress</th>
                      <th>Instructor</th>
                      <th>Completed Days</th>
                      <th>Recorded Time</th>
                      <th>Follow-Ups</th>
                      <th>Hold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectionRows.map((row) => (
                      <tr key={row.section.id}>
                        <td>{row.school?.name ?? '—'}</td>
                        <td>
                          <strong>
                            {row.section.section_name ??
                              row.section.section_code ??
                              'Unnamed Section'}
                          </strong>
                          <small>
                            {formatDate(row.section.start_date)} to{' '}
                            {formatDate(row.section.end_date)}
                          </small>
                        </td>
                        <td>{row.course?.course_code ?? '—'}</td>
                        <td>
                          Day {row.currentDay} / {row.plannedDays || '—'} ·{' '}
                          {row.percent}%
                        </td>
                        <td>{row.instructors.join(', ') || 'Unassigned'}</td>
                        <td>{row.completedDays}</td>
                        <td>{formatMinutes(row.minutes)}</td>
                        <td>
                          <span className={row.followUps ? 'warn-text' : ''}>
                            {row.followUps}
                          </span>
                        </td>
                        <td>
                          {row.sectionProgress?.manual_hold ? (
                            <span className="warn-text">Yes</span>
                          ) : (
                            'No'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="report-footnote">
              Owner Dashboard v1 reports directly from the operational teaching
              records. Regional grouping, annual comparison, and formal release-cycle
              analytics can be layered on without changing protected curriculum or
              course outcomes.
            </div>
          </section>
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
    <article className={`metric ${accent ? 'accent' : ''} ${warn ? 'warn' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

const styles = `
  :global(body) {
    background: #080808;
  }

  .owner-shell {
    min-height: 100vh;
    background:
      radial-gradient(circle at 12% 0%, rgba(0,255,136,.08), transparent 28rem),
      radial-gradient(circle at 88% 8%, rgba(0,180,255,.05), transparent 26rem),
      #080808;
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

  h1, h2, h3, p {
    margin: 0;
  }

  h1 {
    color: #fff;
    font-size: 25px;
  }

  h2 {
    color: #fff;
    font-size: clamp(27px, 3vw, 40px);
    margin-top: 3px;
  }

  h3 {
    color: #fff;
    font-size: 22px;
    margin-top: 4px;
  }

  .eyebrow {
    color: #00ff88;
    text-transform: uppercase;
    letter-spacing: .12em;
    font-size: 11px;
    font-weight: 800;
  }

  .topbar {
    min-height: 84px;
    padding: 18px 28px;
    border-bottom: 1px solid #252525;
    background: rgba(16,16,16,.95);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
  }

  .header-actions,
  .report-actions {
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
    width: min(1540px, calc(100% - 36px));
    margin: 0 auto;
    padding: 30px 0 60px;
  }

  .heading-row {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 24px;
    margin-bottom: 24px;
  }

  .heading-row p {
    color: #919191;
    margin-top: 7px;
  }

  .school-filter {
    display: grid;
    gap: 6px;
    min-width: 280px;
  }

  .school-filter span {
    color: #777;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .08em;
  }

  .school-filter select {
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
    grid-template-columns: repeat(5, minmax(150px, 1fr));
    gap: 12px;
  }

  .metric-grid.compact {
    grid-template-columns: repeat(6, minmax(140px, 1fr));
  }

  .metric {
    min-height: 112px;
    padding: 17px;
    border: 1px solid #292929;
    border-radius: 10px;
    background: linear-gradient(180deg, #191919, #121212);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .metric span {
    color: #858585;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .06em;
    font-weight: 800;
  }

  .metric strong {
    color: #fff;
    font-size: 27px;
    line-height: 1.08;
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

  .school-card-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(260px, 1fr));
    gap: 12px;
  }

  .school-card {
    padding: 17px;
    border: 1px solid #272727;
    border-radius: 9px;
    background: #101010;
  }

  .school-card-top {
    display: flex;
    justify-content: space-between;
    align-items: start;
    gap: 15px;
  }

  .school-card-top > div:first-child {
    display: grid;
    gap: 3px;
  }

  .school-card-top strong {
    color: #f2f2f2;
  }

  .school-card-top span {
    color: #737373;
    font-size: 11px;
  }

  .percent {
    color: #00ff88;
    font-size: 20px;
    font-weight: 800;
  }

  .progress-track {
    height: 7px;
    margin: 14px 0;
    border-radius: 999px;
    background: #282828;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #00ff88;
    border-radius: inherit;
  }

  .school-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .school-stats span,
  .mini-stats span {
    padding: 10px;
    border-radius: 7px;
    background: #171717;
    color: #797979;
    font-size: 11px;
  }

  .school-stats strong,
  .mini-stats strong {
    display: block;
    color: #e8e8e8;
    font-size: 17px;
    margin-bottom: 2px;
  }

  .attention-row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-top: 12px;
    color: #737373;
    font-size: 11px;
  }

  .warn-text {
    color: #ff9a52 !important;
    font-weight: 700;
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

  .table-wrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 900px;
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
    color: #7d7d7d;
    font-size: 11px;
  }

  tr:last-child td {
    border-bottom: 0;
  }

  .activity-list {
    display: grid;
    gap: 9px;
  }

  .activity-row {
    display: grid;
    grid-template-columns:
      minmax(180px, .8fr)
      minmax(150px, .65fr)
      150px
      minmax(240px, 1.4fr);
    gap: 20px;
    align-items: start;
    padding: 14px;
    border: 1px solid #252525;
    border-radius: 8px;
    background: #101010;
  }

  .activity-row > div {
    display: grid;
    gap: 4px;
  }

  .activity-row strong {
    color: #e9e9e9;
    font-size: 13px;
  }

  .activity-row span,
  .activity-row small {
    color: #828282;
    font-size: 11px;
  }

  .activity-note {
    color: #b5b5b5;
    font-size: 13px;
  }

  .status {
    display: inline-flex;
    width: fit-content;
    padding: 4px 8px;
    border-radius: 999px;
    background: #222;
    color: #bbb !important;
    font-size: 10px !important;
    font-weight: 800;
  }

  .status.completed {
    color: #00ff88 !important;
    background: rgba(0,255,136,.08);
  }

  .status.in_progress {
    color: #00b4ff !important;
    background: rgba(0,180,255,.1);
  }

  .follow-up {
    width: fit-content;
    margin-top: 6px;
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

  .report-footnote {
    padding: 13px 15px;
    border: 1px solid #2b2b2b;
    border-radius: 8px;
    background: #101010;
    color: #777;
    font-size: 12px;
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

  .empty,
  .empty-cell {
    padding: 28px 15px !important;
    text-align: center;
    color: #6f6f6f !important;
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

  @media (max-width: 1220px) {
    .metric-grid,
    .metric-grid.compact {
      grid-template-columns: repeat(3, 1fr);
    }

    .school-card-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .activity-row {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 760px) {
    .topbar,
    .heading-row {
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
      width: min(100% - 24px, 1540px);
      padding-top: 22px;
    }

    .school-filter {
      min-width: 0;
      width: 100%;
    }

    .metric-grid,
    .metric-grid.compact,
    .two-column,
    .school-card-grid,
    .mini-stats {
      grid-template-columns: 1fr 1fr;
    }

    .activity-row {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 480px) {
    .metric-grid,
    .metric-grid.compact,
    .two-column,
    .school-card-grid,
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
    .school-filter {
      display: none !important;
    }

    .owner-shell {
      background: white;
      color: black;
    }

    .page {
      width: 100%;
      padding: 0;
    }

    .panel,
    .metric,
    .school-card {
      border-color: #bbb;
      background: white;
      color: black;
      break-inside: avoid;
    }

    h2,
    h3,
    .metric strong,
    td,
    .school-card-top strong {
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
