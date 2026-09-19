import {describe,it,expect} from 'vitest';
import {PDFDocument} from 'pdf-lib';
import {mkdir,writeFile} from 'node:fs/promises';
import {createTestRecordPdf} from '../lib/tower-test-record-pdf';

const record = {id:'00000000-0000-4000-8000-000000000005',issued_at:'2026-09-19T12:00:00Z',snapshot:{
  studentName:'Synthetic Student - José Example',weldTestId:'0005',courseCode:'WLD 210',
  process:'SMAW',specification:'Synthetic demonstration',fillerMetal:'E7018',plate:'3/8 inch',
  position:'3G',backing:'Steel',testMethod:'Guided bend',faceBendResult:'Satisfactory',
  rootBendResult:'Satisfactory',result:'Pass',testDate:'2026-09-19',inspector:'Synthetic Inspector',
}};
describe('saved welding test PDF',()=>{
  it('creates a reproducible printable record with stable issued date',async()=>{
    const bytes=await createTestRecordPdf(record);
    expect(bytes).toEqual(await createTestRecordPdf(record));
    const pdf=await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getCreationDate()!.toISOString()).toBe(record.issued_at.replace('Z','.000Z'));
    await mkdir('output/pdf',{recursive:true});
    await writeFile('output/pdf/LTG-synthetic-test-record.pdf',bytes);
  });
  it('paginates long evidence instead of cutting it off',async()=>{
    const bytes=await createTestRecordPdf({...record,snapshot:{...record.snapshot,specification:'Evidence '.repeat(440)}});
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });
  it('rejects nonpassing and malformed saved records',async()=>{
    await expect(createTestRecordPdf({...record,snapshot:{result:'Fail'}})).rejects.toThrow();
    await expect(createTestRecordPdf({...record,issued_at:'invalid'})).rejects.toThrow();
  });
  it('does not silently replace unsupported student-name characters',async()=>{
    await expect(createTestRecordPdf({...record,snapshot:{...record.snapshot,studentName:'学生'}})).rejects.toThrow('additional PDF font');
  });
});

