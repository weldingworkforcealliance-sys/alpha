'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

interface TeachingSection {
  id: string;
  course: string;
  cohort: string;
  current_planner_day: number;
  scheduled_date: string;
  hold_status: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [sections, setSections] = useState<TeachingSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<TeachingSection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  );

  useEffect(() => {
    const loadSections = async () => {
      try {
        const { data: authData } = await supabase.auth.getSession();
        if (!authData.session) {
          router.push('/login');
          return;
        }

        const { data, error: queryError } = await supabase
          .from('current_teaching_sections')
          .select('*');

        if (queryError) {
          setError(`Failed to load sections: ${queryError.message}`);
          console.error('Query error:', queryError);
          return;
        }

        if (data) {
          setSections(data as TeachingSection[]);
          if (data.length > 0) {
            setSelectedSection(data[0] as TeachingSection);
          }
        }
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

    setActionLoading(true);
    try {
      const { error: rpcError } = await supabase.rpc(
        'start_current_planner_day',
        { p_section_id: selectedSection.id }
      );

      if (rpcError) {
        setError(`Failed to start day: ${rpcError.message}`);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('current_teaching_sections')
        .select('*');

      if (!queryError && data) {
        setSections(data as TeachingSection[]);
        const updated = data.find(
          (s) => s.id === selectedSection.id
        ) as TeachingSection | undefined;
        if (updated) setSelectedSection(updated);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Start day error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteDay = async () => {
    if (!selectedSection) return;

    setActionLoading(true);
    try {
      const { error: rpcError } = await supabase.rpc(
        'complete_current_planner_day',
        { p_section_id: selectedSection.id }
      );

      if (rpcError) {
        setError(`Failed to complete day: ${rpcError.message}`);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('current_teaching_sections')
        .select('*');

      if (!queryError && data) {
        setSections(data as TeachingSection[]);
        const updated = data.find(
          (s) => s.id === selectedSection.id
        ) as TeachingSection | undefined;
        if (updated) setSelectedSection(updated);
      }
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
                    key={section.id}
                    className={`section-button ${
                      selectedSection?.id === section.id ? 'active' : ''
                    }`}
                    onClick={() => setSelectedSection(section)}
                  >
                    <div className="section-name">{section.course}</div>
                    <div className="section-cohort">{section.cohort}</div>
                  </button>
                ))}
              </div>
            </div>

            {selectedSection && (
              <div className="section-details">
                <div className="section-header">
                  <div>
                    <h2>{selectedSection.course}</h2>
                    <p className="section-cohort-text">{selectedSection.cohort}</p>
                  </div>
                </div>

                <div className="details-grid">
                  <div className="detail-item">
                    <label>Current Planner Day</label>
                    <div className="detail-value highlight">
                      {selectedSection.current_planner_day}
                    </div>
                  </div>

                  <div className="detail-item">
                    <label>Scheduled Date</label>
                    <div className="detail-value">
                      {new Date(selectedSection.scheduled_date).toLocaleDateString(
                        'en-US',
                        { weekday: 'short', month: 'short', day: 'numeric' }
                      )}
                    </div>
                  </div>

                  <div className="detail-item">
                    <label>Hold Status</label>
                    <div
                      className={`detail-value status-${
                        selectedSection.hold_status?.toLowerCase() || 'none'
                      }`}
                    >
                      {selectedSection.hold_status || 'Active'}
                    </div>
                  </div>
                </div>

                <div className="rule-notice">
                  <strong>Rule #1:</strong> Approved curriculum and course outcomes are
                  protected and may never be edited through this frontend.
                </div>

                <div className="actions-section">
                  <button
                    className="action-button start-button"
                    onClick={handleStartToday}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Processing...' : 'Start Today'}
                  </button>
                  <button
                    className="action-button complete-button"
                    onClick={handleCompleteDay}
                    disabled={actionLoading}
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
