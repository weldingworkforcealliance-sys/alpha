'use client';

import { useEffect, useState } from 'react';
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

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [sections, setSections] = useState<TeachingSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<TeachingSection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
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
    if (!Number.isInteger(minutes) || minutes < 0) {
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
          p_deviation_summary: deviationSummary.trim(),
          p_follow_up_needed: followUpNeeded,
          p_follow_up_notes: followUpNotes.trim(),
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
                      {section.course_code || section.course_name || section.section_name || 'Course'}
                    </div>
                    <div className="section-cohort">
                      {section.cohort_name || section.section_name || section.section_code || 'Section'}
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
                        ? new Date(`${selectedSection.scheduled_date}T12:00:00`).toLocaleDateString(
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

                <div className="rule-notice">
                  <strong>Rule #1:</strong> Approved curriculum and course outcomes are
                  protected and may never be edited through this frontend.
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
                      min="0"
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

                  <label>
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
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
