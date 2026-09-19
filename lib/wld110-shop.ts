export const RATINGS = [
  {label: 'Excellent', points: 20}, {label: 'Good', points: 18},
  {label: 'Acceptable', points: 16}, {label: 'Needs Work', points: 12},
] as const;
export const CATEGORIES = [
  {key: 'straightness', label: 'Straightness', tags: ['Wandering bead', 'Line control']},
  {key: 'placement', label: 'Placement', tags: ['Bead placement', 'Joint alignment', 'Toe placement']},
  {key: 'execution', label: 'Execution', tags: ['Arc length', 'Travel speed', 'Work angle', 'Travel angle', 'Manipulation', 'Starts/stops']},
  {key: 'consistency', label: 'Consistency / Workmanship', tags: ['Toe tie-in', 'Undercut', 'Overlap', 'Porosity', 'Slag', 'Cleaning', 'Uneven profile']},
  {key: 'weldSize', label: 'Weld Size / Profile', tags: ['Too wide', 'Too narrow', 'Profile', 'Dimensional issue']},
] as const;
export type Category = typeof CATEGORIES[number]['key'];
export type Ratings = Record<Category, 12 | 16 | 18 | 20>;
export type Tags = Partial<Record<Category, string[]>>;
export const defaultRatings = (): Ratings => ({straightness:18, placement:18, execution:18, consistency:18, weldSize:18});
const flat = '3/8 × 3 × 6 in plate';
const cruciform = 'Cruciform: one 3/8 × 3 × 6 in horizontal plate; two 3/8 × 2 × 6 in vertical plates centered top and bottom; four 6-inch fillet locations.';
export const COMPETENCIES = [
  {position:'Flat', electrode:'E6010', coupon:flat},
  {position:'Flat', electrode:'E7018', coupon:flat},
  {position:'2F', electrode:'E6010', coupon:cruciform},
  {position:'2F', electrode:'E7018', coupon:cruciform},
  {position:'3F vertical-up', electrode:'E6010', coupon:cruciform},
  {position:'3F vertical-up', electrode:'E7018', coupon:cruciform},
  {position:'4F', electrode:'E6010', coupon:cruciform},
  {position:'4F', electrode:'E7018', coupon:cruciform},
  {position:'Advanced 2G with backing', electrode:'E7018', coupon:'Groove weld with backing — use the existing assigned procedure and coupon requirements.'},
];
export const PACING = [
  'Flat E6010 · Setup, arc starts, travel',
  'Flat E6010 · Consistent placement and travel',
  'Flat E6010 → E7018 · Checks and introduction',
  'Flat E7018 · Tight arc and slag control',
  'Flat completion · Formal checks',
  '2F E6010 · Cruciform orientation and angles',
  '2F E6010 · Toe placement and tie-in',
  '2F E6010 → E7018 · Checks and introduction',
  '2F E7018 · Profile and slag removal',
  '2F completion · Formal checks',
  '3F E6010 · Vertical-up puddle control',
  '3F E6010 · Progression and sidewall tie-in',
  '3F E6010 → E7018 · Checks and introduction',
  '3F E7018 · Tight arc and heat control',
  '3F E7018 · Consistency and undercut control',
  '3F completion · Checks, coaching, 4F demo',
  '4F E6010 · Positioning and puddle control',
  '4F E6010 · Overhead consistency',
  '4F E6010 → E7018 · Checks and introduction',
  '4F E7018 · Tight arc and toe control',
  '4F E7018 · Defect correction',
  '4F completion · Advanced 2G unlocked by core completion',
  'Final competency night · Remaining checks and advanced 2G',
];
export function assignmentLabel(index: number) {
  const c = COMPETENCIES[index];
  return c ? `${c.position} · ${c.electrode} · 1/8 in` : 'All competencies complete';
}
export function gradeTotal(ratings: Ratings) {
  if (Object.keys(ratings).length !== 5 || CATEGORIES.some(c => !RATINGS.some(r => r.points === ratings[c.key]))) {
    throw new Error('Choose one rating for every category.');
  }
  return CATEGORIES.reduce((total, c) => total + ratings[c.key], 0);
}
export function qualifies(first: Ratings, later: Ratings) {
  return CATEGORIES.every(c => later[c.key] >= 16) && gradeTotal(later) >= gradeTotal(first);
}
export function cleanTags(ratings: Ratings, tags: Tags): Tags {
  return Object.fromEntries(CATEGORIES.filter(c => ratings[c.key] === 12).map(c => [c.key, tags[c.key] ?? []]));
}
export type ShopAttempt = {
  id: string; competency: number; attempt_number: number; ratings: Ratings;
  total: number; tags: Tags; sizer_reference: string; sizer_note: string;
  recorded_at: string; recorded_by: string;
};
export type Completion = {competency: number; grade: number; first_attempt_id: string; second_attempt_id: string};
export type ShopStudent = {
  student_id: string; display_name: string; active: boolean; current_competency: number;
  revision: number; requested_at: string | null; focus: string[]; position_meetings: number;
  attempts: ShopAttempt[]; completions: Completion[];
};
export type ShopBoard = {students: ShopStudent[]; night: number | null};
export function sortedQueue(students: ShopStudent[]) {
  return [...students].sort((a,b) => {
    if (a.requested_at && b.requested_at) return a.requested_at.localeCompare(b.requested_at);
    if (a.requested_at || b.requested_at) return a.requested_at ? -1 : 1;
    return a.display_name.localeCompare(b.display_name);
  });
}
