from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise RuntimeError(f"Expected text not found in {path}: {old[:140]!r}")
    file.write_text(text.replace(old, new, 1))


# General Connected Classroom launcher.
path = Path("app/classroom/page.tsx")
text = path.read_text()

old_import = "import QRCode from 'qrcode';\nimport { createBrowserClient } from '@supabase/ssr';\n"
new_import = """import QRCode from 'qrcode';
import { getSupabase } from '@/lib/supabase-browser';
import {
  type ClassroomSession,
  type ClassroomSubmission,
  createClassroomSession,
  endClassroomSession,
  expireClassroomSessions,
  findActiveClassroomSession,
  loadClassroomSubmissions,
  subscribeClassroomSubmissions,
} from '@/lib/classroom-session';
"""
if old_import not in text:
    raise RuntimeError("General classroom imports did not match expected source")
text = text.replace(old_import, new_import, 1)
text, count = re.subn(r"type Session = \{[^\n]+\};\n", "type Session = ClassroomSession;\n", text, count=1)
if count != 1:
    raise RuntimeError("General Session type not found")
text, count = re.subn(r"type Submission = \{[^\n]+\};\n", "type Submission = ClassroomSubmission;\n", text, count=1)
if count != 1:
    raise RuntimeError("General Submission type not found")

old_client = "  const [supabase]=useState(()=>createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!));"
if old_client not in text:
    raise RuntimeError("General classroom client initialization not found")
text = text.replace(old_client, "  const [supabase]=useState(getSupabase);", 1)

