'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-browser';
import { SCHOOL_DASHBOARD_ROLES } from '@/lib/access-roles';
import { guardedSignOut } from '@/lib/guarded-signout';
import {
  publishSelectedSection,
  readSelectedSectionId,
  subscribeSelectedSection,
} from '@/lib/section-selection';

interface TeachingSection {
  school_id: string;
  section_id: string;
  section_name: string | null;
  section_code: string | null;
  course_code: string | null;
  course_name: string | null;
  cohort_name: string | null;
  current_planner_day_number: number | null;
  planner_day_id: string | null;
  scheduled_date: string | null;
  guide_day_id: string | null;
  planner_day_title: string | null;
  manual_hold: boolean;
  hold_reason: string | null;
  completed_at: string | null;
}

interface PlannerDay {
  id: string;
  planner_day_number: number;
  scheduled_date: string;
  status: string | null;
}

interface CalendarException {
  id: string;
  exception_date: string;
  exception_type: string;
  reason: string | null;
  counts_as_teaching_day: boolean;
}

interface DayDelivery {
  planner_day_id: string;
  delivery_status: string;
  actual_date: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface GuideDay {
  id: string;
  guide_id: string;
  planner_day_number: number;
  title: string | null;
  objective: string | null;
  materials_equipment: string | null;
  corresponding_application: string | null;
  evidence_check_for_understanding: string | null;
  weekly_coaching_focus: string | null;
  coaching_focus: string | null;
  if_students_struggle: string | null;
  keep_momentum: string | null;
}

interface GuideDayRef {
  id: string;
  planner_day_number: number;
  title: string | null;
}

interface GuideSegment {
  id: string;
  sequence_number: number;
  segment_type: string;
  segment_title: string | null;
  planned_minutes: number;
  instructor_actions: string | null;
  start_minute: number | null;
  end_minute: number | null;
}

interface GuideResource {
  id: string;
  sequence_number: number;
  resource_type: string;
  resource_title: string;
  resource_url: string | null;
  resource_notes: string | null;
  required: boolean;
}

interface ProtectedOutcome {
  id: string;
  outcome_code: string;
  outcome_text: string;
  locked: boolean;
}

interface MathLesson {
  id: string;
  math_day_number: number;
  title: string;
  planned_minutes: number;
  book_connection: string | null;
  goal: string | null;
  instructor_notes: string | null;
  answers_quick_check: string | null;
}

interface MathSegment {
  id: string;
  sequence_number: number;
  start_minute: number | null;
  end_minute: number | null;
  planned_minutes: number;
  activity: string;
  segment_type: string;
}

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(date: string) {
  return new Date(`${date}T12:00:00`);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function minuteRange(
  startMinute: number | null,
  endMinute: number | null,
  plannedMinutes: number
) {
  if (startMinute !== null && endMinute !== null) {
    return `${startMinute}–${endMinute} min`;
  }
  return `${plannedMinutes} min`;
}

function formatElapsedTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

function formatClockTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const [sections, setSections] = useState<TeachingSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<TeachingSection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [visibleMonthIndex, setVisibleMonthIndex] = useState(0);

  const [plannerDays, setPlannerDays] = useState<PlannerDay[]>([]);
  const [calendarExceptions, setCalendarExceptions] = useState<CalendarException[]>([]);
  const [deliveries, setDeliveries] = useState<DayDelivery[]>([]);

  const [guideLoading, setGuideLoading] = useState(false);
  const [guideDay, setGuideDay] = useState<GuideDay | null>(null);
  const [guideDayRefs, setGuideDayRefs] = useState<GuideDayRef[]>([]);
  const [viewedGuideDayId, setViewedGuideDayId] = useState<string | null>(null);
  const [guideSegments, setGuideSegments] = useState<GuideSegment[]>([]);
  const [guideResources, setGuideResources] = useState<GuideResource[]>([]);
  const [protectedOutcomes, setProtectedOutcomes] = useState<ProtectedOutcome[]>([]);
  const [mathLesson, setMathLesson] = useState<MathLesson | null>(null);
  const [mathSegments, setMathSegments] = useState<MathSegment[]>([]);

  const [actualDate, setActualDate] = useState(getLocalDateString);
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [deviationSummary, setDeviationSummary] = useState('');
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [canOpenSchoolDashboard, setCanOpenSchoolDashboard] = useState(false);
  const [canOpenOwnerDashboard, setCanOpenOwnerDashboard] = useState(false);

  const [supabase] = useState(getSupabase);

  const refreshSections = async (sectionId?: string) => {
    const { data, error: queryError } = await supabase
      .from('current_teaching_sections')
      .select('*');

    if (queryError) {
      setError(`Failed to load sections: ${queryError.message}`);
      console.error('Query error:', queryError);
      return;
    }

    const typedSections = (data ?? []) as TeachingSection[];
    setSections(typedSections);

    if (typedSections.length === 0) {
      setSelectedSection(null);
      return;
    }

    const savedSectionId = readSelectedSectionId();
    const preferredSectionId = sectionId || savedSectionId;
    const selected =
      typedSections.find((section) => section.section_id === preferredSectionId) ??
      typedSections[0];

    setSelectedSection(selected);
    if (selected.section_id !== savedSectionId) {
      publishSelectedSection(selected.section_id);
    }
  };

  const loadCalendarData = async (sectionId: string) => {
    setCalendarLoading(true);

    const [daysResult, exceptionsResult, deliveriesResult] = await Promise.all([
      supabase
        .from('planner_days')
        .select('id, planner_day_number, scheduled_date, status')
        .eq('section_id', sectionId)
        .order('planner_day_number'),
      supabase
        .from('section_calendar_exceptions')
        .select('id, exception_date, exception_type, reason, counts_as_teaching_day')
        .eq('section_id', sectionId)
        .order('exception_date'),
      supabase
        .from('planner_day_delivery')
        .select('planner_day_id, delivery_status, actual_date, started_at, completed_at')
        .eq('section_id', sectionId),
    ]);

    const calendarError =
      daysResult.error || exceptionsResult.error || deliveriesResult.error;

    if (calendarError) {
      setError(`Failed to load class calendar: ${calendarError.message}`);
      console.error('Calendar query error:', calendarError);
      setCalendarLoading(false);
      return;
    }

    setPlannerDays((daysResult.data ?? []) as PlannerDay[]);
    setCalendarExceptions((exceptionsResult.data ?? []) as CalendarException[]);
    setDeliveries((deliveriesResult.data ?? []) as DayDelivery[]);
    setCalendarLoading(false);
  };

  const loadGuideData = async (guideDayId: string) => {
    setGuideLoading(true);
    setGuideDay(null);
    setGuideSegments([]);
    setGuideResources([]);
    setProtectedOutcomes([]);
    setMathLesson(null);
    setMathSegments([]);

    const [dayResult, segmentsResult, resourcesResult, outcomesResult, mathResult] =
      await Promise.all([
        supabase
          .from('course_guide_days')
          .select(
            'id, guide_id, planner_day_number, title, objective, materials_equipment, corresponding_application, evidence_check_for_understanding, weekly_coaching_focus, coaching_focus, if_students_struggle, keep_momentum'
          )
          .eq('id', guideDayId)
          .maybeSingle(),
        supabase
          .from('course_guide_day_segments')
          .select(
            'id, sequence_number, segment_type, segment_title, planned_minutes, instructor_actions, start_minute, end_minute'
          )
          .eq('guide_day_id', guideDayId)
          .order('sequence_number'),
        supabase
          .from('course_guide_day_resources')
          .select(
            'id, sequence_number, resource_type, resource_title, resource_url, resource_notes, required'
          )
          .eq('guide_day_id', guideDayId)
          .order('sequence_number'),
        supabase
          .from('course_guide_day_outcomes')
          .select('outcome_id')
          .eq('guide_day_id', guideDayId),
        supabase
          .from('course_guide_day_math')
          .select(
            'id, math_day_number, title, planned_minutes, book_connection, goal, instructor_notes, answers_quick_check'
          )
          .eq('guide_day_id', guideDayId)
          .maybeSingle(),
      ]);

    const guideError =
      dayResult.error ||
      segmentsResult.error ||
      resourcesResult.error ||
      outcomesResult.error;

    if (guideError) {
      setError(`Failed to load teacher guide: ${guideError.message}`);
      console.error('Teacher guide query error:', guideError);
      setGuideLoading(false);
      return;
    }

    const loadedGuideDay = (dayResult.data ?? null) as GuideDay | null;
    setGuideDay(loadedGuideDay);
    setGuideSegments((segmentsResult.data ?? []) as GuideSegment[]);
    setGuideResources((resourcesResult.data ?? []) as GuideResource[]);

    if (loadedGuideDay && !guideDayRefs.some((day) => day.id === loadedGuideDay.id)) {
      const { data: guideIndexData, error: guideIndexError } = await supabase
        .from('course_guide_days')
        .select('id, planner_day_number, title')
        .eq('guide_id', loadedGuideDay.guide_id)
        .order('planner_day_number');

      if (guideIndexError) {
        console.error('Guide day index query error:', guideIndexError);
      } else {
        setGuideDayRefs((guideIndexData ?? []) as GuideDayRef[]);
      }
    }

    const outcomeIds = (outcomesResult.data ?? [])
      .map((row: { outcome_id: string | null }) => row.outcome_id)
      .filter((id): id is string => Boolean(id));

    if (outcomeIds.length > 0) {
      const { data: outcomeData, error: outcomeError } = await supabase
        .from('course_outcomes')
        .select('id, outcome_code, outcome_text, locked')
        .in('id', outcomeIds)
        .order('outcome_code');

      if (outcomeError) {
        setError(`Failed to load protected outcomes: ${outcomeError.message}`);
        console.error('Outcome query error:', outcomeError);
      } else {
        setProtectedOutcomes((outcomeData ?? []) as ProtectedOutcome[]);
      }
    }

    if (!mathResult.error && mathResult.data) {
      const lesson = mathResult.data as MathLesson;
      setMathLesson(lesson);

      const { data: mathSegmentData, error: mathSegmentError } = await supabase
        .from('course_guide_day_math_segments')
        .select(
          'id, sequence_number, start_minute, end_minute, planned_minutes, activity, segment_type'
        )
        .eq('math_lesson_id', lesson.id)
        .order('sequence_number');

      if (mathSegmentError) {
        console.error('Math segment query error:', mathSegmentError);
      } else {
        setMathSegments((mathSegmentData ?? []) as MathSegment[]);
      }
    } else if (mathResult.error) {
      console.error('Math lesson query error:', mathResult.error);
    }

    setGuideLoading(false);
  };

  useEffect(() => {
    const loadSections = async () => {
      try {
        const { data: authData } = await supabase.auth.getSession();
        if (!authData.session) {
          router.push('/login');
          return;
        }

        const currentUserId = authData.session.user.id;

        const [ownerResult, membershipResult] = await Promise.all([
          supabase.rpc('is_platform_owner'),
          supabase
            .from('school_memberships')
            .select('role, status')
            .eq('user_id', currentUserId)
            .eq('status', 'active'),
        ]);

        const hasManagementMembership = (membershipResult.data ?? []).some(
          (membership: { role: string | null }) =>
            Boolean(membership.role && SCHOOL_DASHBOARD_ROLES.has(membership.role))
        );

        setCanOpenSchoolDashboard(
          Boolean(ownerResult.data) || hasManagementMembership
        );
        setCanOpenOwnerDashboard(Boolean(ownerResult.data));

        await refreshSections();
      } catch (err) {
        setError('An unexpected error occurred while loading sections');
        console.error('Load error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSections();
  }, [supabase, router]);

  useEffect(() => {
    return subscribeSelectedSection((sectionId) => {
      setSelectedSection((current) => {
        if (current?.section_id === sectionId) return current;
        return sections.find((section) => section.section_id === sectionId) ?? current;
      });
    });
  }, [sections]);

  useEffect(() => {
    if (selectedSection?.section_id) {
      loadCalendarData(selectedSection.section_id);
    }
  }, [selectedSection?.section_id]);

  useEffect(() => {
    setGuideDayRefs([]);
    setViewedGuideDayId(selectedSection?.guide_day_id ?? null);
  }, [selectedSection?.section_id, selectedSection?.guide_day_id]);

  useEffect(() => {
    if (viewedGuideDayId) {
      loadGuideData(viewedGuideDayId);
    } else {
      setGuideDay(null);
      setGuideSegments([]);
      setGuideResources([]);
      setProtectedOutcomes([]);
      setMathLesson(null);
      setMathSegments([]);
    }
  }, [viewedGuideDayId]);

  const handleStartToday = async () => {
    if (!selectedSection || !isViewingCurrentDay) return;

    setError('');
    setActionLoading(true);
    try {
      const { error: rpcError } = await supabase.rpc(
        'start_current_planner_day',
        {
          p_section_id: selectedSection.section_id,
          p_actual_date: actualDate,
        }
      );

      if (rpcError) {
        setError(`Failed to start day: ${rpcError.message}`);
        return;
      }

      await refreshSections(selectedSection.section_id);
      await loadCalendarData(selectedSection.section_id);
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Start day error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteDay = async () => {
    if (!selectedSection || !isViewingCurrentDay || !currentDayInProgress) return;

    setError('');
    setActionLoading(true);
    try {
      const { error: rpcError } = await supabase.rpc(
        'complete_current_planner_day',
        {
          p_section_id: selectedSection.section_id,
          p_actual_date: actualDate,
          p_actual_minutes: null,
          p_deviation_summary: deviationSummary.trim() || null,
          p_follow_up_needed: followUpNeeded,
          p_follow_up_notes: followUpNotes.trim() || null,
        }
      );

      if (rpcError) {
        setError(`Failed to complete day: ${rpcError.message}`);
        return;
      }

      setDeviationSummary('');
      setFollowUpNeeded(false);
      setFollowUpNotes('');
      await refreshSections(selectedSection.section_id);
      await loadCalendarData(selectedSection.section_id);
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Complete day error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    await guardedSignOut();
  };

  const plannerDayByDate = useMemo(() => {
    const map = new Map<string, PlannerDay>();
    plannerDays.forEach((day) => map.set(day.scheduled_date, day));
    return map;
  }, [plannerDays]);

  const plannerDayById = useMemo(() => {
    const map = new Map<string, PlannerDay>();
    plannerDays.forEach((day) => map.set(day.id, day));
    return map;
  }, [plannerDays]);

  const exceptionByDate = useMemo(() => {
    const map = new Map<string, CalendarException>();
    calendarExceptions.forEach((exception) =>
      map.set(exception.exception_date, exception)
    );
    return map;
  }, [calendarExceptions]);

  const deliveryByPlannerDay = useMemo(() => {
    const map = new Map<string, DayDelivery>();
    deliveries.forEach((delivery) => map.set(delivery.planner_day_id, delivery));
    return map;
  }, [deliveries]);

  const actualDeliveriesByDate = useMemo(() => {
    const map = new Map<string, DayDelivery[]>();
    deliveries.forEach((delivery) => {
      if (!delivery.actual_date) return;
      const existing = map.get(delivery.actual_date) ?? [];
      existing.push(delivery);
      map.set(delivery.actual_date, existing);
    });
    return map;
  }, [deliveries]);

  const calendarMonths = useMemo(() => {
    const allDates = [
      ...plannerDays.map((day) => day.scheduled_date),
      ...calendarExceptions.map((exception) => exception.exception_date),
    ].sort();

    if (allDates.length === 0) return [];

    const start = parseDate(allDates[0]);
    const end = parseDate(allDates[allDates.length - 1]);

    const months: Array<{ year: number; month: number }> = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

    while (cursor <= endMonth) {
      months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return months;
  }, [plannerDays, calendarExceptions]);

  const visibleMonth = calendarMonths[visibleMonthIndex] ?? null;

  useEffect(() => {
    if (calendarMonths.length === 0) {
      setVisibleMonthIndex(0);
      return;
    }

    const currentPlannerDay = plannerDays.find(
      (day) =>
        day.planner_day_number === selectedSection?.current_planner_day_number
    );

    const targetDate = currentPlannerDay?.scheduled_date
      ? parseDate(currentPlannerDay.scheduled_date)
      : selectedSection?.scheduled_date
      ? parseDate(selectedSection.scheduled_date)
      : null;

    const targetIndex = targetDate
      ? calendarMonths.findIndex(
          ({ year, month }) =>
            year === targetDate.getFullYear() && month === targetDate.getMonth()
        )
      : 0;

    setVisibleMonthIndex(targetIndex >= 0 ? targetIndex : 0);
  }, [
    selectedSection?.section_id,
    selectedSection?.current_planner_day_number,
    selectedSection?.scheduled_date,
    plannerDays,
    calendarMonths,
  ]);

  const nextNoClassDay = useMemo(() => {
    const today = getLocalDateString();
    return (
      [...calendarExceptions]
        .filter(
          (exception) =>
            !exception.counts_as_teaching_day && exception.exception_date >= today
        )
        .sort((a, b) => a.exception_date.localeCompare(b.exception_date))[0] ?? null
    );
  }, [calendarExceptions]);

  const getDayClass = (
    key: string,
    plannedDay?: PlannerDay,
    exception?: CalendarException
  ) => {
    if (exception && !exception.counts_as_teaching_day) return 'calendar-day no-class';

    if (plannedDay) {
      const delivery = deliveryByPlannerDay.get(plannedDay.id);
      if (delivery?.delivery_status === 'completed') return 'calendar-day completed';
      if (delivery?.delivery_status === 'in_progress' || delivery?.delivery_status === 'started') return 'calendar-day started';
      if (
        plannedDay.planner_day_number === selectedSection?.current_planner_day_number
      ) {
        return 'calendar-day current';
      }
      return 'calendar-day planned';
    }

    const actualDeliveries = actualDeliveriesByDate.get(key);
    if (actualDeliveries?.length) return 'calendar-day actual';

    return 'calendar-day';
  };

  const currentDayNumber = selectedSection?.current_planner_day_number ?? null;
  const viewedDayNumber = guideDay?.planner_day_number ?? null;
  const isViewingCurrentDay = Boolean(
    selectedSection?.guide_day_id && guideDay?.id === selectedSection.guide_day_id
  );

  const currentDelivery = selectedSection?.planner_day_id
    ? deliveryByPlannerDay.get(selectedSection.planner_day_id)
    : undefined;

  const currentDayInProgress = Boolean(
    currentDelivery?.started_at &&
      !currentDelivery.completed_at &&
      (currentDelivery.delivery_status === 'in_progress' ||
        currentDelivery.delivery_status === 'started')
  );

  const elapsedSeconds = currentDelivery?.started_at
    ? Math.max(
        0,
        Math.floor(
          ((currentDelivery.completed_at
            ? new Date(currentDelivery.completed_at).getTime()
            : timerNow) -
            new Date(currentDelivery.started_at).getTime()) /
            1000
        )
      )
    : 0;

  const guideInstructionalMinutes = guideSegments.reduce(
    (total, segment) => total + segment.planned_minutes,
    0
  );
  const plannedInstructionalMinutes =
    guideInstructionalMinutes + (mathLesson?.planned_minutes ?? 0);
  const selectedCourseLabel =
    selectedSection?.course_code || selectedSection?.course_name || 'Course';

  useEffect(() => {
    if (!currentDayInProgress) return;

    setTimerNow(Date.now());
    const timer = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [currentDayInProgress, currentDelivery?.started_at]);

  useEffect(() => {
    if (currentDayInProgress && currentDelivery?.actual_date) {
      setActualDate(currentDelivery.actual_date);
    }
  }, [currentDayInProgress, currentDelivery?.actual_date]);

  const viewedGuideIndex = guideDay
    ? guideDayRefs.findIndex((day) => day.id === guideDay.id)
    : -1;

  const viewGuideDayByNumber = (dayNumber: number) => {
    const target = guideDayRefs.find(
      (day) => day.planner_day_number === dayNumber
    );
    if (target) setViewedGuideDayId(target.id);
  };

  const viewPreviousGuideDay = () => {
    if (viewedGuideIndex > 0) {
      setViewedGuideDayId(guideDayRefs[viewedGuideIndex - 1].id);
    }
  };

  const viewNextGuideDay = () => {
    if (viewedGuideIndex >= 0 && viewedGuideIndex < guideDayRefs.length - 1) {
      setViewedGuideDayId(guideDayRefs[viewedGuideIndex + 1].id);
    }
  };

  const returnToCurrentGuideDay = () => {
    if (selectedSection?.guide_day_id) {
      setViewedGuideDayId(selectedSection.guide_day_id);
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Living Teacher Planner</h1>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {canOpenOwnerDashboard && (
              <button
                className="logout-button"
                onClick={() => router.push('/owner')}
              >
                Owner Dashboard
              </button>
            )}
            <button
              className="logout-button"
              onClick={() => router.push('/training')}
            >
              Training Mode
            </button>
            <button
              className="logout-button"
              onClick={() => router.push('/classroom')}
            >
              Live Classroom
            </button>
            {canOpenSchoolDashboard && (
              <button
                className="logout-button"
                onClick={() => router.push('/school')}
              >
                School Dashboard
              </button>
            )}
            <button className="logout-button" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        {error && <div className="error-message dashboard-error">{error}</div>}

        {sections.length === 0 ? (
          <div className="empty-state">
            <p>No teaching sections found.</p>
            <p className="empty-state-subtext">
              Check your Supabase RLS policies and permissions.
            </p>
          </div>
        ) : (
          <div className="dashboard-content">
            {selectedSection && (
              <div className="section-details">
                <div className="section-header">
                  <div>
                    <h2>
                      {selectedSection.course_code ||
                        selectedSection.course_name ||
                        selectedSection.section_name ||
                        'Course'}
                    </h2>
                    <p className="section-cohort-text">
                      {selectedSection.cohort_name ||
                        selectedSection.section_name ||
                        selectedSection.section_code ||
                        'Section'}
                    </p>
                  </div>
                </div>

                <div className="details-grid">
                  <div className="detail-item">
                    <label>Current Planner Day</label>
                    <div className="detail-value highlight">
                      {selectedSection.current_planner_day_number ?? 'Not started'}
                    </div>
                  </div>

                  <div className="detail-item">
                    <label>Scheduled Date</label>
                    <div className="detail-value">
                      {selectedSection.scheduled_date
                        ? parseDate(selectedSection.scheduled_date).toLocaleDateString(
                            'en-US',
                            { weekday: 'short', month: 'short', day: 'numeric' }
                          )
                        : 'Not scheduled'}
                    </div>
                  </div>

                  <div className="detail-item">
                    <label>Hold Status</label>
                    <div
                      className={`detail-value status-${
                        selectedSection.manual_hold ? 'hold' : 'active'
                      }`}
                    >
                      {selectedSection.manual_hold
                        ? selectedSection.hold_reason || 'On Hold'
                        : 'Active'}
                    </div>
                  </div>
                </div>

                <section className="teacher-guide-section">
                  <div className="guide-browser">
                    <button
                      type="button"
                      className="guide-browser-button"
                      onClick={viewPreviousGuideDay}
                      disabled={viewedGuideIndex <= 0 || guideLoading}
                    >
                      ‹ Previous Day
                    </button>

                    <div className="guide-browser-center">
                      <span className="guide-browser-status">
                        {isViewingCurrentDay
                          ? `Current Teaching Day: ${currentDayNumber ?? ''}`
                          : viewedDayNumber
                          ? `Previewing Day ${viewedDayNumber}`
                          : 'Teacher Guide'}
                      </span>
                      <label className="guide-day-select-label">
                        Go to Day
                        <select
                          value={viewedDayNumber ?? ''}
                          onChange={(event) =>
                            viewGuideDayByNumber(Number(event.target.value))
                          }
                          disabled={guideDayRefs.length === 0 || guideLoading}
                        >
                          {guideDayRefs.map((day) => (
                            <option key={day.id} value={day.planner_day_number}>
                              Day {day.planner_day_number}
                              {day.title ? ` — ${day.title}` : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <button
                      type="button"
                      className="guide-browser-button"
                      onClick={viewNextGuideDay}
                      disabled={
                        viewedGuideIndex < 0 ||
                        viewedGuideIndex >= guideDayRefs.length - 1 ||
                        guideLoading
                      }
                    >
                      Next Day ›
                    </button>

                    {!isViewingCurrentDay && guideDay && (
                      <button
                        type="button"
                        className="back-current-button"
                        onClick={returnToCurrentGuideDay}
                      >
                        Back to Current Day
                      </button>
                    )}
                  </div>

                  {!isViewingCurrentDay && guideDay && (
                    <div className="preview-banner">
                      <strong>Previewing Day {viewedDayNumber}.</strong>{' '}
                      Current class day is Day {currentDayNumber}. Viewing another day does
                      not change class progress.
                    </div>
                  )}

                  {guideLoading ? (
                    <div className="guide-loading">Loading teacher guide...</div>
                  ) : guideDay ? (
                    <>
                      <div className="guide-day-heading">
                        <div className="guide-day-title-block">
                          <div className="guide-eyebrow">
                            DAY {guideDay.planner_day_number}
                          </div>
                          <h3>
                            {guideDay.title || `Planner Day ${guideDay.planner_day_number}`}
                          </h3>
                        </div>

                        <div className="guide-format-badge">
                          {mathLesson
                            ? `${guideInstructionalMinutes} min ${selectedCourseLabel} + ${mathLesson.planned_minutes} min Welding Math`
                            : `${guideInstructionalMinutes} min ${selectedCourseLabel}`}
                        </div>
                      </div>

                      <div className="guide-summary-row">
                        <div className="guide-objective">
                          <span className="guide-label">Daily Objective</span>
                          <p>{guideDay.objective || 'No objective entered.'}</p>
                        </div>

                        <div className="guide-outcomes">
                          <span className="guide-label">Protected Outcomes</span>
                          <div className="outcome-chips">
                            {protectedOutcomes.length > 0 ? (
                              protectedOutcomes.map((outcome) => (
                                <div className="outcome-chip" key={outcome.id}>
                                  <strong>{outcome.outcome_code}</strong>
                                  <span>{outcome.outcome_text}</span>
                                </div>
                              ))
                            ) : (
                              <span className="guide-muted">No linked outcomes.</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="guide-body-grid">
                        <div className="guide-main-column">
                          <div className="agenda-card">
                            <div className="agenda-card-title">
                              <div>
                                <span className="guide-label">
                                  {mathLesson ? 'Section 1' : 'Agenda'}
                                </span>
                                <h4>{mathLesson ? `${selectedCourseLabel} Agenda` : 'Daily Agenda'}</h4>
                              </div>
                              <span className="agenda-duration">
                                {guideSegments.reduce(
                                  (sum, segment) => sum + segment.planned_minutes,
                                  0
                                )}{' '}
                                min
                              </span>
                            </div>

                            <div className="agenda-table-wrap">
                              <table className="agenda-table">
                                <thead>
                                  <tr>
                                    <th>Time</th>
                                    <th>Activity</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {guideSegments.map((segment) => (
                                    <tr key={segment.id}>
                                      <td>
                                        {minuteRange(
                                          segment.start_minute,
                                          segment.end_minute,
                                          segment.planned_minutes
                                        )}
                                      </td>
                                      <td>
                                        {segment.instructor_actions ||
                                          segment.segment_title ||
                                          'Activity'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {mathLesson && (
                            <div className="agenda-card">
                              <div className="agenda-card-title">
                                <div>
                                  <span className="guide-label">Section 2</span>
                                  <h4>
                                    Welding Math — Day {mathLesson.math_day_number}: {mathLesson.title}
                                  </h4>
                                </div>
                                <span className="agenda-duration">{mathLesson.planned_minutes} min</span>
                              </div>

                              {mathLesson.goal && (
                                <p className="math-goal">
                                  <strong>Goal:</strong> {mathLesson.goal}
                                </p>
                              )}

                              {mathLesson.book_connection && (
                                <p className="book-connection">
                                  <strong>Book connection:</strong> {mathLesson.book_connection}
                                </p>
                              )}

                              <div className="agenda-table-wrap">
                                <table className="agenda-table">
                                  <thead>
                                    <tr>
                                      <th>Time</th>
                                      <th>Activity</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {mathSegments.map((segment) => (
                                      <tr key={segment.id}>
                                        <td>
                                          {minuteRange(
                                            segment.start_minute,
                                            segment.end_minute,
                                            segment.planned_minutes
                                          )}
                                        </td>
                                        <td>{segment.activity}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {(mathLesson.instructor_notes ||
                                mathLesson.answers_quick_check) && (
                                <div className="math-instructor-only">
                                  <span className="guide-label">Instructor Only</span>
                                  {mathLesson.instructor_notes && (
                                    <p>
                                      <strong>Notes:</strong> {mathLesson.instructor_notes}
                                    </p>
                                  )}
                                  {mathLesson.answers_quick_check && (
                                    <p>
                                      <strong>Answers / quick check:</strong>{' '}
                                      {mathLesson.answers_quick_check}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <aside className="guide-side-column">
                          <div className="guide-info-card">
                            <span className="guide-label">Resources</span>
                            {guideDay.materials_equipment && (
                              <p>{guideDay.materials_equipment}</p>
                            )}

                            {guideResources.length > 0 && (
                              <div className="resource-list">
                                {guideResources.map((resource) => (
                                  <div className="resource-item" key={resource.id}>
                                    <strong>{resource.resource_title}</strong>
                                    {resource.resource_url ? (
                                      <a
                                        href={
                                          resource.resource_url.startsWith('/classroom')
                                            ? `${resource.resource_url}${resource.resource_url.includes('?') ? '&' : '?'}section=${encodeURIComponent(selectedSection?.section_id ?? '')}`
                                            : resource.resource_url
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                        className="resource-link"
                                      >
                                        Open Resource
                                      </a>
                                    ) : (
                                      <span className="resource-pending">
                                        Link not added
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="guide-info-card">
                            <span className="guide-label">Corresponding Application</span>
                            <p>
                              {guideDay.corresponding_application ||
                                'No corresponding application entered.'}
                            </p>
                          </div>

                          <div className="guide-info-card">
                            <span className="guide-label">
                              Evidence / Check for Understanding
                            </span>
                            <p>
                              {guideDay.evidence_check_for_understanding ||
                                'No evidence check entered.'}
                            </p>
                          </div>
                        </aside>
                      </div>

                      <div className="coaching-card">
                        <div className="coaching-heading">
                          <span className="guide-label">Instructor Coaching</span>
                        </div>
                        <div className="coaching-grid">
                          {guideDay.weekly_coaching_focus && (
                            <div>
                              <strong>Weekly Coaching Focus</strong>
                              <p>{guideDay.weekly_coaching_focus}</p>
                            </div>
                          )}
                          <div>
                            <strong>Coaching Focus</strong>
                            <p>{guideDay.coaching_focus || 'No coaching note entered.'}</p>
                          </div>
                          <div>
                            <strong>If Students Struggle</strong>
                            <p>
                              {guideDay.if_students_struggle ||
                                'No intervention note entered.'}
                            </p>
                          </div>
                          <div>
                            <strong>Keep Momentum</strong>
                            <p>{guideDay.keep_momentum || 'No momentum note entered.'}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="guide-loading">
                      No teacher-guide content is available for this planner day.
                    </div>
                  )}
                </section>

                <div className="actions-section">
                  {!isViewingCurrentDay && guideDay && (
                    <div className="preview-actions-lock">
                      Preview mode is read-only. Return to the current teaching day to start,
                      complete, or record instructional notes.
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="actual-date">Actual Date</label>
                    <input
                      id="actual-date"
                      type="date"
                      value={actualDate}
                      onChange={(event) => setActualDate(event.target.value)}
                      disabled={
                        actionLoading || !isViewingCurrentDay || currentDayInProgress
                      }
                    />
                  </div>

                  {currentDayInProgress && currentDelivery?.started_at ? (
                    <div className="class-timer-panel" role="status" aria-live="polite">
                      <div className="class-timer-label">Class in progress</div>
                      <div className="class-timer-value">
                        {formatElapsedTime(elapsedSeconds)}
                      </div>
                      <div className="class-timer-meta">
                        <span>Started {formatClockTime(currentDelivery.started_at)}</span>
                        <span>Planned: {plannedInstructionalMinutes || 60} min</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="action-button start-button"
                      onClick={handleStartToday}
                      disabled={actionLoading || !actualDate || !isViewingCurrentDay}
                    >
                      {actionLoading ? 'Processing...' : 'Start Today'}
                    </button>
                  )}

                  <div className="form-group">
                    <label htmlFor="deviation-summary">Daily Comments / Deviation Summary</label>
                    <textarea
                      id="deviation-summary"
                      value={deviationSummary}
                      onChange={(event) => setDeviationSummary(event.target.value)}
                      placeholder="Record daily comments, pacing, or implementation differences"
                      disabled={actionLoading || !isViewingCurrentDay}
                    />
                  </div>

                  <label className="follow-up-check">
                    <input
                      type="checkbox"
                      checked={followUpNeeded}
                      onChange={(event) => setFollowUpNeeded(event.target.checked)}
                      disabled={actionLoading || !isViewingCurrentDay}
                    />{' '}
                    Follow-up needed
                  </label>

                  {followUpNeeded && (
                    <div className="form-group">
                      <label htmlFor="follow-up-notes">Follow-up Notes</label>
                      <textarea
                        id="follow-up-notes"
                        value={followUpNotes}
                        onChange={(event) => setFollowUpNotes(event.target.value)}
                        placeholder="Describe the follow-up needed"
                        disabled={actionLoading || !isViewingCurrentDay}
                      />
                    </div>
                  )}

                  <button
                    className="action-button complete-button"
                    onClick={handleCompleteDay}
                    disabled={
                      actionLoading ||
                      !actualDate ||
                      !isViewingCurrentDay ||
                      !currentDayInProgress
                    }
                  >
                    {actionLoading ? 'Processing...' : 'Complete Day'}
                  </button>
                </div>


                <section className="class-calendar-section">
                  <div className="calendar-title-row">
                    <div>
                      <h3>Class Calendar</h3>
                      <p>Class schedule and no-class reminders.</p>
                    </div>

                    {visibleMonth && (
                      <div className="calendar-month-controls">
                        <button
                          type="button"
                          className="calendar-nav-button"
                          onClick={() =>
                            setVisibleMonthIndex((index) => Math.max(0, index - 1))
                          }
                          disabled={visibleMonthIndex === 0}
                          aria-label="Previous month"
                        >
                          ‹ Previous
                        </button>

                        <strong>
                          {monthLabel(visibleMonth.year, visibleMonth.month)}
                        </strong>

                        <button
                          type="button"
                          className="calendar-nav-button"
                          onClick={() =>
                            setVisibleMonthIndex((index) =>
                              Math.min(calendarMonths.length - 1, index + 1)
                            )
                          }
                          disabled={visibleMonthIndex >= calendarMonths.length - 1}
                          aria-label="Next month"
                        >
                          Next ›
                        </button>
                      </div>
                    )}
                  </div>

                  {nextNoClassDay && (
                    <div className="calendar-reminder">
                      <strong>Upcoming no welding class:</strong>{' '}
                      {parseDate(nextNoClassDay.exception_date).toLocaleDateString(
                        'en-US',
                        { weekday: 'long', month: 'long', day: 'numeric' }
                      )}
                      {' — '}
                      {nextNoClassDay.reason || nextNoClassDay.exception_type}
                    </div>
                  )}

                  <div className="calendar-legend">
                    <span><i className="legend-dot current-dot" />Current</span>
                    <span><i className="legend-dot completed-dot" />Completed</span>
                    <span><i className="legend-dot planned-dot" />Planned</span>
                    <span><i className="legend-dot no-class-dot" />No welding</span>
                    <span><i className="legend-dot actual-dot" />Actual/rescheduled</span>
                  </div>

                  {calendarLoading ? (
                    <p className="calendar-loading">Loading class calendar...</p>
                  ) : visibleMonth ? (
                    <div className="calendar-month single-month">
                      <div className="calendar-weekdays">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                          (weekday) => (
                            <div key={weekday}>{weekday}</div>
                          )
                        )}
                      </div>

                      <div className="calendar-grid">
                        {(() => {
                          const { year, month } = visibleMonth;
                          const firstDay = new Date(year, month, 1).getDay();
                          const daysInMonth = new Date(year, month + 1, 0).getDate();
                          const cells: Array<number | null> = [];

                          for (let i = 0; i < firstDay; i += 1) cells.push(null);
                          for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

                          return cells.map((day, index) => {
                            if (day === null) {
                              return (
                                <div
                                  className="calendar-day blank"
                                  key={`blank-${index}`}
                                />
                              );
                            }

                            const key = dateKey(new Date(year, month, day));
                            const plannedDay = plannerDayByDate.get(key);
                            const exception = exceptionByDate.get(key);
                            const delivery = plannedDay
                              ? deliveryByPlannerDay.get(plannedDay.id)
                              : undefined;

                            const actualDeliveries =
                              actualDeliveriesByDate.get(key) ?? [];
                            const rescheduledDeliveries = actualDeliveries.filter(
                              (item) => {
                                const planned = plannerDayById.get(
                                  item.planner_day_id
                                );
                                return planned?.scheduled_date !== key;
                              }
                            );

                            return (
                              <div
                                className={getDayClass(key, plannedDay, exception)}
                                key={key}
                              >
                                <div className="calendar-date-number">{day}</div>

                                {exception &&
                                  !exception.counts_as_teaching_day && (
                                    <>
                                      <div className="calendar-event strong">
                                        NO WELDING
                                      </div>
                                      <div className="calendar-event">
                                        {exception.reason ||
                                          exception.exception_type}
                                      </div>
                                    </>
                                  )}

                                {plannedDay && (
                                  <>
                                    <div className="calendar-event strong">
                                      Day {plannedDay.planner_day_number}
                                    </div>
                                    <div className="calendar-event">
                                      {delivery?.delivery_status === 'completed'
                                        ? 'Completed'
                                        : delivery?.delivery_status === 'in_progress' ||
                                          delivery?.delivery_status === 'started'
                                        ? 'In progress'
                                        : plannedDay.planner_day_number ===
                                          selectedSection.current_planner_day_number
                                        ? 'Current'
                                        : 'Planned'}
                                    </div>
                                    {delivery?.actual_date &&
                                      delivery.actual_date !==
                                        plannedDay.scheduled_date && (
                                        <div className="calendar-event actual-note">
                                          {delivery.delivery_status === 'completed'
                                            ? 'Taught'
                                            : 'Started'}{' '}
                                          {parseDate(
                                            delivery.actual_date
                                          ).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                          })}
                                        </div>
                                      )}
                                  </>
                                )}

                                {rescheduledDeliveries.map((item) => {
                                  const planned = plannerDayById.get(
                                    item.planner_day_id
                                  );
                                  return planned ? (
                                    <div
                                      className="calendar-event actual-note"
                                      key={`${key}-${item.planner_day_id}`}
                                    >
                                      Actual Day {planned.planner_day_number}
                                    </div>
                                  ) : null;
                                })}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  ) : (
                    <p className="calendar-loading">No calendar dates available.</p>
                  )}
                </section>

              </div>
            )}
          </div>
        )}
      </main>

      <style jsx>{`
        .teacher-guide-section {
          margin-top: 8px;
          margin-bottom: 20px;
          border: 1px solid #2a2a2a;
          border-radius: 10px;
          overflow: hidden;
          background: #101010;
        }

        .guide-browser {
          display: grid;
          grid-template-columns: auto minmax(260px, 1fr) auto auto;
          gap: 10px;
          align-items: center;
          padding: 12px 14px;
          border-bottom: 1px solid #2a2a2a;
          background: #0b0b0b;
        }

        .guide-browser-center {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          min-width: 0;
        }

        .guide-browser-status {
          color: #dedede;
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
        }

        .guide-day-select-label {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #8f8f8f;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .guide-day-select-label select {
          max-width: 320px;
          padding: 7px 9px;
          border: 1px solid #343434;
          border-radius: 6px;
          background: #111111;
          color: #e5e5e5;
          font: inherit;
          text-transform: none;
          letter-spacing: normal;
        }

        .guide-browser-button,
        .back-current-button {
          min-height: 36px;
          padding: 7px 11px;
          border: 1px solid #343434;
          border-radius: 6px;
          background: #111111;
          color: #d8d8d8;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
        }

        .guide-browser-button:hover:not(:disabled),
        .back-current-button:hover:not(:disabled) {
          border-color: #00ff88;
          color: #00ff88;
        }

        .guide-browser-button:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .back-current-button {
          border-color: rgba(0, 255, 136, 0.45);
          color: #00ff88;
        }

        .preview-banner,
        .preview-actions-lock {
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255, 187, 71, 0.28);
          background: rgba(255, 187, 71, 0.08);
          color: #e7c27c;
          font-size: 12px;
          line-height: 1.45;
        }

        .preview-actions-lock {
          grid-column: 1 / -1;
          margin-bottom: 4px;
          border: 1px solid rgba(255, 187, 71, 0.28);
          border-radius: 6px;
        }

        .guide-loading {
          padding: 24px;
          color: #9a9a9a;
          font-size: 14px;
        }

        .guide-day-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 18px 20px;
          border-bottom: 1px solid #2a2a2a;
          background: #151515;
        }

        .guide-day-title-block {
          min-width: 0;
        }

        .guide-eyebrow,
        .guide-label {
          display: block;
          color: #8f8f8f;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .guide-day-title-block h3 {
          margin: 4px 0 0;
          color: #ffffff;
          font-size: 22px;
          line-height: 1.25;
        }

        .guide-format-badge {
          flex: 0 0 auto;
          padding: 8px 12px;
          border: 1px solid #363636;
          border-radius: 6px;
          background: #0c0c0c;
          color: #d7d7d7;
          font-size: 12px;
          font-weight: 600;
        }

        .guide-summary-row {
          display: grid;
          grid-template-columns: minmax(0, 1.6fr) minmax(260px, 1fr);
          gap: 0;
          border-bottom: 1px solid #2a2a2a;
        }

        .guide-objective,
        .guide-outcomes {
          padding: 18px 20px;
        }

        .guide-objective {
          border-right: 1px solid #2a2a2a;
        }

        .guide-objective p,
        .guide-info-card p,
        .coaching-grid p,
        .math-goal,
        .book-connection,
        .math-instructor-only p {
          margin: 8px 0 0;
          color: #d2d2d2;
          line-height: 1.5;
          font-size: 14px;
        }

        .outcome-chips {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 9px;
        }

        .outcome-chip {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 9px;
          align-items: start;
          padding: 8px 10px;
          border: 1px solid #343434;
          border-radius: 6px;
          background: #0d0d0d;
          color: #cfcfcf;
          font-size: 12px;
          line-height: 1.35;
        }

        .outcome-chip strong {
          color: #dfff78;
          white-space: nowrap;
        }

        .guide-muted {
          color: #777777;
          font-size: 12px;
        }

        .guide-body-grid {
          display: grid;
          grid-template-columns: minmax(0, 2.2fr) minmax(270px, 0.8fr);
          gap: 14px;
          padding: 14px;
        }

        .guide-main-column,
        .guide-side-column {
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-width: 0;
        }

        .agenda-card,
        .guide-info-card,
        .coaching-card {
          border: 1px solid #2c2c2c;
          border-radius: 8px;
          background: #121212;
          overflow: hidden;
        }

        .agenda-card-title {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          padding: 12px 14px;
          border-bottom: 1px solid #2c2c2c;
          background: #161616;
        }

        .agenda-card-title h4 {
          margin: 3px 0 0;
          color: #f4f4f4;
          font-size: 15px;
          font-weight: 650;
        }

        .agenda-duration {
          flex: 0 0 auto;
          color: #9adf4b;
          font-size: 12px;
          font-weight: 700;
        }

        .math-goal,
        .book-connection {
          padding: 0 14px;
        }

        .book-connection {
          color: #9f9f9f;
          font-size: 12px;
        }

        .agenda-table-wrap {
          overflow-x: auto;
        }

        .agenda-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .agenda-table th,
        .agenda-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #292929;
          text-align: left;
          vertical-align: top;
        }

        .agenda-table th {
          color: #8d8d8d;
          background: #101010;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .agenda-table th:first-child,
        .agenda-table td:first-child {
          width: 110px;
          color: #e7e7e7;
          white-space: nowrap;
        }

        .agenda-table td {
          color: #d0d0d0;
          font-size: 13px;
          line-height: 1.45;
        }

        .agenda-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .math-instructor-only {
          margin: 12px 14px 14px;
          padding: 12px;
          border: 1px solid rgba(154, 223, 75, 0.28);
          border-radius: 6px;
          background: rgba(154, 223, 75, 0.055);
        }

        .math-instructor-only p {
          font-size: 12px;
        }

        .guide-info-card {
          padding: 14px;
        }

        .resource-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 14px;
        }

        .resource-item {
          display: flex;
          flex-direction: column;
          gap: 7px;
          padding-top: 10px;
          border-top: 1px solid #292929;
        }

        .resource-item strong {
          color: #efefef;
          font-size: 13px;
        }

        .resource-link {
          align-self: flex-start;
          padding: 7px 10px;
          border: 1px solid #9adf4b;
          border-radius: 6px;
          color: #caff77;
          text-decoration: none;
          font-size: 12px;
          font-weight: 700;
          background: rgba(154, 223, 75, 0.07);
        }

        .resource-link:hover {
          background: rgba(154, 223, 75, 0.14);
        }

        .resource-pending {
          color: #777777;
          font-size: 11px;
        }

        .coaching-card {
          margin: 0 14px 14px;
        }

        .coaching-heading {
          padding: 11px 14px;
          border-bottom: 1px solid #2c2c2c;
          background: #161616;
        }

        .coaching-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .coaching-grid > div {
          min-height: 120px;
          padding: 14px;
          border-right: 1px solid #2c2c2c;
        }

        .coaching-grid > div:last-child {
          border-right: 0;
        }

        .coaching-grid strong {
          color: #e7e7e7;
          font-size: 12px;
        }

        .coaching-grid p {
          font-size: 12px;
        }

        .class-calendar-section {
          margin-top: 8px;
          padding: 20px;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          background: #111111;
        }

        .calendar-title-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 14px;
        }

        .calendar-title-row h3 {
          margin: 0 0 4px;
          font-size: 20px;
          color: #ffffff;
        }

        .calendar-title-row p,
        .calendar-loading {
          margin: 0;
          color: #909090;
          font-size: 13px;
        }

        .calendar-month-controls {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .calendar-month-controls strong {
          min-width: 140px;
          text-align: center;
          color: #ffffff;
          font-size: 14px;
        }

        .calendar-nav-button {
          padding: 7px 10px;
          border: 1px solid #3a3a3a;
          border-radius: 6px;
          background: #0a0a0a;
          color: #e0e0e0;
          cursor: pointer;
          font-size: 12px;
        }

        .calendar-nav-button:hover:not(:disabled) {
          border-color: #00ff88;
          color: #00ff88;
        }

        .calendar-nav-button:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .calendar-reminder {
          padding: 12px 14px;
          margin-bottom: 14px;
          border: 1px solid rgba(255, 140, 66, 0.45);
          border-radius: 6px;
          background: rgba(255, 140, 66, 0.08);
          color: #ffb27c;
          font-size: 14px;
        }

        .calendar-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 10px 18px;
          margin-bottom: 18px;
          color: #b0b0b0;
          font-size: 12px;
        }

        .calendar-legend span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .legend-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          display: inline-block;
        }

        .current-dot {
          background: #00ff88;
        }

        .completed-dot {
          background: #00b4ff;
        }

        .planned-dot {
          background: #777777;
        }

        .no-class-dot {
          background: #ff8c42;
        }

        .actual-dot {
          background: #d788ff;
        }

        .single-month {
          max-width: 820px;
          margin: 0 auto;
        }

        .calendar-month {
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          overflow: hidden;
          background: #111111;
        }

        .calendar-month h4 {
          margin: 0;
          padding: 12px 14px;
          background: #161616;
          color: #ffffff;
          font-size: 15px;
          border-bottom: 1px solid #2a2a2a;
        }

        .calendar-weekdays,
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
        }

        .calendar-weekdays div {
          padding: 8px 4px;
          text-align: center;
          color: #777777;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          border-bottom: 1px solid #242424;
        }

        .calendar-day {
          min-height: 76px;
          padding: 7px;
          border-right: 1px solid #242424;
          border-bottom: 1px solid #242424;
          background: #111111;
          overflow: hidden;
        }

        .calendar-day.blank {
          background: #0d0d0d;
        }

        .calendar-day.planned {
          background: rgba(255, 255, 255, 0.018);
        }

        .calendar-day.current {
          background: rgba(0, 255, 136, 0.11);
          box-shadow: inset 0 0 0 1px rgba(0, 255, 136, 0.45);
        }

        .calendar-day.completed {
          background: rgba(0, 180, 255, 0.1);
        }

        .calendar-day.started {
          background: rgba(0, 255, 136, 0.06);
        }

        .calendar-day.no-class {
          background: rgba(255, 140, 66, 0.11);
          box-shadow: inset 0 0 0 1px rgba(255, 140, 66, 0.32);
        }

        .calendar-day.actual {
          background: rgba(215, 136, 255, 0.08);
        }

        .calendar-date-number {
          color: #8a8a8a;
          font-size: 11px;
          margin-bottom: 7px;
        }

        .calendar-event {
          font-size: 10px;
          line-height: 1.25;
          color: #b0b0b0;
          margin-top: 3px;
          overflow-wrap: anywhere;
        }

        .calendar-event.strong {
          color: #ffffff;
          font-weight: 700;
        }

        .no-class .calendar-event.strong {
          color: #ff9b59;
        }

        .actual-note {
          color: #dca7ff;
        }

        .class-timer-panel {
          padding: 18px;
          border: 1px solid rgba(0, 255, 136, 0.5);
          border-radius: 8px;
          background: rgba(0, 255, 136, 0.06);
          text-align: center;
        }

        .class-timer-label {
          color: #00ff88;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .class-timer-value {
          margin: 6px 0 8px;
          color: #ffffff;
          font-size: clamp(34px, 6vw, 54px);
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.04em;
          line-height: 1;
        }

        .class-timer-meta {
          display: flex;
          justify-content: center;
          gap: 10px 20px;
          flex-wrap: wrap;
          color: #a8a8a8;
          font-size: 12px;
        }

        .actions-section :global(textarea) {
          width: 100%;
          min-height: 82px;
          resize: vertical;
          padding: 12px 16px;
          background-color: #0a0a0a;
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          color: #e0e0e0;
          font: inherit;
        }

        .actions-section :global(textarea:focus) {
          outline: none;
          border-color: #00ff88;
          box-shadow: 0 0 0 3px rgba(0, 255, 136, 0.1);
        }

        .follow-up-check {
          display: flex;
          align-items: center;
          gap: 6px;
          min-height: 44px;
          color: #e0e0e0;
          font-size: 14px;
        }

        @media (max-width: 900px) {
          .guide-browser {
            grid-template-columns: 1fr 1fr;
          }

          .guide-browser-center {
            grid-column: 1 / -1;
            grid-row: 1;
            justify-content: space-between;
          }

          .back-current-button {
            grid-column: 1 / -1;
          }

          .guide-body-grid,
          .guide-summary-row {
            grid-template-columns: 1fr;
          }

          .guide-objective {
            border-right: 0;
            border-bottom: 1px solid #2a2a2a;
          }

          .coaching-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .coaching-grid > div:nth-child(2) {
            border-right: 0;
          }

          .coaching-grid > div:nth-child(-n + 2) {
            border-bottom: 1px solid #2c2c2c;
          }

          .calendar-day {
            min-height: 78px;
            padding: 5px;
          }

          .calendar-event {
            font-size: 9px;
          }
        }

        @media (max-width: 700px) {
          .guide-browser {
            grid-template-columns: 1fr 1fr;
          }

          .guide-browser-center {
            flex-direction: column;
            align-items: stretch;
          }

          .guide-browser-status {
            white-space: normal;
            text-align: center;
          }

          .guide-day-select-label {
            justify-content: center;
          }

          .guide-day-select-label select {
            width: 100%;
            max-width: none;
          }

          .guide-day-heading {
            flex-direction: column;
            align-items: flex-start;
          }

          .guide-format-badge {
            width: 100%;
          }

          .coaching-grid {
            grid-template-columns: 1fr;
          }

          .coaching-grid > div {
            border-right: 0;
            border-bottom: 1px solid #2c2c2c;
          }

          .coaching-grid > div:last-child {
            border-bottom: 0;
          }

          .calendar-title-row {
            flex-direction: column;
          }

          .calendar-month-controls {
            width: 100%;
            justify-content: space-between;
          }

          .calendar-month-controls strong {
            min-width: 0;
          }
        }

        @media (max-width: 600px) {
          .calendar-weekdays div {
            font-size: 9px;
          }

          .calendar-day {
            min-height: 64px;
            padding: 4px;
          }

          .calendar-date-number {
            margin-bottom: 4px;
          }

          .calendar-event {
            font-size: 8px;
          }

          .calendar-reminder {
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
}
