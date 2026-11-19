// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import StudentAssessmentPage from '@/app/join/[code]/page';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), code: 'ABC123' }));
vi.mock('next/navigation', () => ({ useParams: () => ({ code: mocks.code }) }));
vi.mock('@/lib/supabase-public', () => ({
  getPublicSupabase: () => ({ rpc: mocks.rpc }),
}));

const assessment = {
  session: {
    session_id: 'synthetic-session',
    session_name: 'Synthetic WLD 105',
    assessment_title: 'Tool Setup Measurement Review',
    question_count: 1,
    expected_students: 17,
    instructions: null,
    allow_team_members: false,
    reference_title: null,
    reference_image_url: null,
    reference_body: null,
    show_student_score: true,
  },
  questions: [
    {
      key: 'q1',
      number: 1,
      text: 'Synthetic measurement question',
      domain: 'Measurement',
      type: 'mc',
      options: { A: '10 inches', B: '12 inches' },
    },
  ],
};

function setupRpc(overrides?: (name: string, args: Record<string, unknown>) => Promise<unknown> | null) {
  mocks.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    const custom = overrides?.(name, args);
    if (custom !== null && custom !== undefined) return custom;
    if (name === 'get_classroom_assessment') return { data: assessment, error: null };
    if (name === 'validate_classroom_student_identity') return { data: true, error: null };
    if (name === 'submit_classroom_assessment_v2') {
      return { data: { score: 1, possible_score: 1, percent: 100 }, error: null };
    }
    throw new Error('Unexpected RPC: ' + name);
  });
}

async function openStart() {
  render(<StudentAssessmentPage />);
  await screen.findByRole('heading', { name: 'Tool Setup Measurement Review' });
}

async function enterIdentity(id: string, name = 'Synthetic Student') {
  fireEvent.change(screen.getByRole('textbox', { name: 'Student Name' }), { target: { value: name } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Student ID' }), { target: { value: id } });
}

async function begin(label = 'Begin Live Activity') {
  fireEvent.click(screen.getByRole('button', { name: label }));
  await screen.findByText('Synthetic measurement question');
}

beforeEach(() => {
  mocks.rpc.mockReset();
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Live Classroom Student ID preflight and draft recovery', () => {
  it('checks enrollment before presenting any questions, allowing Student ID correction', async () => {
    setupRpc((name, args) =>
      name === 'validate_classroom_student_identity'
        ? Promise.resolve({ data: args.p_student_id === '123456', error: null })
        : null
    );
    await openStart();
    await enterIdentity('wrong-id');
    fireEvent.click(screen.getByRole('button', { name: 'Begin Live Activity' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Student ID not recognized'));
    expect(screen.queryByText('Synthetic measurement question')).toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: 'Student ID' }), {
      target: { value: '123456' },
    });
    await begin();
    expect(mocks.rpc).toHaveBeenCalledWith('validate_classroom_student_identity', {
      p_join_code: 'ABC123',
      p_student_name: 'Synthetic Student',
      p_student_id: '123456',
    });
  });

  it('lets students edit identity mid-activity without losing completed answers', async () => {
    setupRpc();
    await openStart();
    await enterIdentity('123456');
    await begin();
    fireEvent.click(screen.getAllByRole('radio')[0]);
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('ltg-assessment-ABC123') ?? '{}').answers).toEqual({ q1: 'A' });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Correct Student ID / Name' }));
    expect(screen.queryByText('Synthetic measurement question')).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Student ID' }), {
      target: { value: '000123456' },
    });
    await begin('Resume Live Activity');
    expect(screen.getAllByRole('radio')[0]).toHaveProperty('checked', true);
    fireEvent.click(screen.getByRole('button', { name: 'Submit Live Activity' }));
    await screen.findByRole('heading', { name: 'Activity Submitted' });
    expect(mocks.rpc).toHaveBeenCalledWith('submit_classroom_assessment_v2', expect.objectContaining({
      p_student_id: '000123456',
      p_answers: { q1: 'A' },
    }));
    expect(localStorage.getItem('ltg-assessment-ABC123')).toBeNull();
  });

  it('recovers all completed answers after a rejected final submission and allows resubmission', async () => {
    let submitCalls = 0;
    setupRpc(name => {
      if (name === 'submit_classroom_assessment_v2') {
        submitCalls += 1;
        return Promise.resolve(submitCalls === 1
          ? { data: null, error: { message: 'Student ID not recognized for this class.' } }
          : { data: { score: 1, possible_score: 1, percent: 100 }, error: null });
      }
      return null;
    });
    await openStart();
    await enterIdentity('999999');
    await begin();
    fireEvent.click(screen.getAllByRole('radio')[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Submit Live Activity' }));
    await screen.findByRole('alert');
    expect(screen.getByText(/1 saved answers are ready/)).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Student ID' })).toHaveProperty('value', '999999');

    fireEvent.change(screen.getByRole('textbox', { name: 'Student ID' }), {
      target: { value: '123456' },
    });
    await begin('Resume Live Activity');
    expect(screen.getAllByRole('radio')[1]).toHaveProperty('checked', true);
    fireEvent.click(screen.getByRole('button', { name: 'Submit Live Activity' }));
    await screen.findByRole('heading', { name: 'Activity Submitted' });
    expect(submitCalls).toBe(2);
    expect(mocks.rpc).toHaveBeenLastCalledWith('submit_classroom_assessment_v2', expect.objectContaining({
      p_student_id: '123456',
      p_answers: { q1: 'B' },
    }));
  });

  it('fails closed if preflight cannot be reached and does not clear the student's local draft', async () => {
    setupRpc(name => name === 'validate_classroom_student_identity'
      ? Promise.resolve({ data: null, error: { message: 'Network error' } })
      : null
    );
    localStorage.setItem('ltg-assessment-ABC123', JSON.stringify({
      name: 'Synthetic Student', studentId: '123456', teamMembers: '', answers: { q1: 'A' },
    }));
    await openStart();
    fireEvent.click(screen.getByRole('button', { name: 'Resume Live Activity' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Unable to check'));
    expect(screen.queryByText('Synthetic measurement question')).toBeNull();
    expect(JSON.parse(localStorage.getItem('ltg-assessment-ABC123') ?? '{}').answers).toEqual({ q1: 'A' });
  });
});
