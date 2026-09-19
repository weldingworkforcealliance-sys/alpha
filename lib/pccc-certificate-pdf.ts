import {PDFDocument, StandardFonts, rgb} from 'pdf-lib';
import type {TestRecord} from './tower-test-record-pdf';

export const PCCC_SCHOOL_ID = '08ccb452-83ab-482f-bb28-5576e02741b2';
export function usesPcccCertificate(schoolId: string, snapshot: Record<string, unknown>) {
  return schoolId === PCCC_SCHOOL_ID && snapshot.result === 'Pass'
    && snapshot.faceBendResult === 'Satisfactory' && snapshot.rootBendResult === 'Satisfactory'
    && typeof snapshot.testMethod === 'string' && /^guided\s+bend(?:\s+test)?$/i.test(snapshot.testMethod.trim());
}

export async function createPcccCertificate(record: TestRecord, background: Uint8Array) {
  if (!usesPcccCertificate(PCCC_SCHOOL_ID,record.snapshot)) throw new Error('The PCCC template requires a passing guided bend test');
  const pdf=await PDFDocument.load(background);
  const page=pdf.getPages()[0];
  const font=await pdf.embedFont(StandardFonts.TimesRomanBold);
  const small=await pdf.embedFont(StandardFonts.Helvetica);
  const signatureFont=await pdf.embedFont(StandardFonts.TimesRomanBoldItalic);
  const field=(key:string)=>{
    const value=record.snapshot[key];
    if(typeof value!=='string'||!value.trim())throw new Error('Incomplete certificate evidence');
    return value.trim().replace(/\s+/g,' ');
  };
  const draw=(value:string,x:number,top:number,width:number,size:number,min=9)=>{
    while(font.widthOfTextAtSize(value,size)>width&&size>min)size-=.25;
    if(font.widthOfTextAtSize(value,size)>width)throw new Error('Certificate field exceeds template space');
    page.drawText(value,{x,y:612-top,size,font,color:rgb(0,0,0)});
  };
  draw(`Welding Operator: ${field('studentName')}`,107.5,178,570,23,12);
  const backing=field('backing');
  const rows=[['Welding Process:',field('process')],['Specification:',field('specification')],
    ['Filler Metal:',field('fillerMetal')],['Backing Strip Used:',backing==='Backing'?'YES':backing==='No Backing'?'NO':backing],
    ['Plate:',field('plate')],['Welding position:',field('position')]];
  rows.forEach(([label,value],i)=>{draw(label,107.5,198+i*19.1,165,15);draw(value,270,198+i*19.1,150,15);});
  draw('SATISFACTORY',464,404,84,10.3);
  draw('SATISFACTORY',464,449,84,10.3);
  const detail=(label:string,value:string,x:number,top:number,width:number)=>{
    page.drawText(label,{x,y:612-top,size:8,font:small,color:rgb(.25,.25,.25)});
    draw(value,x,top+15,width,11,8);
    page.drawLine({start:{x,y:612-top-20},end:{x:x+width,y:612-top-20},thickness:.5,color:rgb(.5,.5,.5)});
  };
  detail('STUDENT WELD TEST ID #',field('weldTestId'),435,195,220);
  detail('TEST DATE',field('testDate'),435,229,220);
  detail('INSPECTOR',field('inspector'),435,263,220);
  const trace=`PERMANENT RECORD # ${record.id}`;
  if(small.widthOfTextAtSize(trace,8)>570)throw new Error('Record identifier exceeds template space');
  page.drawText(trace,{x:107.5,y:480,size:8,font:small,color:rgb(.2,.2,.2)});
  const signature='Anthony Ruffino';
  page.drawText(signature,{x:198.5-signatureFont.widthOfTextAtSize(signature,17)/2,y:56,size:17,font:signatureFont,color:rgb(0,0,0)});
  const issued=new Date(record.issued_at);
  if(!Number.isFinite(issued.getTime()))throw new Error('Invalid issue date');
  pdf.setTitle('PCCC Welding Test Certificate');pdf.setAuthor('Passaic County Community College');
  pdf.setCreator('LTG PCCC certificate template 2');pdf.setProducer('LTG Education');
  pdf.setCreationDate(issued);pdf.setModificationDate(issued);
  return pdf.save();
}

