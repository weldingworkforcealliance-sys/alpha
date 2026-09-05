import { createClient } from 'npm:@supabase/supabase-js@2';

type Delivery = {
  id: string;
};

type StudentRow = {
  student_name: string;
  student_id: string | null;
  status: string;
  arrival_time: string | null;
  departure_time: string | null;
  note: string | null;
};

type ReportPayload = {
  delivery_id: string;
  recipient_email: string;
  cc_emails: string[];
  delivery_kind: string;
  school_name: string;
  group_name: string;
  group_code: string | null;
  attendance_date: string;
  revision: number;
  courses: string[];
  totals: Record<string, number> | null;
  students: StudentRow[];
};

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function reportHtml(report: ReportPayload) {
  const rows = report.students
    .map(
      (student) => `
        <tr>
          <td>${escapeHtml(student.student_name)}</td>
          <td>${escapeHtml(student.student_id || '—')}</td>
          <td><strong>${escapeHtml(titleCase(student.status))}</strong></td>
          <td>${escapeHtml(student.arrival_time || '—')}</td>
          <td>${escapeHtml(student.departure_time || '—')}</td>
          <td>${escapeHtml(student.note || '')}</td>
        </tr>`
    )
    .join('');
  const totals = Object.entries(report.totals ?? {})
    .map(([status, count]) => `<span style="margin-right:16px"><strong>${escapeHtml(count)}</strong> ${escapeHtml(titleCase(status))}</span>`)
    .join('');

  return `<!doctype html>
  <html><body style="font-family:Arial,sans-serif;color:#172027;line-height:1.4">
    <div style="max-width:900px;margin:0 auto">
      <div style="border-bottom:4px solid #13795b;padding-bottom:12px">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#13795b;font-weight:700">Living Teacher Guide</div>
        <h1 style="margin:5px 0">Daily Student Attendance Report</h1>
        <p style="margin:0;color:#53636c">${escapeHtml(report.school_name)}</p>
      </div>
      <table style="margin:18px 0;border-collapse:collapse">
        <tr><td style="padding:3px 18px 3px 0;color:#64747c">Date</td><td><strong>${escapeHtml(report.attendance_date)}</strong></td></tr>
        <tr><td style="padding:3px 18px 3px 0;color:#64747c">Class</td><td><strong>${escapeHtml(report.group_name)}</strong></td></tr>
        <tr><td style="padding:3px 18px 3px 0;color:#64747c">Courses</td><td>${escapeHtml(report.courses.join(' / '))}</td></tr>
        <tr><td style="padding:3px 18px 3px 0;color:#64747c">Revision</td><td>${escapeHtml(report.revision)}${report.delivery_kind === 'correction' ? ' — Corrected Report' : ''}</td></tr>
      </table>
      <div style="padding:12px;background:#edf7f3;border:1px solid #bddfd2;border-radius:6px;margin-bottom:18px">${totals}</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#172027;color:white">
          <th style="padding:9px;text-align:left">Student</th><th style="padding:9px;text-align:left">ID</th>
          <th style="padding:9px;text-align:left">Status</th><th style="padding:9px;text-align:left">Arrival</th>
          <th style="padding:9px;text-align:left">Departure</th><th style="padding:9px;text-align:left">Note</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:22px;padding-top:12px;border-top:1px solid #cbd5da;color:#667780;font-size:11px">
        Confidential student attendance record. Handle and retain according to school policy.
      </p>
    </div>
  </body></html>`;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const resendKey = Deno.env.get('RESEND_API_KEY');
const fromEmail = Deno.env.get('ATTENDANCE_FROM_EMAIL');
const cronSecret = Deno.env.get('ATTENDANCE_CRON_SECRET');

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const suppliedSecret = request.headers.get('x-attendance-cron-secret');
  if (!cronSecret || suppliedSecret !== cronSecret) return new Response('Unauthorized', { status: 401 });
  if (!supabaseUrl || !serviceRoleKey || !resendKey || !fromEmail) {
    return Response.json({ error: 'Attendance email secrets are incomplete' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: claimed, error: claimError } = await supabase.rpc('claim_due_attendance_reports', {
    p_limit: 20,
  });
  if (claimError) return Response.json({ error: claimError.message }, { status: 500 });

  const results: Array<{ id: string; status: string; error?: string }> = [];
  for (const delivery of (claimed ?? []) as Delivery[]) {
    try {
      const { data, error: payloadError } = await supabase.rpc('attendance_report_payload', {
        p_delivery_id: delivery.id,
      });
      if (payloadError) throw payloadError;
      const report = data as ReportPayload;
      if (!report?.recipient_email) throw new Error('Attendance report payload is incomplete');

      const subjectPrefix = report.delivery_kind === 'correction' ? 'CORRECTED — ' : '';
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [report.recipient_email],
          cc: report.cc_emails,
          subject: `${subjectPrefix}${report.group_name} Attendance — ${report.attendance_date}`,
          html: reportHtml(report),
        }),
      });
      const emailResult = await emailResponse.json();
      if (!emailResponse.ok) throw new Error(emailResult?.message || `Email provider returned ${emailResponse.status}`);

      const { error: completeError } = await supabase.rpc('complete_attendance_report', {
        p_delivery_id: delivery.id,
        p_provider_message_id: emailResult.id ?? null,
        p_error: null,
      });
      if (completeError) throw completeError;
      results.push({ id: delivery.id, status: 'sent' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await supabase.rpc('complete_attendance_report', {
        p_delivery_id: delivery.id,
        p_provider_message_id: null,
        p_error: message,
      });
      results.push({ id: delivery.id, status: 'failed', error: message });
    }
  }

  return Response.json({ claimed: results.length, results });
});
