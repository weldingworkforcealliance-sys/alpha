'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
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

function MountainMark() {
  return (
    <svg viewBox="0 0 90 62" role="img" aria-label="Finsen Sierra mountain mark">
      <path d="M8 53 33 18l12 17 9-13 28 31h-14L55 38l-10 15-12-18-12 18H8Z" fill="currentColor" />
      <path d="m30 25 4-7 5 7-4-2-5 2Zm23 4 3-5 4 5-3-2-4 2Z" fill="#15100a" opacity=".45" />
    </svg>
  );
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
  backgroundImage = 'data:image/jpeg;base64,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',
}: FinsenSierraClockProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const timeLabel = now
    ? now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : '--:--';

  const dateLabel = now
    ? now.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const statusLabel = clockedIn ? 'Clocked In' : 'Clocked Out';
  const enabled = clockingEnabled && !busy;
  const employeeMeta = [department, employeeNumber ? `Employee #${employeeNumber}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className={styles.clock}
      style={{ '--clock-bg': `url("${backgroundImage}")` } as CSSProperties}
      data-clocked-in={clockedIn ? 'true' : 'false'}
      aria-label="Finsen Sierra Time Clock"
    >
      <div className={styles.crest} aria-hidden="true">
        <MountainMark />
      </div>

      <div className={styles.topLeftMotto}>People<br />Build<br />Tomorrow</div>
      <div className={styles.topRightMotto}>Time Turns<br />Potential<br />Into Progress</div>

      <div
        className={`${styles.lamp} ${styles.greenLamp} ${clockedIn && clockingEnabled ? styles.lampOn : ''}`}
        aria-label={clockedIn ? 'Green punched-in light on' : 'Green punched-in light off'}
      >
        <span />
      </div>

      <div
        className={`${styles.lamp} ${styles.redLamp} ${!clockedIn && clockingEnabled ? styles.lampOn : ''}`}
        aria-label={!clockedIn ? 'Red punched-out light on' : 'Red punched-out light off'}
      >
        <span />
      </div>

      <div className={styles.screen}>
        <div className={styles.screenShade} />

        <div className={styles.identity}>
          <span>Good {now && now.getHours() < 12 ? 'morning' : now && now.getHours() < 18 ? 'afternoon' : 'evening'},</span>
          <strong>{displayName}</strong>
          <small>People make progress.</small>
        </div>

        <div className={styles.date}>{dateLabel}</div>

        <div className={styles.timeBlock}>
          <strong>{timeLabel}</strong>
          <span>On time. On purpose.</span>
        </div>

        <div className={styles.statusPanel} aria-live="polite">
          <div>
            <span>Status</span>
            <strong className={clockedIn ? styles.statusIn : styles.statusOut}>
              <i />
              {statusLabel}
            </strong>
            <small>
              {clockedIn && sinceLabel ? `Since ${sinceLabel}` : 'Ready for your next punch'}
            </small>
          </div>
          <div>
            <span>Today&apos;s Total</span>
            <strong>{todayTotal}</strong>
            <small>{clockedIn ? 'Time is running' : 'Current total'}</small>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.action} ${styles.clockIn}`}
            onClick={onClockIn}
            disabled={!enabled || clockedIn || !onClockIn}
          >
            <span className={styles.actionIcon}>◷</span>
            <span><strong>{busy && !clockedIn ? 'Working…' : 'Clock In'}</strong><small>Start Your Day</small></span>
          </button>

          <button
            type="button"
            className={`${styles.action} ${styles.clockOut}`}
            onClick={onClockOut}
            disabled={!enabled || !clockedIn || !onClockOut}
          >
            <span className={styles.actionIcon}>→</span>
            <span><strong>{busy && clockedIn ? 'Working…' : 'Clock Out'}</strong><small>End Your Day</small></span>
          </button>
        </div>

        <div className={styles.footerStrip}>
          <div className={styles.avatar}>{displayName.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div>
          <div className={styles.employee}>
            <strong>{displayName}</strong>
            <span>{employeeMeta}</span>
          </div>
          {viewTimeHref ? (
            <a className={styles.viewTime} href={viewTimeHref}>▥ <span>View My Time</span></a>
          ) : (
            <button type="button" className={styles.viewTime} onClick={onViewTime} disabled={!onViewTime}>
              ▥ <span>View My Time</span>
            </button>
          )}
        </div>
      </div>

      <div className={styles.leftLower}>Harder<br />People<br />Brighter<br />Days</div>
      <div className={styles.rightLower}>A More<br />Human<br />Workplace<br />Always</div>

      <div className={styles.nameplate}>
        <strong>Finsen Sierra</strong>
        <span>Time Clock</span>
      </div>
    </div>
  );
}
