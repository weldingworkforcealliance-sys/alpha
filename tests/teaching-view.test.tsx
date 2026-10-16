// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TeachingView, { type TeachingViewProps } from '@/app/dashboard/teaching-view';

function props(): TeachingViewProps {
  return {
    section: { school_id:'school', section_id:'class-a', section_name:'Class A', section_code:null, course_code:'WLD 110', course_name:'Welding', cohort_name:null, current_planner_day_number:4, planner_day_id:'p4', scheduled_date:'2026-10-15', guide_day_id:'g4', planner_day_title:'Safe setup', manual_hold:false, hold_reason:null, completed_at:null },
    guide: { id:'g4', guide_id:'guide', planner_day_number:4, title:'Safe setup', objective:'Set up safely', materials_equipment:null, corresponding_application:null, evidence_check_for_understanding:null, weekly_coaching_focus:null, coaching_focus:null, if_students_struggle:null, keep_momentum:null },
    days:[{id:'g3',planner_day_number:3,title:'Earlier lesson'}, {id:'g4',planner_day_number:4,title:'Safe setup'}],
    segments:[], resources:[], outcomes:[], mathLesson:null, mathSegments:[], loading:false, busy:false, current:true, inProgress:false, completed:false, elapsed:'00:00:00', actualDate:'2026-10-15', attendanceDate:'2026-10-15', error:'', summary:'', followUp:false, followUpNotes:'',
    onDay:vi.fn(), onCurrentDay:vi.fn(), onStart:vi.fn(), onComplete:vi.fn(), onDate:vi.fn(), onSummary:vi.fn(), onFollowUp:vi.fn(), onFollowUpNotes:vi.fn(), onDetailed:vi.fn(), attendance:null,
  };
}
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
describe('live Teaching View', () => {
  it('explains future starts beside the disabled control instead of saying Ready to teach', () => {
    const p = props(); p.section.scheduled_date = '2099-11-09';
    render(<TeachingView {...p} />);
    expect(screen.queryByText('Ready to teach')).toBeNull();
    expect(screen.getByText(/Start Today becomes available on that date/)).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Start Today' });
    expect(button).toHaveProperty('disabled', true);
    expect(button.getAttribute('aria-describedby')).toBe('start-availability');
    fireEvent.click(button); expect(p.onStart).not.toHaveBeenCalled();
  });
  it('starts an available day and reports a hold without blocking lesson access', () => {
    const p = props(); p.section.scheduled_date = '2020-01-01';
    const view = render(<TeachingView {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Today' }));
    expect(p.onStart).toHaveBeenCalledOnce();
    view.rerender(<TeachingView {...p} section={{...p.section, manual_hold:true, hold_reason:'Waiting for class approval'}} />);
    expect(screen.getByText('Class on hold')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start Today' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', {name:'Open Full Detailed Planner →'}));
    expect(p.onDetailed).toHaveBeenCalledOnce();
  });
  it('locks preview writes while preserving lesson navigation', () => {
    const p = {...props(), current:false, inProgress:true};
    render(<TeachingView {...p} />);
    fireEvent.click(screen.getByRole('button', {name:'Start Today'}));
    fireEvent.click(screen.getByRole('button', {name:'Complete Day'}));
    expect(p.onStart).not.toHaveBeenCalled(); expect(p.onComplete).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Actual Date') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Daily Comments / Deviation Summary') as HTMLTextAreaElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', {name:'Previous teaching day'}));
    expect(p.onDay).toHaveBeenCalledWith(3);
  });
  it.each([{loading:true}, {busy:true}, {completed:true}, {inProgress:true}, {section:{...props().section,manual_hold:true}}])('does not restart a blocked or active class (%j)', patch => {
    const p = {...props(), ...patch}; render(<TeachingView {...p} />);
    fireEvent.click(screen.getByRole('button', {name:'Start Today'})); expect(p.onStart).not.toHaveBeenCalled();
  });
  it('requires the current attendance context before offering completion', () => {
    const p = {...props(), inProgress:true, attendanceDate:null}; render(<TeachingView {...p} />);
    fireEvent.click(screen.getByRole('button', {name:'Complete Day'})); expect(p.onComplete).not.toHaveBeenCalled();
  });
  it('keeps the established completion guard and note field hooks', () => {
    const p = {...props(), inProgress:true}; render(<TeachingView {...p} />);
    expect(screen.getByRole('button', {name:'Complete Day'}).classList.contains('complete-button')).toBe(true);
    expect(screen.getByLabelText('Actual Date').id).toBe('actual-date');
    fireEvent.change(screen.getByLabelText('Daily Comments / Deviation Summary'),{target:{value:'Review tomorrow'}});
    expect(p.onSummary).toHaveBeenCalledWith('Review tomorrow');
    fireEvent.click(screen.getByRole('button', {name:'Complete Day'})); expect(p.onComplete).toHaveBeenCalledOnce();
  });
  it('preserves class/date context in navigation and honors grading availability', () => {
    vi.stubEnv('NEXT_PUBLIC_GRADEBOOK_ENABLED','true');
    const p = props(); const { rerender } = render(<TeachingView {...p} />);
    for (const link of screen.getAllByRole('link',{name:'Attendance'})) expect(link.getAttribute('href')).toBe('/attendance?section=class-a&date=2026-10-15');
    expect(screen.getByRole('link',{name:'Live Classroom →'}).getAttribute('href')).toBe('/classroom?section=class-a');
    expect(screen.getAllByRole('link',{name:'Grading'})).toHaveLength(2);
    vi.stubEnv('NEXT_PUBLIC_GRADEBOOK_ENABLED','false'); rerender(<TeachingView {...p} />);
    expect(screen.queryByRole('link',{name:'Grading'})).toBeNull();
  });
  it('keeps full planner access and does not expose a presenter overlay', () => {
    const p=props(); render(<TeachingView {...p} />);
    fireEvent.click(screen.getByRole('button',{name:'Open Full Detailed Planner →'}));
    expect(p.onDetailed).toHaveBeenCalledOnce();
    expect(screen.queryByRole('complementary',{name:'Presenter console'})).toBeNull();
  });
});
