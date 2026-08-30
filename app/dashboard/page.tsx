'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

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

  const [actualDate, setActualDate] = useState(getLocalDateString);
  const [actualMinutes, setActualMinutes] = useState('');
  const [deviationSummary, setDeviationSummary] = useState('');
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [followUpNotes, setFollowUpNotes] = useState('');

  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  );

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

    const selected = sectionId
      ? typedSections.find((section) => section.section_id === sectionId)
      : typedSections[0];

    setSelectedSection(selected ?? typedSections[0]);
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

  useEffect(() => {
    const loadSections = async () => {
      try {
        const { data: authData } = await supabase.auth.getSession();
        if (!authData.session) {
          router.push('/login');
          return;
        }

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
    if (selectedSection?.section_id) {
      loadCalendarData(selectedSection.section_id);
    }
  }, [selectedSection?.section_id]);

  const handleStartToday = async () => {
    if (!selectedSection) return;

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
    if (!selectedSection) return;

    const minutes = Number(actualMinutes);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      setError('Enter the actual instructional minutes before completing the day.');
      return;
    }

    setError('');
    setActionLoading(true);
    try {
      const { error: rpcError } = await supabase.rpc(
        'complete_current_planner_day',
        {
          p_section_id: selectedSection.section_id,
          p_actual_date: actualDate,
          p_actual_minutes: minutes,
          p_deviation_summary: deviationSummary.trim() || null,
          p_follow_up_needed: followUpNeeded,
          p_follow_up_notes: followUpNotes.trim() || null,
        }
      );

      if (rpcError) {
        setError(`Failed to complete day: ${rpcError.message}`);
        return;
      }

      setActualMinutes('');
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
    await supabase.auth.signOut();
    router.push('/login');
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
      if (delivery?.delivery_status === 'started') return 'calendar-day started';
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
          <button className="logout-button" onClick={handleLogout}>
            Sign Out
          </button>
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
            <div className="sections-navigation">
              <h2>Your Sections</h2>
              <div className="sections-list">
                {sections.map((section) => (
                  <button
                    key={section.section_id}
                    className={`section-button ${
                      selectedSection?.section_id === section.section_id ? 'active' : ''
                    }`}
                    onClick={() => setSelectedSection(section)}
                  >
                    <div className="section-name">
                      {section.course_code ||
                        section.course_name ||
                        section.section_name ||
                        'Course'}
                    </div>
                    <div className="section-cohort">
                      {section.cohort_name ||
                        section.section_name ||
                        section.section_code ||
                        'Section'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

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
                    {selectedSection.planner_day_title && (
                      <p>{selectedSection.planner_day_title}</p>
                    )}
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

                <div className="actions-section">
                  <div className="form-group">
                    <label htmlFor="actual-date">Actual Date</label>
                    <input
                      id="actual-date"
                      type="date"
                      value={actualDate}
                      onChange={(event) => setActualDate(event.target.value)}
                      disabled={actionLoading}
                    />
                  </div>

                  <button
                    className="action-button start-button"
                    onClick={handleStartToday}
                    disabled={actionLoading || !actualDate}
                  >
                    {actionLoading ? 'Processing...' : 'Start Today'}
                  </button>

                  <div className="form-group">
                    <label htmlFor="actual-minutes">Actual Instructional Minutes</label>
                    <input
                      id="actual-minutes"
                      type="number"
                      min="1"
                      step="1"
                      value={actualMinutes}
                      onChange={(event) => setActualMinutes(event.target.value)}
                      placeholder="Enter minutes"
                      disabled={actionLoading}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="deviation-summary">Deviation Summary</label>
                    <textarea
                      id="deviation-summary"
                      value={deviationSummary}
                      onChange={(event) => setDeviationSummary(event.target.value)}
                      placeholder="Optional: note pacing or implementation differences"
                      disabled={actionLoading}
                    />
                  </div>

                  <label className="follow-up-check">
                    <input
                      type="checkbox"
                      checked={followUpNeeded}
                      onChange={(event) => setFollowUpNeeded(event.target.checked)}
                      disabled={actionLoading}
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
                        disabled={actionLoading}
                      />
                    </div>
                  )}

                  <button
                    className="action-button complete-button"
                    onClick={handleCompleteDay}
                    disabled={actionLoading || !actualDate || actualMinutes === ''}
                  >
                    {actionLoading ? 'Processing...' : 'Complete Day'}
                  </button>
                </div>


                <section className="class-calendar-section">
                  <div className="calendar-title-row">
                    <div>
                      <h3>Class Calendar</h3>
                      <p>PVHS schedule and no-class reminders.</p>
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
                                        : delivery?.delivery_status === 'started'
                                        ? 'Started'
                                        : plannedDay.planner_day_number ===
                                          selectedSection.current_planner_day_number
                                        ? 'Current'
                                        : 'Planned'}
                                    </div>
                                    {delivery?.actual_date &&
                                      delivery.actual_date !==
                                        plannedDay.scheduled_date && (
                                        <div className="calendar-event actual-note">
                                          Taught{' '}
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
          .calendar-day {
            min-height: 78px;
            padding: 5px;
          }

          .calendar-event {
            font-size: 9px;
          }
        }

        @media (max-width: 700px) {
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
