'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { getSupabase } from '@/lib/supabase-browser';

type DeviceKind = 'phone' | 'tablet' | 'laptop' | 'tv';
type Role = 'launch' | 'lane' | 'target' | 'scoreboard' | 'spectator';
type Position = 'center' | 'afterA' | 'after2' | 'independent';

type Device = {
  id: string;
  name: string;
  kind: DeviceKind;
  role: Role;
  position: Position;
  host?: boolean;
};

type BallState = {
  x: number;
  y: number;
  moving: boolean;
  seq: number;
};

const panel: React.CSSProperties = {
  border: '1px solid #303846',
  borderRadius: 16,
  padding: 16,
  background: '#11161d',
};

const button: React.CSSProperties = {
  minHeight: 46,
  borderRadius: 12,
  border: '1px solid #3c4656',
  background: '#1b2430',
  color: '#f3f5f7',
  padding: '10px 14px',
  fontWeight: 700,
  cursor: 'pointer',
};

const primary: React.CSSProperties = {
  ...button,
  background: '#e7edf6',
  color: '#10151c',
  borderColor: '#e7edf6',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 46,
  borderRadius: 10,
  border: '1px solid #3c4656',
  background: '#0d1218',
  color: '#f3f5f7',
  padding: '8px 10px',
  fontSize: 16,
};

function makeId(prefix: string) {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  return prefix + '-' + Array.from(bytes, (v) => v.toString(36)).join('');
}

function viewportFor(device: Device, devices: Device[]) {
  if (device.position === 'independent') return null;
  if (device.position === 'center') return { y0: 0, y1: 34 };
  const hasThird = devices.some((d) => d.position === 'after2');
  if (device.position === 'afterA') return { y0: 34, y1: hasThird ? 67 : 100 };
  if (device.position === 'after2') return { y0: 67, y1: 100 };
  return null;
}

