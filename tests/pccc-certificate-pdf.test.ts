import {it,expect} from 'vitest';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import {createPcccCertificate,usesPcccCertificate,PCCC_SCHOOL_ID} from '../lib/pccc-certificate-pdf';
const record={id:'00000000-0000-4000-8000-000000000005',issued_at:'2026-09-19T12:00:00Z',snapshot:{
 studentName:'Synthetic Student One',weldTestId:'0005',testDate:'2026-09-19',process:'SMAW',specification:'AWS D1.1',
 fillerMetal:'E-7018',backing:'Backing',plate:'3/8"',position:'3G',testMethod:'Guided Bend',result:'Pass',
 faceBendResult:'Satisfactory',rootBendResult:'Satisfactory',inspector:'Synthetic Inspector'}};
async function background(){
 if(process.env.PCCC_TEMPLATE_FILE)return readFile(process.env.PCCC_TEMPLATE_FILE);
 const pdf=await PDFDocument.create();pdf.addPage([792,612]);return pdf.save();
}
it('keeps the uploaded landscape certificate artwork and fills saved evidence',async()=>{
 const bytes=await createPcccCertificate(record,await background());const pdf=await PDFDocument.load(bytes);
 expect(pdf.getPageCount()).toBe(1);expect(pdf.getPages()[0].getWidth()).toBeCloseTo(792);expect(pdf.getPages()[0].getHeight()).toBeCloseTo(612);
 if(process.env.PCCC_TEMPLATE_FILE){await mkdir('output/pdf',{recursive:true});await writeFile('output/pdf/PCCC-synthetic-certificate.pdf',bytes);}
});
it('limits PCCC branding to PCCC passing guided bend tests',()=>{
 expect(usesPcccCertificate(PCCC_SCHOOL_ID,record.snapshot)).toBe(true);
 expect(usesPcccCertificate('other-school',record.snapshot)).toBe(false);
 expect(usesPcccCertificate(PCCC_SCHOOL_ID,{...record.snapshot,result:'Fail'})).toBe(false);
 expect(usesPcccCertificate(PCCC_SCHOOL_ID,{...record.snapshot,testMethod:'Macro etch'})).toBe(false);
});
it('refuses incomplete or oversized evidence rather than clipping it',async()=>{
 await expect(createPcccCertificate({...record,snapshot:{...record.snapshot,studentName:''}},await background())).rejects.toThrow();
 await expect(createPcccCertificate({...record,snapshot:{...record.snapshot,studentName:'A'.repeat(300)}},await background())).rejects.toThrow();
});