text, count = re.subn(
    r"\n  const loadSubmissions=async\(sessionId:string\)=>\{.*?\n  \};\n\n  useEffect\(\(\)=>\{",
    "\n\n  useEffect(()=>{",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("General local loadSubmissions block not found")

old_expire = "        const {error:expireError}=await supabase.rpc('expire_classroom_sessions');\n        if(expireError) throw expireError;"
if old_expire not in text:
    raise RuntimeError("General expire call not found")
text = text.replace(old_expire, "        await expireClassroomSessions(supabase);", 1)

old_active = """        if(sectionIds.length&&(!hasRequestedContext||requestedContextIsValid)){
          let activeQuery=supabase.from('classroom_sessions')
            .select('id,join_code,status,started_at,expires_at,section_id,assessment_slug,expected_students')
            .eq('status','active')
            .gt('expires_at',new Date().toISOString())
            .in('section_id',sectionIds);

          if(validRequestedSection)activeQuery=activeQuery.eq('section_id',validRequestedSection);
          if(validRequestedAssessment)activeQuery=activeQuery.eq('assessment_slug',validRequestedAssessment);

          const {data:active,error:activeError}=await activeQuery.order('started_at',{ascending:false}).limit(1).maybeSingle();
          if(activeError)throw activeError;
          if(active){
            const restored=active as Session;
            setSession(restored);setSectionId(restored.section_id);setAssessmentSlug(restored.assessment_slug);setExpectedStudents(restored.expected_students);
          }
        }"""
new_active = """        if(sectionIds.length&&(!hasRequestedContext||requestedContextIsValid)){
          const restored=await findActiveClassroomSession(supabase,{
            sectionIds,
            sectionId:validRequestedSection??undefined,
            assessmentSlug:validRequestedAssessment??undefined,
          });
          if(restored){
            setSession(restored);setSectionId(restored.section_id);setAssessmentSlug(restored.assessment_slug);setExpectedStudents(restored.expected_students);
          }
        }"""
if old_active not in text:
    raise RuntimeError("General active session restore block not found")
text = text.replace(old_active, new_active, 1)

old_realtime = """    loadSubmissions(session.id).catch(e=>setError(e.message));
    const channel=supabase.channel(`classroom-${session.id}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'classroom_submissions',filter:`classroom_session_id=eq.${session.id}`},()=>loadSubmissions(session.id))
      .subscribe();
    return()=>{void supabase.removeChannel(channel);};"""
new_realtime = """    const refreshSubmissions=()=>loadClassroomSubmissions(supabase,session.id)
      .then(setSubmissions)
      .catch(e=>setError(e instanceof Error?e.message:String(e)));
    refreshSubmissions();
    return subscribeClassroomSubmissions(supabase,session.id,refreshSubmissions);"""
if old_realtime not in text:
    raise RuntimeError("General realtime block not found")
text = text.replace(old_realtime, new_realtime, 1)

old_start = """  const start=async()=>{
    if(!sectionId||!assessmentSlug)return;
    setBusy(true);setError('');
    try{
      const {data,error:e}=await supabase.rpc('start_classroom_session_v2',{p_section_id:sectionId,p_assessment_slug:assessmentSlug,p_expected_students:expectedStudents});
      if(e)throw e;
      const {data:row,error:re}=await supabase.from('classroom_sessions')
        .select('id,join_code,status,started_at,expires_at,section_id,assessment_slug,expected_students').eq('id',data).single();
      if(re)throw re;
      setSubmissions([]);setReport(null);setSession(row as Session);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  };"""
new_start = """  const start=async()=>{
    if(!sectionId||!assessmentSlug)return;
    setBusy(true);setError('');
    try{
      const created=await createClassroomSession(supabase,{sectionId,assessmentSlug,expectedStudents});
      setSubmissions([]);setReport(null);setSession(created);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  };"""
if old_start not in text:
    raise RuntimeError("General session start block not found")
text = text.replace(old_start, new_start, 1)

old_end = """  const end=async()=>{
    if(!session)return;
    setBusy(true);setError('');
    const {error:e}=await supabase.rpc('end_classroom_session',{p_session_id:session.id});
    setBusy(false);
    if(e)setError(e.message);else setSession({...session,status:'ended'});
  };"""
new_end = """  const end=async()=>{
    if(!session)return;
    setBusy(true);setError('');
    try{
      await endClassroomSession(supabase,session.id);
      setSession({...session,status:'ended'});
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  };"""
if old_end not in text:
    raise RuntimeError("General session end block not found")
text = text.replace(old_end, new_end, 1)
path.write_text(text)


# Planner-locked assessment launcher.
path = Path("app/classroom/planner/page.tsx")
text = path.read_text()
old_import = "import QRCode from 'qrcode';\nimport { createBrowserClient } from '@supabase/ssr';\n"
new_import = """import QRCode from 'qrcode';
import { getSupabase } from '@/lib/supabase-browser';
import {
  type ClassroomSession,
  type ClassroomSubmission,
  createClassroomSession,
  endClassroomSession,
  expireClassroomSessions,
  findActiveClassroomSession,
  loadClassroomSubmissions,
  subscribeClassroomSubmissions,
} from '@/lib/classroom-session';
"""
if old_import not in text:
    raise RuntimeError("Planner classroom imports did not match expected source")
text = text.replace(old_import, new_import, 1)
text, count = re.subn(r"type Session = \{.*?\n\};\n\n", "type Session = ClassroomSession;\n\n", text, count=1, flags=re.S)
if count != 1:
    raise RuntimeError("Planner Session type not found")
text, count = re.subn(r"type Submission = \{.*?\n\};\n\n", "type Submission = ClassroomSubmission;\n\n", text, count=1, flags=re.S)
if count != 1:
    raise RuntimeError("Planner Submission type not found")

old_client = """  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  );"""
if old_client not in text:
    raise RuntimeError("Planner classroom client initialization not found")
text = text.replace(old_client, "  const [supabase] = useState(getSupabase);", 1)

text, count = re.subn(
    r"\n  const loadSubmissions = async \(sessionId: string\) => \{.*?\n  \};\n\n  useEffect\(\(\) => \{",
    "\n\n  useEffect(() => {",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("Planner local loadSubmissions block not found")

old_expire = "        const { error: expireError } = await supabase.rpc('expire_classroom_sessions');\n        if (expireError) throw expireError;"
if old_expire not in text:
    raise RuntimeError("Planner expire call not found")
text = text.replace(old_expire, "        await expireClassroomSessions(supabase);", 1)

old_active = """        const { data: active, error: activeError } = await supabase
          .from('classroom_sessions')
          .select('id,join_code,status,started_at,expires_at,section_id,assessment_slug,expected_students')
          .eq('section_id', requestedSection)
          .eq('assessment_slug', requestedAssessment)
          .eq('status', 'active')
          .gt('expires_at', new Date().toISOString())
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeError) throw activeError;
        if (active && alive) {
          const restored = active as Session;
          setSession(restored);
          setExpectedStudents(restored.expected_students);
        }"""
new_active = """        const restored = await findActiveClassroomSession(supabase, {
          sectionId: requestedSection,
          assessmentSlug: requestedAssessment,
        });

        if (restored && alive) {
          setSession(restored);
          setExpectedStudents(restored.expected_students);
        }"""
if old_active not in text:
    raise RuntimeError("Planner active session restore block not found")
text = text.replace(old_active, new_active, 1)

old_realtime = """    loadSubmissions(session.id).catch((err) =>
      setError(err instanceof Error ? err.message : String(err))
    );

    const channel = supabase
      .channel(`planner-classroom-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'classroom_submissions',
          filter: `classroom_session_id=eq.${session.id}`,
        },
        () => loadSubmissions(session.id)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };"""
new_realtime = """    const refreshSubmissions = () =>
      loadClassroomSubmissions(supabase, session.id)
        .then(setSubmissions)
        .catch((err) => setError(err instanceof Error ? err.message : String(err)));

    refreshSubmissions();
    return subscribeClassroomSubmissions(
      supabase,
      session.id,
      refreshSubmissions,
      'planner-classroom'
    );"""
if old_realtime not in text:
    raise RuntimeError("Planner realtime block not found")
text = text.replace(old_realtime, new_realtime, 1)

start_pattern = re.compile(r"  const startAssessment = async \(\) => \{.*?\n  \};\n\n  const endAssessment", re.S)
start_replacement = """  const startAssessment = async () => {
    if (!section || !assessment) return;

    setBusy(true);
    setError('');
    setNotice('');

    try {
      const created = await createClassroomSession(supabase, {
        sectionId: section.section_id,
        assessmentSlug: assessment.slug,
        expectedStudents,
      });
      setSubmissions([]);
      setSession(created);
      setNotice('Assessment is live. Students may scan the QR code now.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start this assessment.');
    } finally {
      setBusy(false);
    }
  };

  const endAssessment"""
text, count = start_pattern.subn(start_replacement, text, count=1)
if count != 1:
    raise RuntimeError("Planner session start block not found")

end_pattern = re.compile(r"  const endAssessment = async \(\) => \{.*?\n  \};\n\n  if \(loading\)", re.S)
end_replacement = """  const endAssessment = async () => {
    if (!session) return;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      await endClassroomSession(supabase, session.id);
      setSession({ ...session, status: 'ended' });
      setQr('');
      setNotice('Assessment session ended. The student join code is no longer valid.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to end this assessment.');
    } finally {
      setBusy(false);
    }
  };

  if (loading)"""
text, count = end_pattern.subn(end_replacement, text, count=1)
if count != 1:
    raise RuntimeError("Planner session end block not found")
path.write_text(text)

print("Classroom service refactor applied to both launchers.")
