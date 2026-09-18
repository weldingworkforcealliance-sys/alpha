import { createClient } from 'npm:@supabase/supabase-js@2';

type QueueRow = {
  queue_id: string;
  school_id: string;
  section_id: string;
  planner_day_id: string;
  event_type: string;
  recipient_user_id: string | null;
  recipient_email: string;
  scheduled_end_at: string;
  attempts: number;
};

type WorkerConfig = {
  resend_api_key: string | null;
  attendance_from_email: string | null;
};

function esc(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function formatEastern(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'Missing Supabase server configuration.' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const suppliedSecret = req.headers.get('x-attendance-cron-secret') ?? '';
  if (!suppliedSecret) return new Response('Unauthorized', { status: 401 });

  const { data: valid, error: secretError } = await supabase.rpc(
    'verify_attendance_worker_secret',
    { p_secret: suppliedSecret }
  );
  if (secretError || !valid) return new Response('Unauthorized', { status: 401 });

  const { data: configData, error: configError } = await supabase.rpc('get_attendance_worker_config');
  if (configError) return Response.json({ error: errorText(configError) }, { status: 500 });

  const config = (Array.isArray(configData) ? configData[0] : configData) as WorkerConfig | null;
  const apiKey = config?.resend_api_key ?? '';
  const from = config?.attendance_from_email ?? '';
  if (!apiKey || !from) {
    return Response.json({ error: 'Missing Resend sender configuration.' }, { status: 500 });
  }

  const { error: enqueueError } = await supabase.rpc('enqueue_class_watchdog_reminders');
  if (enqueueError) {
    return Response.json({ error: `enqueue: ${errorText(enqueueError)}` }, { status: 500 });
  }

  const { data: claimed, error: claimError } = await supabase.rpc(
    'claim_due_class_watchdog_reminders',
    { p_limit: 25 }
  );
  if (claimError) return Response.json({ error: errorText(claimError) }, { status: 500 });

  const rows = (claimed ?? []) as QueueRow[];
  const results: Array<{ queue_id: string; status: string; error?: string }> = [];

  for (const row of rows) {
    try {
      const [
        { data: section, error: sectionError },
        { data: day, error: dayError },
      ] = await Promise.all([
        supabase
          .from('sections')
          .select('section_name,section_code,course_id')
          .eq('id', row.section_id)
          .maybeSingle(),
        supabase
          .from('planner_days')
          .select('planner_day_number,scheduled_date')
          .eq('id', row.planner_day_id)
          .maybeSingle(),
      ]);

      if (sectionError) throw sectionError;
      if (dayError) throw dayError;
      if (!section || !day) throw new Error('Class or planner day not found.');

      let courseCode = 'Class';
      if (section.course_id) {
        const { data: course } = await supabase
          .from('courses')
          .select('course_code,course_name')
          .eq('id', section.course_id)
          .maybeSingle();
        courseCode = course?.course_code || course?.course_name || courseCode;
      }

      const sectionLabel = section.section_name || section.section_code || courseCode;
      const endTime = formatEastern(row.scheduled_end_at);
      const dashboardUrl = 'https://ltgeducation.com/dashboard';
      const attendanceUrl =
        `https://ltgeducation.com/attendance?section=${encodeURIComponent(row.section_id)}&date=${encodeURIComponent(day.scheduled_date)}`;

      const html = `<!doctype html>
<html>
  <body style="font-family:Arial,Helvetica,sans-serif;color:#17201f;background:#f3f6f5;padding:24px;">
    <div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #d7dfdd;border-radius:10px;padding:22px;">
      <h1 style="margin:0 0 8px;font-size:22px;">LTG Class Closeout Reminder</h1>
      <p style="margin:0 0 18px;color:#596864;">
        <strong>${esc(courseCode)}</strong> · ${esc(sectionLabel)} · Day ${esc(day.planner_day_number)}
      </p>
      <p>The scheduled class time ended at <strong>${esc(endTime)}</strong>, and LTG still shows the class day or required attendance as incomplete.</p>
      <p>Please close the class timer and complete attendance. This reminder is sent 30 minutes after the scheduled class end.</p>
      <p style="margin-top:22px;">
        <a href="${dashboardUrl}" style="display:inline-block;padding:10px 14px;border-radius:7px;background:#145d68;color:#fff;text-decoration:none;font-weight:700;margin-right:8px;">Open LTG Planner</a>
        <a href="${attendanceUrl}" style="display:inline-block;padding:10px 14px;border-radius:7px;background:#17663f;color:#fff;text-decoration:none;font-weight:700;">Open Attendance</a>
      </p>
      <p style="margin-top:20px;color:#72807c;font-size:11px;">Generated automatically by the Living Teacher Guide class-time watchdog.</p>
    </div>
  </body>
</html>`;

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `class-watchdog/${row.queue_id}`,
        },
        body: JSON.stringify({
          from,
          to: [row.recipient_email],
          subject: `LTG Closeout Reminder · ${courseCode} · ${sectionLabel}`,
          html,
        }),
        signal: AbortSignal.timeout(15000),
      });

      const body = await response.text();
      if (!response.ok) throw new Error(`Resend ${response.status}: ${body.slice(0, 1000)}`);

      const { error: markError } = await supabase
        .from('class_watchdog_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.queue_id)
        .eq('status', 'processing');
      if (markError) throw markError;

      results.push({ queue_id: row.queue_id, status: 'sent' });
    } catch (error) {
      const message = errorText(error);
      await supabase
        .from('class_watchdog_queue')
        .update({
          status: 'failed',
          last_error: message.slice(0, 2000),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.queue_id);
      results.push({ queue_id: row.queue_id, status: 'failed', error: message });
    }
  }

  return Response.json({ claimed: rows.length, results });
});
