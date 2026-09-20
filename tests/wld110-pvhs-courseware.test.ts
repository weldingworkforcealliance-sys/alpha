// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const html=readFileSync(join(process.cwd(),'public/resources/wld110/pvhs-courseware.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)![1];
const days=JSON.parse(html.match(/const DAYS=(\[[\s\S]*?\]);/)![1]) as Array<{
  day:number;title:string;objective:string;safety:string;slides:Record<string,number[]>;
}>;
const manifest=JSON.parse(readFileSync(join(process.cwd(),'docs/WLD110_SLIDE_ASSET_MANIFEST.json'),'utf8')) as Array<{chapter_key:string;slide_number:number}>;

function withPage(query:string,hash:string,check:()=>void){
  window.history.replaceState(null,'','/resources/wld110/pvhs-courseware.html'+query+hash);
  document.documentElement.innerHTML=html;
  const listeners=vi.spyOn(window,'addEventListener');
  try {new Function('document','window','location',script)(document,window,window.location);check();}
  finally {for(const [type,listener] of listeners.mock.calls)window.removeEventListener(type,listener);listeners.mockRestore();}
}

describe('PVHS B/C 55-day original courseware',()=>{
  it('covers all 55 guide days and exactly the previously loaded 77 original slides',()=>{
    expect(days.map(d=>d.day)).toEqual(Array.from({length:55},(_,i)=>i+1));
    const selected=new Set(days.flatMap(d=>Object.entries(d.slides).flatMap(([chapter,slides])=>slides.map(n=>chapter+':'+n))));
    expect([...selected].sort()).toEqual(manifest.map(a=>a.chapter_key+':'+a.slide_number).sort());
    expect(days[49].title).toContain('Cube 1 of 6');
    expect(days[54].title).toContain('Cube 6 of 6');
  });
  describe.each(['safety','smaw','ofc'])('%s',chapter=>{
    it.each(days)('renders PVHS day $day with original chapter images and intact day context',day=>{
      withPage('?chapter='+chapter,'#day-'+day.day,()=>{
        expect(document.querySelectorAll('#daySelect option')).toHaveLength(55);
        expect(document.getElementById('title')!.textContent).toBe(day.title);
        expect(document.getElementById('objective')!.textContent).toBe(day.objective);
        expect(document.getElementById('dayLabel')!.textContent).toBe('Day '+day.day+' of 55');
        const images=[...document.querySelectorAll<HTMLImageElement>('#fullSlides img')];
        expect(images.map(i=>i.getAttribute('src'))).toEqual(day.slides[chapter].map(n=>'/api/wld110-courseware-slide?chapter='+chapter+'&slide='+n));
        expect(new Set(day.slides[chapter]).size).toBe(day.slides[chapter].length);
        expect(images.length).toBeGreaterThanOrEqual(3);
        expect(images.every(i=>i.width===1920&&i.height===1440&&i.alt.includes('original slide'))).toBe(true);
        for(const link of document.querySelectorAll<HTMLAnchorElement>('[data-chapter]'))expect(link.getAttribute('href')).toBe('?chapter='+link.dataset.chapter+'#day-'+day.day);
        expect((document.getElementById('prev') as HTMLButtonElement).disabled).toBe(day.day===1);
        expect((document.getElementById('next') as HTMLButtonElement).disabled).toBe(day.day===55);
        expect(document.getElementById('cubeApproval')!.hidden).toBe(day.day<50);
        expect([...document.querySelectorAll('a')].every(a=>a.getAttribute('href')?.trim())).toBe(true);
      });
    });
  });
  it('shows an instructor sign-in message when an image request fails',()=>{
    withPage('?chapter=ofc','#day-55',()=>{
      document.querySelector('img')!.dispatchEvent(new Event('error'));
      expect(document.getElementById('accessMessage')!.hidden).toBe(false);
      expect(document.getElementById('signIn')!.getAttribute('href')).toContain(encodeURIComponent('/resources/wld110/pvhs-courseware.html?chapter=ofc#day-55'));
    });
  });
  it.each([['?chapter=unknown','#day-99','55'],['?chapter=__proto__','#day-0','1'],['','#wrong','1']])('keeps invalid navigation inside the licensed schedule', (query,hash,expected)=>{
    withPage(query,hash,()=>{
      expect((document.getElementById('daySelect') as HTMLSelectElement).value).toBe(expected);
      expect(document.querySelector('img')!.getAttribute('src')).toContain('chapter=safety&slide=');
    });
  });
});
