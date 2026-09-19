import {createSupabaseServerClient} from '@/lib/supabase-server';
import {notFound,redirect} from 'next/navigation';
import PrintButton from './print-button';
export default async function CertificatePage({params}:{params:Promise<{testId:string}>}){
 const {testId}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(testId))notFound();
 const client=await createSupabaseServerClient();
 const {data:auth,error:authError}=await client.auth.getUser();
 if(authError||!auth.user)redirect('/login');
 const {data,error}=await client.from('tower_certificates').select('id,snapshot,issued_at').eq('test_id',testId).maybeSingle();
 if(error)throw new Error('The certificate could not be loaded. Try again.');
 if(!data)notFound();
 const s=data.snapshot as Record<string,string>;
 const fields=[['Student',s.studentName],['Weld Test ID',s.weldTestId],['Course',s.courseCode],['Process',s.process],['Specification',s.specification],['Filler metal',s.fillerMetal],['Plate',s.plate],['Position',s.position],['Backing',s.backing],['Test method',s.testMethod],['Face bend',s.faceBendResult],['Root bend',s.rootBendResult],['Result',s.result],['Test date',s.testDate],['Inspector',s.inspector]];
 return <main><style>{'@media print { body * {visibility:hidden} #tower-certificate,#tower-certificate * {visibility:visible} #tower-certificate {position:absolute;inset:0;background:white;color:black;padding:30px} .no-print {display:none} }'}</style>
 <div className="no-print"><a href="/tower">Back to Tower</a><PrintButton/></div>
 <article id="tower-certificate" style={{maxWidth:850,margin:'24px auto',padding:36,border:'2px solid currentColor'}}>
 <h1>Welding Test Record</h1><p>Permanent record of a passing destructive test</p>
 <dl>{fields.map(([label,value])=><div key={label} style={{display:'grid',gridTemplateColumns:'180px 1fr',padding:7,borderBottom:'1px solid #999'}}><dt>{label}</dt><dd>{value||'—'}</dd></div>)}</dl>
 <p>Record: {data.id}</p><p>Issued: {new Date(data.issued_at).toLocaleDateString('en-US')}</p>
 <p>This records the test evidence shown above. It does not independently confer AWS certification.</p>
 </article></main>;
}

