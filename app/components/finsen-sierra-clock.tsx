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

function initials(name: string) {
  return name
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
  department = 'Operations',
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
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  const time = useMemo(
    () => now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    [now]
  );
  const date = useMemo(
    () => now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    [now]
  );
  const employeeLine = employeeNumber ? `${department} · Employee #${employeeNumber}` : department;
  const clockInDisabled = busy || !clockingEnabled || clockedIn;
  const clockOutDisabled = busy || !clockingEnabled || !clockedIn;

  return (
    <section
      className={styles.clock}
      data-clocked-in={clockedIn ? 'true' : 'false'}
      aria-label="Finsen Sierra Time Clock"
    >
      <img
        className={styles.sourceSkin}
        src="/finsen-sierra/source-material-clock.webp"
        alt=""
        aria-hidden="true"
      />

      <div className={`${styles.lampVeil} ${styles.leftLampVeil}`} aria-hidden="true" />
      <div className={`${styles.lampVeil} ${styles.rightLampVeil}`} aria-hidden="true" />

      <div className={styles.identityGlass}>
        <span>{greeting(now)}</span>
        <strong>{displayName}</strong>
        <small>People make progress.</small>
      </div>

      <div className={styles.dateGlass}>{date}</div>

      <div className={styles.timeGlass}>
        <strong>{time}</strong>
        <span>ON TIME. ON PURPOSE.</span>
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

      <div className={styles.footerGlass}>
        <div className={styles.avatar}>{initials(displayName)}</div>
        <div className={styles.employeeBlock}>
          <strong>{displayName}</strong>
          <span>{employeeLine}</span>
        </div>
        <div className={styles.statusBlock}>
          <span>Status</span>
          <strong className={clockedIn ? styles.statusIn : styles.statusOut}>
            <i aria-hidden="true" /> {clockedIn ? 'On Site' : 'Off Site'}
          </strong>
          <small>{clockedIn && sinceLabel ? `Since ${sinceLabel}` : 'Not currently punched in'}</small>
        </div>
        <div className={styles.totalBlock}>
          <span>Today&apos;s Total</span>
          <strong>{todayTotal}</strong>
          <small>{clockedIn ? 'Time is running' : 'Recorded time today'}</small>
        </div>
        {viewTimeHref ? (
          <a className={styles.viewTime} href={viewTimeHref}>View My Time</a>
        ) : (
          <button type="button" className={styles.viewTime} onClick={onViewTime} disabled={!onViewTime}>View My Time</button>
        )}
      </div>
    </section>
  );
}
