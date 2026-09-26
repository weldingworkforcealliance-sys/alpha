type ReviewRecord = {
  initial_status: string | null;
  final_status: string | null;
  completion_flags: string[] | null;
};

export function attendanceNeedsReview(record: ReviewRecord): boolean {
  const status = record.final_status || record.initial_status || 'unmarked';
  return (record.completion_flags?.length ?? 0) > 0 || !['present', 'excused'].includes(status);
}

