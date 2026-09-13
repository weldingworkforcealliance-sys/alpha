'use client';

import { useEffect } from 'react';

type Participant = { name: string; connectedAt: number; lastSeenAt: number };

type Submission = { studentName: string };

function keyFor(sessionId: string) {
  return `ltg_demo_classroom_${sessionId}`;
}

export default function ParticipantHeartbeat({ sessionId, studentName }: { sessionId: string; studentName: string }) {
  useEffect(() => {
    if (!sessionId) return;
    const write = () => {
      try {
        const key = keyFor(sessionId);
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const current = JSON.parse(raw) as { participants?: Participant[]; submissions?: Submission[]; lastActivityAt?: number };
        const now = Date.now();
        const normalized = studentName.trim() || 'Demo Student';
        const participants = Array.isArray(current.participants) ? [...current.participants] : [];
        const existingIndex = participants.findIndex((item) => item.name === normalized);
        if (existingIndex >= 0) participants[existingIndex] = { ...participants[existingIndex], lastSeenAt: now };
        else participants.push({ name: normalized, connectedAt: now, lastSeenAt: now });
        localStorage.setItem(key, JSON.stringify({ ...current, lastActivityAt: now, participants }));
      } catch {
        // Temporary demo storage only.
      }
    };
    write();
    const id = window.setInterval(write, 5000);
    return () => window.clearInterval(id);
  }, [sessionId, studentName]);

  return null;
}
