'use client';

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import FinsenSierraClock from '@/app/components/finsen-sierra-clock';
import type { DemoProgram } from '../_lib/demo-types';
import WeldingDemoLiveWorkspace from './WeldingDemoLiveWorkspace';

type GenericDemoState = {
  activeModule?: string;
  clockedInAt?: number | null;
  accumulatedSeconds?: number;
  liveSession?: {
    startedAt?: number;
  } | null;
};

type RemoteOwnerSession = {
  sessionId: string;
  instructorToken: string;
  joinCode: string;
  activityKey: string;
  title: string;
  courseCode: string;
  dayNumber: number;
  startedAt: number;
};

function genericStorageKey(programId: string) {
  return `ltg_demo_${programId}_full_system_v1`;
}

function ownerStorageKey(programId: string, startedAt: number) {
  return `ltg_demo_remote_owner_${programId}_${startedAt}`;
}

function readGenericState(programId: string): GenericDemoState | null {
  try {
    const raw = sessionStorage.getItem(genericStorageKey(programId));
    return raw ? JSON.parse(raw) as GenericDemoState : null;
  } catch {
    return null;
  }
}

function readRemoteOwner(programId: string, startedAt?: number): RemoteOwnerSession | null {
  if (!startedAt) return null;
  try {
    const raw = sessionStorage.getItem(ownerStorageKey(programId, startedAt));
    return raw ? JSON.parse(raw) as RemoteOwnerSession : null;
  } catch {
    return null;
  }
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatTime(value: number | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const INLINE_CLOCK_BACKGROUND = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 560">
  <defs>
    <linearGradient id="paint" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#26343c"/>
      <stop offset="0.42" stop-color="#111c22"/>
      <stop offset="0.72" stop-color="#1d2b31"/>
      <stop offset="1" stop-color="#0a1115"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".18"/>
      <stop offset=".22" stop-color="#ffffff" stop-opacity=".035"/>
      <stop offset=".55" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity=".2"/>
    </linearGradient>
    <pattern id="brush" width="14" height="14" patternUnits="userSpaceOnUse">
      <path d="M0 2h14M0 8h14" stroke="#ffffff" stroke-opacity=".025" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1600" height="560" fill="url(#paint)"/>
  <rect width="1600" height="560" fill="url(#brush)"/>
  <path d="M-80 490 440 70h150L65 560H-80Z" fill="#cf762c" fill-opacity=".12"/>
  <path d="M1160 -40h280l-690 600H480Z" fill="#76d7ff" fill-opacity=".035"/>
  <circle cx="1325" cy="120" r="250" fill="#8fe8ff" fill-opacity=".025"/>
  <text x="1240" y="435" text-anchor="middle" fill="#ffffff" fill-opacity=".08" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="700" letter-spacing="10">WELDING TECHNOLOGY</text>
  <rect width="1600" height="560" fill="url(#gloss)"/>
</svg>
`)}`;

export default function WeldingDemoAugmentedWorkspace({ program }: { program: DemoProgram }) {
  const [genericState, setGenericState] = useState<GenericDemoState | null>(null);
  const [remoteOwner, setRemoteOwner] = useState<RemoteOwnerSession | null>(null);
  const [qrHost, setQrHost] = useState<HTMLElement | null>(null);
  const [clockHost, setClockHost] = useState<HTMLElement | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrError, setQrError] = useState('');
  const [showTimeDetails, setShowTimeDetails] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('module') !== 'timeclock') return;
    try {
      const key = genericStorageKey(program.id);
      const raw = sessionStorage.getItem(key);
      const current = raw ? JSON.parse(raw) as Record<string, unknown> : {};
      sessionStorage.setItem(key, JSON.stringify({ ...current, activeModule: 'timeclock' }));
    } catch {
      // The underlying demo hydrator will fall back to its initial state if storage is unavailable.
    }
  }, [program.id]);

  useEffect(() => {
    const sync = () => {
      const nextState = readGenericState(program.id);
      setGenericState(nextState);
      const nextOwner = readRemoteOwner(program.id, nextState?.liveSession?.startedAt);
      setRemoteOwner((current) => current?.sessionId === nextOwner?.sessionId ? current : nextOwner);
      setQrHost(document.querySelector<HTMLElement>('.live-overlay .session-card'));
      setClockHost(document.querySelector<HTMLElement>('.clock-panel'));
      setNow(Date.now());
    };
    sync();
    const id = window.setInterval(sync, 300);
    return () => window.clearInterval(id);
  }, [program.id]);

  const studentUrl = useMemo(() => {
    if (!remoteOwner || typeof window === 'undefined') return '';
    return `${window.location.origin}/demo/welding/student-display?code=${encodeURIComponent(remoteOwner.joinCode)}`;
  }, [remoteOwner]);

  useEffect(() => {
    let cancelled = false;
    if (!studentUrl) {
      setQrDataUrl('');
      setQrError('');
      return;
    }
    QRCode.toDataURL(studentUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#071014', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
          setQrError('');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl('');
          setQrError('QR unavailable');
        }
      });
    return () => { cancelled = true; };
  }, [studentUrl]);

  const clockedInAt = genericState?.clockedInAt ?? null;
  const accumulatedSeconds = genericState?.accumulatedSeconds ?? 0;
  const currentClockSeconds = accumulatedSeconds + (clockedInAt ? Math.max(0, Math.floor((now - clockedInAt) / 1000)) : 0);
  const clockedIn = Boolean(clockedInAt);

  const triggerUnderlyingPunch = () => {
    const button = document.querySelector<HTMLButtonElement>('.clock-panel .clock-card button');
    button?.click();
  };

  return (
    <>
      <WeldingDemoLiveWorkspace program={program} />

      {qrHost && remoteOwner && createPortal(
        <div className="demo-qr-insert" aria-label="Student QR join code">
          <div className="demo-qr-frame">
            {qrDataUrl ? <img src={qrDataUrl} alt={`QR code to join ${remoteOwner.title}`} /> : <span>{qrError || 'Generating QR…'}</span>}
          </div>
          <div className="demo-qr-copy">
            <strong>SCAN TO JOIN</strong>
            <span>Phone camera opens the student activity.</span>
          </div>
        </div>,
        qrHost
      )}

      {clockHost && genericState?.activeModule === 'timeclock' && createPortal(
        <div className="demo-inline-clock">
          <div className="demo-inline-clock-heading">
            <div>
              <span>FINSEN SIERRA TIME CLOCK</span>
              <strong>Integrated workforce time module</strong>
            </div>
            <b>{clockedIn ? 'PUNCHED IN' : 'PUNCHED OUT'}</b>
          </div>
          <FinsenSierraClock
            displayName={program.instructorName}
            department={`${program.name} · Instructor`}
            employeeNumber="DEMO"
            clockedIn={clockedIn}
            sinceLabel={formatTime(clockedInAt)}
            todayTotal={formatDuration(currentClockSeconds)}
            onClockIn={triggerUnderlyingPunch}
            onClockOut={triggerUnderlyingPunch}
            onViewTime={() => setShowTimeDetails((value) => !value)}
            backgroundImage={INLINE_CLOCK_BACKGROUND}
          />
          {showTimeDetails && (
            <div className="demo-time-details" aria-live="polite">
              <div><span>Status</span><strong>{clockedIn ? `Clocked in since ${formatTime(clockedInAt)}` : 'Clocked out'}</strong></div>
              <div><span>Today</span><strong>{formatDuration(currentClockSeconds)}</strong></div>
              <div><span>Record</span><strong>Temporary demo session</strong></div>
            </div>
          )}
        </div>,
        clockHost
      )}

      <style jsx global>{`
        .live-overlay .session-card { flex-wrap: wrap; }
        .live-overlay .demo-qr-insert {
          display: grid;
          grid-template-columns: 112px minmax(120px, 170px);
          gap: 12px;
          align-items: center;
          padding: 9px;
          border: 1px solid #36515c;
          border-radius: 10px;
          background: #0b1418;
          box-shadow: inset 0 0 0 1px rgba(105,223,255,.04);
        }
        .live-overlay .demo-qr-frame {
          width: 112px;
          height: 112px;
          display: grid;
          place-items: center;
          overflow: hidden;
          border: 5px solid #fff;
          border-radius: 8px;
          background: #fff;
          color: #23343b;
          font-size: 9px;
          font-weight: 800;
          text-align: center;
        }
        .live-overlay .demo-qr-frame img { display: block; width: 100%; height: 100%; object-fit: contain; }
        .live-overlay .demo-qr-copy { display: grid; gap: 5px; }
        .live-overlay .demo-qr-copy strong { color: #6ce1ff; font-size: 11px; letter-spacing: .12em; }
        .live-overlay .demo-qr-copy span { color: #8ea1a8; font-size: 10px; line-height: 1.45; }

        .clock-panel { display: block !important; }
        .clock-panel > .clock-card { display: none !important; }
        .clock-panel .demo-inline-clock { margin-top: 18px; }
        .clock-panel .demo-inline-clock-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 10px;
          padding: 10px 12px;
          border: 1px solid #2b3a41;
          border-radius: 9px;
          background: #0d1519;
        }
        .clock-panel .demo-inline-clock-heading > div { display: grid; gap: 3px; }
        .clock-panel .demo-inline-clock-heading span { color: #d1a050; font-size: 9px; font-weight: 950; letter-spacing: .13em; }
        .clock-panel .demo-inline-clock-heading strong { color: #e8eef0; font-size: 12px; }
        .clock-panel .demo-inline-clock-heading b {
          padding: 7px 10px;
          border: 1px solid #39515a;
          border-radius: 999px;
          color: #9eb0b7;
          font-size: 9px;
          letter-spacing: .08em;
        }
        .clock-panel .demo-time-details {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-top: 10px;
        }
        .clock-panel .demo-time-details > div {
          display: grid;
          gap: 4px;
          padding: 12px;
          border: 1px solid #2a3a41;
          border-radius: 8px;
          background: #0d1519;
        }
        .clock-panel .demo-time-details span { color: #72858d; font-size: 8px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
        .clock-panel .demo-time-details strong { color: #e6eef1; font-size: 11px; }

        @media (max-width: 1050px) {
          .live-overlay .demo-qr-insert { grid-template-columns: 100px; }
          .live-overlay .demo-qr-frame { width: 100px; height: 100px; }
          .live-overlay .demo-qr-copy span { display: none; }
        }
        @media (max-width: 760px) {
          .live-overlay .demo-qr-insert { width: 100%; grid-template-columns: 96px 1fr; }
          .live-overlay .demo-qr-frame { width: 96px; height: 96px; }
          .live-overlay .demo-qr-copy span { display: block; }
          .clock-panel .demo-time-details { grid-template-columns: 1fr; }
          .clock-panel .demo-inline-clock-heading { align-items: flex-start; flex-direction: column; }
        }
      `}</style>
    </>
  );
}
