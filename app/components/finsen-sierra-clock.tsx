'use client';

import { useEffect, useState } from 'react';
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

export default function FinsenSierraClock({
  clockedIn,
  busy = false,
  clockingEnabled = true,
  onClockIn,
  onClockOut,
  viewTimeHref,
  onViewTime,
}: FinsenSierraClockProps) {
  const [sourceSkin, setSourceSkin] = useState('');
  const [skinError, setSkinError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/finsen-sierra/source-material-clock.b64.txt', { cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) throw new Error('source material unavailable');
        return response.text();
      })
      .then((encoded) => {
        if (!cancelled) setSourceSkin(`data:image/webp;base64,${encoded.trim()}`);
      })
      .catch(() => {
        if (!cancelled) setSkinError(true);
      });
    return () => { cancelled = true; };
  }, []);

  const clockInDisabled = busy || !clockingEnabled || clockedIn;
  const clockOutDisabled = busy || !clockingEnabled || !clockedIn;

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
