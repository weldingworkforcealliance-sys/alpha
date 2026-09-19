import {describe,expect,it} from 'vitest';
import {CATEGORIES,COMPETENCIES,PACING,cleanTags,defaultRatings,gradeTotal,qualifies,sortedQueue,type Ratings,type ShopStudent} from '../lib/wld110-shop';
import {WELD_SIZER} from '../lib/weld-sizer';
describe('WLD 110 approved grading and progression',()=>{
 it.each([[20,100],[18,90],[16,80],[12,60]] as const)('scores all %s ratings as %s', (value,total)=>{
  const ratings=Object.fromEntries(CATEGORIES.map(c=>[c.key,value])) as Ratings;
  expect(gradeTotal(ratings)).toBe(total);
 });
 it('starts Good, without sharing mutable forms',()=>{
  const first=defaultRatings();first.placement=12;
  expect(defaultRatings().placement).toBe(18);
  expect(gradeTotal(defaultRatings())).toBe(90);
 });
 it('rejects missing, extra and invented ratings',()=>{
  for(const ratings of [{...defaultRatings(),placement:17},{...defaultRatings(),extra:18},{straightness:18}])
   expect(()=>gradeTotal(ratings as Ratings)).toThrow();
 });
 it('requires every later category Acceptable even if the total improves',()=>{
  const baseline:Ratings={straightness:18,placement:18,execution:18,consistency:16,weldSize:16};
  expect(gradeTotal(baseline)).toBe(86);
  expect(qualifies(baseline,{straightness:20,placement:20,execution:20,consistency:20,weldSize:12})).toBe(false);
  expect(qualifies(baseline,{straightness:18,placement:16,execution:16,consistency:16,weldSize:16})).toBe(false);
  expect(qualifies(baseline,defaultRatings())).toBe(true);
  expect(qualifies(defaultRatings(),defaultRatings())).toBe(true);
 });
 it('retains tags only for current deficiencies',()=>{
  expect(cleanTags({...defaultRatings(),execution:12},{execution:['Travel speed'],placement:['Joint alignment']})).toEqual({execution:['Travel speed']});
 });
 it('has eight core competencies followed by advanced 2G, and 23 pacing nights',()=>{
  expect(COMPETENCIES.map(c=>c.position+' '+c.electrode)).toEqual([
   'Flat E6010','Flat E7018','2F E6010','2F E7018','3F vertical-up E6010','3F vertical-up E7018','4F E6010','4F E7018','Advanced 2G with backing E7018',
  ]);
  expect(PACING).toHaveLength(23);
  expect(COMPETENCIES[0].coupon).toBe('3/8 × 3 × 6 in plate');
  expect(COMPETENCIES.slice(2,8).every(c=>c.coupon.includes('centered top and bottom; four 6-inch'))).toBe(true);
 });
 it('preserves the existing sizer reference unchanged',()=>{
  expect(WELD_SIZER.help).toBe('1/8" rod: 3/16" min · 1/4" target · 3/8" max');
  expect(WELD_SIZER.choices).toEqual([[20,'1/4" target'],[18,'Near target'],[16,'Acceptable'],[14,'At limit'],[10,'Outside range']]);
 });
 it('sorts check requests FIFO ahead of practice',()=>{
  const rows=[{display_name:'A',requested_at:null},{display_name:'C',requested_at:'2026-09-19T12:00:00Z'},{display_name:'B',requested_at:'2026-09-19T11:00:00Z'}] as ShopStudent[];
  expect(sortedQueue(rows).map(s=>s.display_name)).toEqual(['B','C','A']);
  expect(rows[0].display_name).toBe('A');
 });
});
