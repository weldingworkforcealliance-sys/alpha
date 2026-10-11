// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DemoProgramWorkspace from '../app/demo/_components/DemoProgramWorkspace';
import { WELDING_DEMO_PROGRAM } from '../app/demo/_data/welding-program';

const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));

const oldDeployment = process.env.NEXT_PUBLIC_DEPLOYMENT_ENV;
beforeEach(() => {
  process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = 'staging';
  sessionStorage.clear();
  mocks.push.mockReset();
});
afterEach(() => {
  cleanup();
  process.env.NEXT_PUBLIC_DEPLOYMENT_ENV = oldDeployment;
  vi.restoreAllMocks();
});

describe('FABTECH A/B session actions', () => {
  it('starts v2 on staging, retains existing day state in classic, and blocks premature completion', async () => {
    render(<DemoProgramWorkspace program={WELDING_DEMO_PROGRAM} uxLab />);
    const mainNav = await screen.findByRole('navigation', { name: 'Teaching View v2 main navigation' });
    expect(within(mainNav).getByRole('button', { name: 'Today' })).toBeTruthy();
    expect(within(mainNav).getByRole('button', { name: /Grading Tower/ })).toBeTruthy();
    expect(within(mainNav).getByRole('button', { name: /More tools/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Start Today' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Complete Day' }).hasAttribute('disabled')).toBe(false));

    fireEvent.click(screen.getByRole('button', { name: 'Complete Day' }));
    expect(await screen.findByText(/Attendance must be finalized before completing/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Carry Initial → Final' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finalize Pair Attendance' }));
    fireEvent.click(within(mainNav).getByRole('button', { name: 'Today' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Complete Day' }).hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Complete Day' }));

    expect(await screen.findByRole('heading', { name: 'Course Orientation + Entry Requirements' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Original FABTECH' }));
    expect(screen.getByRole('navigation', { name: 'Demo workspace navigation' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Teaching View v2' }));
    expect(await screen.findByRole('navigation', { name: 'Teaching View v2 main navigation' })).toBeTruthy();
  });

  it('prevents v2 grading from appearing on the original public demo entrypoint', async () => {
    render(<DemoProgramWorkspace program={WELDING_DEMO_PROGRAM} />);
    expect(await screen.findByRole('navigation', { name: 'Demo workspace navigation' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Grading Tower/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Teaching View v2' })).toBeNull();
  });
});
