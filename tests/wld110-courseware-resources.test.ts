// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const chapters = [
  { key: 'ofc', file: 'ofc-shop-reference.html', count: 28, total: 103 },
  { key: 'smaw', file: 'smaw-shop-reference.html', count: 23, total: 80 },
  { key: 'safety', file: 'welding-safety-courseware-guide.html', count: 26, total: 61 },
];

describe.each(chapters)('$key original courseware day assignments', chapter => {
  const html = readFileSync(join(process.cwd(),'public/resources/wld110',chapter.file),'utf8');
  const mapping = JSON.parse(html.match(/const FULL_SLIDES=(\{[\s\S]*?\});/)![1]) as Record<string,number[]>;
  it('has a complete mapping and the expected source slide inventory', () => {
    expect(Object.keys(mapping).map(Number)).toEqual(Array.from({length:23},(_,i)=>i+1));
    expect(new Set(Object.values(mapping).flat()).size).toBe(chapter.count);
    expect(Object.values(mapping).flat().every(n=>Number.isInteger(n)&&n>0&&n<=chapter.total)).toBe(true);
  });
  it.each(Array.from({length:23},(_,i)=>i+1))('renders day %i with the correct private full-slide links', day => {
    window.history.replaceState(null,'',`/resources/wld110/${chapter.file}#day-${day}`);
    document.documentElement.innerHTML = html;
    const listenerSpy = vi.spyOn(window,'addEventListener');
    try {
      const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
      new Function('window','document','location',script)(window,document,window.location);
      expect(document.getElementById('daySelect')!.getAttribute('aria-label') || document.getElementById('daySelect')!.getAttribute('title')).toBeTruthy();
      expect((document.getElementById('daySelect') as HTMLSelectElement).value).toBe(String(day));
      const images = Array.from(document.querySelectorAll<HTMLImageElement>('#fullSlides img'));
      expect(images).toHaveLength(mapping[day].length);
      expect(images.length).toBeGreaterThan(0);
      expect(mapping[day].length).toBe(new Set(mapping[day]).size);
      const ranges = document.getElementById('slides')!.textContent!.replace('slides ','').split(',').map(p=>p.trim().split(/[–-]/).map(Number));
      for (const [i,img] of images.entries()) {
        expect(img.getAttribute('src')).toBe(`/api/wld110-courseware-slide?chapter=${chapter.key}&slide=${mapping[day][i]}`);
        expect(img.closest('a')!.getAttribute('href')).toBe(img.getAttribute('src'));
        expect(img.alt).toContain(`original slide ${mapping[day][i]}`);
        expect(ranges.some(([a,b=a])=>mapping[day][i]>=a&&mapping[day][i]<=b)).toBe(true);
      }
      expect(Array.from(document.querySelectorAll('a')).every(a=>Boolean(a.getAttribute('href')?.trim()))).toBe(true);
      expect((document.getElementById('prev') as HTMLButtonElement).disabled).toBe(day===1);
      expect((document.getElementById('next') as HTMLButtonElement).disabled).toBe(day===23);
    } finally {
      for (const [type,listener] of listenerSpy.mock.calls) window.removeEventListener(type,listener);
      listenerSpy.mockRestore();
    }
  });
});
