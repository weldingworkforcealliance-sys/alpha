export const TRANSPORT_ALLOWANCE_NOTE = 'LTG_NON_INSTRUCTIONAL_TRANSPORT_ALLOWANCE_V1';

type TimedSegment = {
  planned_minutes: number;
  segment_type?: string;
  notes?: string | null;
};

export function getPlannerTimeBudget<T extends TimedSegment>(segments: T[]) {
  const teachingSegments = segments.filter((segment) => segment.notes !== TRANSPORT_ALLOWANCE_NOTE);
  const transportMinutes = segments.reduce(
    (sum, segment) => sum + (segment.notes === TRANSPORT_ALLOWANCE_NOTE ? segment.planned_minutes : 0), 0
  );
  const usableMinutes = teachingSegments.reduce((sum, segment) => sum + segment.planned_minutes, 0);
  const closeoutMinutes = teachingSegments.reduce(
    (sum, segment) => sum + (segment.segment_type === 'closure' ? segment.planned_minutes : 0), 0
  );
  return {
    teachingSegments, usableMinutes, closeoutMinutes, workMinutes: usableMinutes - closeoutMinutes,
    transportMinutes, scheduledMinutes: usableMinutes + transportMinutes,
  };
}
