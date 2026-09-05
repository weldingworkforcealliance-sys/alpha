import { describe, expect, it, vi } from 'vitest';
import { createClassroomSession } from '../lib/classroom-session';

function fakeSupabase(returnedSession: Record<string, unknown>) {
  const single = vi.fn().mockResolvedValue({ data: returnedSession, error: null });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const rpc = vi.fn().mockResolvedValue({ data: 'session-1', error: null });
  return { client: { rpc, from } as any, rpc };
}

describe('createClassroomSession', () => {
  it('passes exact launch context to the v2 RPC', async () => {
    const { client, rpc } = fakeSupabase({
      id: 'session-1', join_code: 'ABC123', status: 'active',
      started_at: '2026-09-05T12:00:00Z', expires_at: '2026-09-05T20:00:00Z',
      section_id: 'section-a', assessment_slug: 'blueprint_day1', expected_students: 17,
    });

    await createClassroomSession(client, {
      sectionId: 'section-a', assessmentSlug: 'blueprint_day1', expectedStudents: 17,
    });

    expect(rpc).toHaveBeenCalledWith('start_classroom_session_v2', {
      p_section_id: 'section-a',
      p_assessment_slug: 'blueprint_day1',
      p_expected_students: 17,
    });
  });

  it('rejects a session returned for a different class', async () => {
    const { client } = fakeSupabase({
      id: 'session-1', join_code: 'ABC123', status: 'active',
      started_at: '2026-09-05T12:00:00Z', expires_at: '2026-09-05T20:00:00Z',
      section_id: 'wrong-section', assessment_slug: 'blueprint_day1', expected_students: 17,
    });

    await expect(createClassroomSession(client, {
      sectionId: 'section-a', assessmentSlug: 'blueprint_day1', expectedStudents: 17,
    })).rejects.toThrow('did not match the requested class and assessment');
  });

  it('rejects a session returned for a different assessment', async () => {
    const { client } = fakeSupabase({
      id: 'session-1', join_code: 'ABC123', status: 'active',
      started_at: '2026-09-05T12:00:00Z', expires_at: '2026-09-05T20:00:00Z',
      section_id: 'section-a', assessment_slug: 'preclass_math', expected_students: 17,
    });

    await expect(createClassroomSession(client, {
      sectionId: 'section-a', assessmentSlug: 'blueprint_day1', expectedStudents: 17,
    })).rejects.toThrow('did not match the requested class and assessment');
  });
});
