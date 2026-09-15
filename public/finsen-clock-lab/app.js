const STORAGE_KEY = 'finsen-clock-lab-v2';
const FRAME_SOURCE = '/finsen-clock-lab/assets/finsen-sierra-approved-clock.png?v=approved-20260914-2344';

const defaultState = () => ({
  employee: {
    name: 'Alex Carter',
    department: 'PCCC Welding',
    role: 'Welding Instructor',
    number: '0350510'
  },
  entries: []
});

const el = (id) => document.getElementById(id);
const clockWrap = el('clockWrap');
const clockInBtn = el('clockInBtn');
const clockOutBtn = el('clockOutBtn');
const toast = el('toast');
const dialog = el('timeDialog');

let state = loadState();
let now = new Date();

async function loadFrame() {
  try {
    const frame = el('frameImage');
    frame.onload = () => {
      clockWrap.dataset.frameReady = 'true';
      el('qaFrame').textContent = 'APPROVED BRASS FRAME';
    };
    frame.onerror = () => {
      clockWrap.dataset.frameReady = 'false';
      el('qaFrame').textContent = 'FRAME LOAD ERROR';
      showToast('Approved brass frame could not be decoded.');
    };
    frame.src = FRAME_SOURCE;
  } catch (error) {
    clockWrap.dataset.frameReady = 'false';
    el('qaFrame').textContent = 'FRAME LOAD ERROR';
    showToast(error instanceof Error ? error.message : 'Unable to load approved brass frame');
  }
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.employee && Array.isArray(saved.entries)) return saved;
  } catch (_) {}
  return defaultState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function isSameLocalDay(value, day = new Date()) {
  const d = new Date(value);
  return todayKey(d) === todayKey(day);
}

function openEntry() {
  return [...state.entries].reverse().find((entry) => !entry.out) || null;
}

function todayEntries() {
  return state.entries.filter((entry) => isSameLocalDay(entry.in, now));
}

function totalMsToday() {
  return todayEntries().reduce((sum, entry) => {
    const start = new Date(entry.in).getTime();
    const end = entry.out ? new Date(entry.out).getTime() : now.getTime();
    return sum + Math.max(0, end - start);
  }, 0);
}

function formatDuration(ms) {
  const mins = Math.floor(ms / 60000);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2,'0')}m`;
}

function formatClock(value) {
  return new Date(value).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0,2).map((p) => p[0]?.toUpperCase() || '').join('') || 'LT';
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function renderClock() {
  now = new Date();
  const hour = now.getHours();
  const active = openEntry();
  const timeParts = now.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }).split(' ');

  el('greeting').textContent = `${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'},`;
  el('employeeName').textContent = state.employee.name;
  el('department').textContent = state.employee.department;
  el('employeeNumber').textContent = state.employee.number;
  el('role').textContent = state.employee.role;
  el('liveTime').textContent = timeParts[0];
  el('ampm').textContent = timeParts[1] || '';
  el('liveDate').textContent = now.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });

  el('avatar').textContent = initials(state.employee.name);
  el('footerName').textContent = state.employee.name;
  el('footerDepartment').textContent = state.employee.department;
  el('footerRole').textContent = state.employee.role;
  el('footerEmployee').textContent = state.employee.number;

  const statusValue = el('statusValue');
  clockWrap.dataset.clockedIn = active ? 'true' : 'false';
  statusValue.classList.toggle('on-site', Boolean(active));
  statusValue.innerHTML = `<i></i>${active ? 'Clocked In' : 'Clocked Out'}`;
  el('statusSince').textContent = active ? `Since ${formatClock(active.in)}` : 'Not currently punched in';
  el('todayTotal').textContent = formatDuration(totalMsToday());
  el('totalNote').textContent = active ? 'Time is running' : 'Recorded time today';

  clockInBtn.disabled = Boolean(active);
  clockOutBtn.disabled = !active;
  el('qaState').textContent = active ? 'CLOCKED IN' : 'CLOCKED OUT';
  el('qaEntries').textContent = String(todayEntries().length);
}

function clockIn() {
  if (openEntry()) return;
  state.entries.push({ in:new Date().toISOString(), out:null });
  saveState();
  renderClock();
  showToast('Clocked in. Sandbox entry created.');
}

function clockOut() {
  const active = openEntry();
  if (!active) return;
  active.out = new Date().toISOString();
  saveState();
  renderClock();
  showToast('Clocked out. Sandbox entry closed.');
}

function showTime() {
  const entries = todayEntries();
  const host = el('timeEntries');
  if (!entries.length) {
    host.innerHTML = '<div class="empty">No punches recorded in this browser today.</div>';
  } else {
    host.innerHTML = entries.map((entry) => {
      const end = entry.out ? new Date(entry.out) : now;
      const duration = Math.max(0, end.getTime() - new Date(entry.in).getTime());
      return `<div class="entry-row"><div><span>Clock In</span><br/><strong>${formatClock(entry.in)}</strong></div><div><span>Clock Out</span><br/><strong>${entry.out ? formatClock(entry.out) : 'Active'}</strong></div><div><span>Duration</span><br/><strong>${formatDuration(duration)}</strong></div></div>`;
    }).join('');
  }
  dialog.showModal();
}

function setScenarioIn() {
  const t = new Date(Date.now() - (2*60+17)*60000);
  state.entries = [{ in:t.toISOString(), out:null }];
  saveState();
  renderClock();
  showToast('Loaded clocked-in test scenario.');
}

function setScenarioOut() {
  const end = new Date(Date.now() - 24*60000);
  const start = new Date(end.getTime() - (2*60+17)*60000);
  state.entries = [{ in:start.toISOString(), out:end.toISOString() }];
  saveState();
  renderClock();
  showToast('Loaded clocked-out test scenario.');
}

function resetLab() {
  state = defaultState();
  saveState();
  renderClock();
  showToast('Sandbox reset.');
}

clockInBtn.addEventListener('click', clockIn);
clockOutBtn.addEventListener('click', clockOut);
el('viewTimeBtn').addEventListener('click', showTime);
el('closeDialog').addEventListener('click', () => dialog.close());
el('scenarioIn').addEventListener('click', setScenarioIn);
el('scenarioOut').addEventListener('click', setScenarioOut);
el('resetLab').addEventListener('click', resetLab);

void loadFrame();
renderClock();
setInterval(renderClock, 1000);
