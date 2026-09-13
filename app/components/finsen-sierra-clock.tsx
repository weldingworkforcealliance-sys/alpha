'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './finsen-sierra-clock.module.css';

type FinsenSierraClockProps = {
  displayName: string;
  department?: string;
  employeeNumber?: string;
  clockedIn: boolean;
  sinceLabel?: string | null;
  todayTotal: string;
  busy?: boolean;
  clockingEnabled?: boolean;
  onClockIn?: () => void;
  onClockOut?: () => void;
  viewTimeHref?: string;
  onViewTime?: () => void;
  backgroundImage?: string;
};

const APPROVED_SKIN_PARTS = Array.from({ length: 9 }, (_, index) =>
  `/finsen-sierra/approved-bronze/clock-${String(index + 1).padStart(2, '0')}.txt`
);
const APPROVED_SKIN_BASE64_LENGTH = 48_180;

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'LT';
}

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 18) return 'Good afternoon,';
  return 'Good evening,';
}

export default function FinsenSierraClock({
  displayName,
  department = 'LTG Employee',
  employeeNumber,
  clockedIn,
  sinceLabel,
  todayTotal,
  busy = false,
  clockingEnabled = true,
  onClockIn,
  onClockOut,
  viewTimeHref,
  onViewTime,
}: FinsenSierraClockProps) {
  const [sourceSkin, setSourceSkin] = useState('');
  const [skinError, setSkinError] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      APPROVED_SKIN_PARTS.map(async (path) => {
        const response = await fetch(path, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`clock artwork unavailable: ${path}`);
        return response.text();
      })
    )
      .then((parts) => {
        const encoded = parts.join('').replace(/\s+/g, '');
        if (encoded.length !== APPROVED_SKIN_BASE64_LENGTH) {
          throw new Error('approved clock artwork is incomplete');
        }
        if (!cancelled) {
          setSkinError(false);
          setSourceSkin(`data:image/avif;base64,${encoded}`);
        }
      })
      .catch(() => {
        if (!cancelled) setSkinError(true);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const clockInDisabled = busy || !clockingEnabled || clockedIn;
  const clockOutDisabled = busy || !clockingEnabled || !clockedIn;

  const currentTime = useMemo(
    () => now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    [now]
  );
  const currentDate = useMemo(
    () => now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    [now]
  );
  const employeeLine = employeeNumber ? `${department} · Employee #${employeeNumber}` : department;

  return (
    <section
      className={styles.clock}
      data-clocked-in={clockedIn ? 'true' : 'false'}
      aria-label="Finsen Sierra Time Clock"
    >
      {sourceSkin ? (
        <img
          className={styles.sourceSkin}
          src={sourceSkin}
          alt="Finsen Sierra Time Clock"
          draggable={false}
        />
      ) : (
        <div className={styles.skinLoading}>{skinError ? 'Clock artwork unavailable' : 'Loading clock artwork…'}</div>
      )}

      <div className={`${styles.lampVeil} ${styles.leftLampVeil}`} aria-hidden="true" />
      <div className={`${styles.lampVeil} ${styles.rightLampVeil}`} aria-hidden="true" />

      <div className={styles.identityReadout} aria-live="polite">
        <span>{greeting(now)}</span>
        <strong>{displayName}</strong>
        <small>People make progress.</small>
      </div>

      <div className={styles.dateReadout}>{currentDate}</div>

      <div className={styles.timeReadout} aria-live="off">
        <strong>{currentTime}</strong>
        <span>ON TIME. ON PURPOSE.</span>
      </div>

      <div className={styles.employeeReadout}>
        <span className={styles.avatar}>{initials(displayName)}</span>
        <span className={styles.employeeIdentity}>
          <strong>{displayName}</strong>
          <small>{employeeLine}</small>
        </span>
        <span className={styles.statusReadout}>
          <small>Status</small>
          <strong className={clockedIn ? styles.onSite : styles.offSite}>
            <i aria-hidden="true" /> {clockedIn ? 'On Site' : 'Off Site'}
          </strong>
          <small>{clockedIn && sinceLabel ? `Since ${sinceLabel}` : 'Not currently punched in'}</small>
        </span>
        <span className={styles.totalReadout}>
          <small>Today&apos;s Total</small>
          <strong>{todayTotal}</strong>
          <small>{clockedIn ? 'Time is running' : 'Recorded time today'}</small>
        </span>
      </div>

      <button
        type="button"
        className={`${styles.hotspot} ${styles.clockInHotspot}`}
        disabled={clockInDisabled}
        onClick={onClockIn}
        aria-label={clockedIn ? 'Already clocked in' : 'Clock in'}
      >
        <span className={styles.srOnly}>Clock In</span>
      </button>

      <button
        type="button"
        className={`${styles.hotspot} ${styles.clockOutHotspot}`}
        disabled={clockOutDisabled}
        onClick={onClockOut}
        aria-label={clockedIn ? 'Clock out' : 'Already clocked out'}
      >
        <span className={styles.srOnly}>Clock Out</span>
      </button>

      {viewTimeHref ? (
        <a className={`${styles.hotspot} ${styles.viewTimeHotspot}`} href={viewTimeHref} aria-label="View my time">
          <span className={styles.srOnly}>View My Time</span>
        </a>
      ) : (
        <button
          type="button"
          className={`${styles.hotspot} ${styles.viewTimeHotspot}`}
          onClick={onViewTime}
          disabled={!onViewTime}
          aria-label="View my time"
        >
          <span className={styles.srOnly}>View My Time</span>
        </button>
      )}
    </section>
  );
}