function LaneView({
  device,
  devices,
  ball,
}: {
  device: Device;
  devices: Device[];
  ball: BallState;
}) {
  const vp = viewportFor(device, devices);
  if (!vp) {
    return (
      <div style={{ ...panel, minHeight: 260, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: '#8f9bac', letterSpacing: '.12em' }}>INDEPENDENT DISPLAY</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{device.role.toUpperCase()}</div>
          <div style={{ color: '#8f9bac', marginTop: 8 }}>Session spectator / scoreboard surface</div>
        </div>
      </div>
    );
  }

  const visible = ball.y >= vp.y0 && ball.y <= vp.y1;
  const pct = ((ball.y - vp.y0) / (vp.y1 - vp.y0)) * 100;

  return (
    <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #303846', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong>{device.name}</strong>
        <span style={{ color: '#8f9bac', fontSize: 12 }}>{device.role} · Y {vp.y0}–{vp.y1}</span>
      </div>
      <div
        style={{
          height: 330,
          position: 'relative',
          overflow: 'hidden',
          background:
            'repeating-linear-gradient(0deg,#141b24 0,#141b24 54px,#1a222d 55px,#1a222d 56px)',
        }}
      >
        <div style={{ position: 'absolute', left: '10%', right: '10%', top: 0, bottom: 0, borderLeft: '2px solid #495466', borderRight: '2px solid #495466' }} />
        {visible && (
          <div
            style={{
              position: 'absolute',
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#e7edf6',
              border: '3px solid #7d8da4',
              left: '50%',
              bottom: `calc(${Math.max(2, Math.min(98, pct))}% - 14px)`,
              transform: 'translateX(-50%)',
              boxShadow: '0 6px 18px rgba(0,0,0,.35)',
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function TwinLaneTrialPage() {
  const [supabase] = useState(getSupabase);
  const [sessionId, setSessionId] = useState('');
  const [host, setHost] = useState(false);
  const [connected, setConnected] = useState(false);
  const [channelReady, setChannelReady] = useState(false);
  const [qr, setQr] = useState('');
  const [joinUrl, setJoinUrl] = useState('');
  const [deviceKind, setDeviceKind] = useState<DeviceKind>('phone');
  const [role, setRole] = useState<Role>('target');
  const [position, setPosition] = useState<Position>('afterA');
  const [localDevice, setLocalDevice] = useState<Device | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [ball, setBall] = useState<BallState>({ x: 50, y: 8, moving: false, seq: 0 });
  const [status, setStatus] = useState('Create a live session on Phone A.');
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const animRef = useRef<number | null>(null);
  const joinTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get('session');
    if (s) {
      setSessionId(s);
      setHost(false);
      setStatus('Choose this screen’s role and physical position, then join.');
    }
  }, []);

  const hostDevice = useMemo<Device>(
    () => ({ id: 'host', name: 'Phone A', kind: 'phone', role: 'launch', position: 'center', host: true }),
    []
  );

  async function subscribe(sid: string, isHost: boolean, joiningDevice?: Device) {
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`twinlane:${sid}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on('broadcast', { event: 'join' }, ({ payload }) => {
        if (!isHost) return;
        const incoming = payload as Device;
        setDevices((current) => {
          const without = current.filter((d) => d.id !== incoming.id);
          return [hostDevice, ...without.filter((d) => !d.host), incoming];
        });
        void channel.send({
          type: 'broadcast',
          event: 'ack',
          payload: { deviceId: incoming.id, host: hostDevice },
        });
      })
      .on('broadcast', { event: 'ack' }, ({ payload }) => {
        if (isHost) return;
        if (joiningDevice && payload?.deviceId === joiningDevice.id) {
          setConnected(true);
          setStatus('Connected to Phone A. Ready for the live ball test.');
          if (joinTimerRef.current) {
            clearInterval(joinTimerRef.current);
            joinTimerRef.current = null;
          }
        }
      })
      .on('broadcast', { event: 'ball' }, ({ payload }) => {
        setBall(payload as BallState);
      })
      .on('broadcast', { event: 'devices' }, ({ payload }) => {
        if (Array.isArray(payload)) setDevices(payload as Device[]);
      });

    channel.subscribe(async (state) => {
      if (state !== 'SUBSCRIBED') return;
      channelRef.current = channel;
      setChannelReady(true);

      if (isHost) {
        setConnected(true);
        setDevices([hostDevice]);
        setStatus('Live channel ready. Scan the QR with a second device.');
      } else if (joiningDevice) {
        const sendJoin = async () => {
          await channel.send({ type: 'broadcast', event: 'join', payload: joiningDevice });
        };
        await sendJoin();
        joinTimerRef.current = setInterval(sendJoin, 1500);
      }
    });
  }

  useEffect(() => {
    if (!host || !sessionId || typeof window === 'undefined') return;
    const url = `${window.location.origin}/twinlane-trial?session=${encodeURIComponent(sessionId)}`;
    setJoinUrl(url);
    QRCode.toDataURL(url, { width: 260, margin: 1 })
      .then(setQr)
      .catch(() => setQr(''));
  }, [host, sessionId]);

  useEffect(() => {
    if (!host || !channelReady || !channelRef.current) return;
    void channelRef.current.send({ type: 'broadcast', event: 'devices', payload: devices });
  }, [devices, host, channelReady]);

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (joinTimerRef.current) clearInterval(joinTimerRef.current);
      if (channelRef.current) void supabase.removeChannel(channelRef.current);
    };
  }, [supabase]);

  function createSession() {
    const sid = makeId('tl').replace(/[^a-z0-9-]/gi, '').slice(0, 22);
    setSessionId(sid);
    setHost(true);
    setLocalDevice(hostDevice);
    setDevices([hostDevice]);
    setStatus('Opening live TwinLane channel…');
    void subscribe(sid, true);
  }

  function joinSession() {
    if (!sessionId) return;
    const device: Device = {
      id: makeId('screen'),
      name: `${deviceKind.charAt(0).toUpperCase() + deviceKind.slice(1)} Screen`,
      kind: deviceKind,
      role,
      position,
    };
    setLocalDevice(device);
    setDevices([device]);
    setStatus('Connecting to Phone A…');
    void subscribe(sessionId, false, device);
  }

  function runBallTest() {
    if (!host || !channelRef.current || ball.moving) return;

    const start = performance.now();
    const duration = 3600;
    const seq = ball.seq + 1;
    setStatus('Live ball test running across connected screens…');

    const frame = async (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 2.1);
      const next: BallState = {
        x: 50,
        y: 8 + eased * 88,
        moving: t < 1,
        seq,
      };
      setBall(next);

      if (channelRef.current) {
        await channelRef.current.send({ type: 'broadcast', event: 'ball', payload: next });
      }

      if (t < 1) {
        animRef.current = requestAnimationFrame(frame);
      } else {
        animRef.current = null;
        setStatus('PASS if the same ball crossed Phone A and appeared on the next screen without a duplicate.');
      }
    };

    animRef.current = requestAnimationFrame(frame);
  }

  const visibleDevices = host ? devices : localDevice ? [localDevice] : [];

  return (
    <main style={{ minHeight: '100vh', background: '#090d12', color: '#f3f5f7', padding: '18px 14px 40px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <header style={{ marginBottom: 16 }}>
          <div style={{ color: '#8f9bac', fontSize: 12, letterSpacing: '.14em', fontWeight: 800 }}>CORVU MOR · TWINLANE LIVE TRIAL</div>
          <h1 style={{ margin: '6px 0 4px', fontSize: 28 }}>Multi-screen connection test</h1>
          <p style={{ margin: 0, color: '#aab4c2' }}>One realtime session. Multiple physical screens. One moving game object.</p>
        </header>

        {!sessionId && (
          <section style={panel}>
            <h2 style={{ marginTop: 0 }}>Phone A</h2>
            <p style={{ color: '#aab4c2' }}>Create the session on the launch phone.</p>
            <button style={primary} onClick={createSession}>Create Live Session</button>
          </section>
        )}

        {sessionId && !host && !connected && (
          <section style={panel}>
            <h2 style={{ marginTop: 0 }}>Join TwinLane</h2>
            <p style={{ color: '#aab4c2' }}>Tell the engine what this screen is and where it physically sits.</p>
            <div style={{ display: 'grid', gap: 12 }}>
              <label>Device
                <select value={deviceKind} onChange={(e) => setDeviceKind(e.target.value as DeviceKind)} style={selectStyle}>
                  <option value="phone">Phone</option>
                  <option value="tablet">Tablet</option>
                  <option value="laptop">Laptop</option>
                  <option value="tv">TV / browser display</option>
                </select>
              </label>
              <label>Role
                <select value={role} onChange={(e) => setRole(e.target.value as Role)} style={selectStyle}>
                  <option value="lane">Lane</option>
                  <option value="target">Target</option>
                  <option value="scoreboard">Scoreboard</option>
                  <option value="spectator">Spectator</option>
                </select>
              </label>
              <label>Physical position
                <select value={position} onChange={(e) => setPosition(e.target.value as Position)} style={selectStyle}>
                  <option value="afterA">After Phone A</option>
                  <option value="after2">After Screen 2</option>
                  <option value="independent">Independent display</option>
                </select>
              </label>
              <button style={primary} onClick={joinSession}>Join Live Session</button>
            </div>
          </section>
        )}

        {host && (
          <section style={{ ...panel, marginBottom: 14 }}>
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#8f9bac', fontSize: 12 }}>SESSION</div>
                <strong style={{ display: 'block', marginTop: 4 }}>{sessionId}</strong>
                <div style={{ color: '#8f9bac', fontSize: 12, marginTop: 10, wordBreak: 'break-all' }}>{joinUrl}</div>
              </div>
              {qr && <img src={qr} width={150} height={150} alt="QR code to join TwinLane live session" style={{ borderRadius: 12, background: '#fff', padding: 6 }} />}
            </div>
            <button style={{ ...primary, width: '100%', marginTop: 14 }} disabled={!channelReady || devices.length < 2 || ball.moving} onClick={runBallTest}>
              {devices.length < 2 ? 'Waiting for Screen 2' : ball.moving ? 'Ball Moving…' : 'Run Live Ball Test'}
            </button>
          </section>
        )}

        {(connected || host) && localDevice && (
          <div style={{ display: 'grid', gap: 14 }}>
            <LaneView device={localDevice} devices={host ? devices : [hostDevice, localDevice]} ball={ball} />
          </div>
        )}

        {host && devices.length > 0 && (
          <section style={{ ...panel, marginTop: 14 }}>
            <h2 style={{ margin: '0 0 10px', fontSize: 18 }}>Connected screens</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {devices.map((d) => {
                const vp = viewportFor(d, devices);
                return (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, borderTop: '1px solid #28313e', paddingTop: 9 }}>
                    <div><strong>{d.name}</strong><div style={{ color: '#8f9bac', fontSize: 12 }}>{d.kind} · {d.position}</div></div>
                    <div style={{ textAlign: 'right' }}><strong>{d.role}</strong><div style={{ color: '#8f9bac', fontSize: 12 }}>{vp ? `Y ${vp.y0}–${vp.y1}` : 'UI only'}</div></div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div style={{ ...panel, marginTop: 14, color: '#dce3ec' }}>
          <strong>Status</strong>
          <div style={{ marginTop: 6, color: '#aab4c2' }}>{status}</div>
          <div style={{ marginTop: 8, fontSize: 12, color: '#748094' }}>Realtime: {channelReady ? 'connected' : 'not connected'} · Role: {host ? 'host' : connected ? 'joined screen' : 'setup'}</div>
        </div>
      </div>
    </main>
  );
}
