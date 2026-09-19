import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export type TestRecord = {id: string; issued_at: string; snapshot: Record<string, unknown>};
export const testRecordFields = [
  ['Student', 'studentName'], ['Weld Test ID', 'weldTestId'], ['Course', 'courseCode'],
  ['Process', 'process'], ['Specification', 'specification'], ['Filler metal', 'fillerMetal'],
  ['Plate', 'plate'], ['Position', 'position'], ['Backing', 'backing'],
  ['Test method', 'testMethod'], ['Face bend', 'faceBendResult'], ['Root bend', 'rootBendResult'],
  ['Result', 'result'], ['Test date', 'testDate'], ['Inspector', 'inspector'],
] as const;

/** Render only the immutable saved snapshot. No current roster or editable form values. */
export async function createTestRecordPdf(record: TestRecord) {
  if (!record.id || !Number.isFinite(Date.parse(record.issued_at)) || record.snapshot.result !== 'Pass') {
    throw new Error('Invalid saved passing test record');
  }
  const require = createRequire(import.meta.url);
  const bytes = await readFile(require.resolve('@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff'));
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(bytes, {subset: true});
  const supported = new Set(font.getCharacterSet());
  const text = (value: unknown) => {
    if (value == null || value === '') return '-';
    if (typeof value !== 'string') throw new Error('Invalid test record field');
    const result = value.replace(/\s+/g, ' ').trim();
    if (result.length > 4000) throw new Error('Test record field is too long');
    if ([...result].some(c => !supported.has(c.codePointAt(0)!))) {
      throw new Error('This record needs an additional PDF font. Use the browser print option.');
    }
    return result || '-';
  };
  const issued = new Date(record.issued_at);
  pdf.setTitle('LTG Welding Test Record');
  pdf.setAuthor('LTG Education');
  pdf.setCreator('LTG test record template 1');
  pdf.setProducer('LTG Education');
  pdf.setCreationDate(issued);
  pdf.setModificationDate(issued);
  const ink = rgb(0.08, 0.16, 0.23), muted = rgb(0.32, 0.38, 0.43);
  let page = pdf.addPage([612, 792]);
  let y = 680;
  const header = () => {
    page.drawText('LTG EDUCATION', {x:48,y:744,size:11,font,color:muted});
    page.drawText('Welding Test Record', {x:48,y:711,size:25,font,color:ink});
    page.drawLine({start:{x:48,y:696},end:{x:564,y:696},thickness:2,color:ink});
  };
  header();
  const wrap = (value: string, width: number, size: number) => {
    const lines: string[] = []; let line = '';
    for (const character of value) {
      if (line && font.widthOfTextAtSize(line + character, size) > width) {
        lines.push(line.trimEnd()); line = '';
      }
      line += character;
    }
    if (line) lines.push(line.trimEnd());
    return lines;
  };
  const rows = [...testRecordFields.map(([label,key]) => [label,text(record.snapshot[key])]),
    ['Permanent record ID',text(record.id)], ['Issued (UTC)',issued.toISOString().slice(0,10)]];
  for (const [label,value] of rows) {
    const lines = wrap(value, 345, 10);
    let first = true;
    for (const line of lines) {
      if (y < 108) { page = pdf.addPage([612,792]); header(); y = 680; }
      if (first) page.drawText(label,{x:48,y,size:9,font,color:muted});
      page.drawText(line,{x:210,y,size:10,font,color:ink});
      first = false; y -= 15;
    }
    y -= 8;
    page.drawLine({start:{x:48,y:y+11},end:{x:564,y:y+11},thickness:0.4,color:rgb(.8,.83,.85)});
  }
  const pages = pdf.getPages();
  pages.forEach((p,i) => {
    p.drawText('Records the saved test evidence. Does not independently confer AWS certification.',
      {x:48,y:60,size:8,font,color:muted});
    p.drawText(`LTG test record v1 | Page ${i+1} of ${pages.length}`,{x:48,y:44,size:8,font,color:muted});
  });
  return pdf.save();
}


