'use client';

import { useEffect } from 'react';
import { connectDemoClassroomStudent } from '../_lib/demo-classroom-api';

export default function ParticipantHeartbeat({
  joinCode,
  studentName,
  enabled,
}: {
  joinCode: string;
  studentName: string;
  enabled: boolean;
}) {
  useEffect(() => {
    if (!enabled || !joinCode || studentName.trim().length < 2) return;
    let cancelled = false;

    const beat = async () => {
      try {
        await connectDemoClassroomStudent(joinCode, studentName);
      } catch {
        if (!cancelled) {
          // The main student screen owns visible error handling. A missed heartbeat is non-fatal.
        }
      }
    };

    void beat();
    const id = window.setInterval(() => void beat(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, joinCode, studentName]);

  return null;
}
