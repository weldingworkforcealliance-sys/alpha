type Props = {
  usableMinutes: number;
  workMinutes: number;
  closeoutMinutes: number;
  scheduledMinutes: number;
  transportMinutes: number;
};

export default function PlannerTimeBudget({ usableMinutes, workMinutes, closeoutMinutes, scheduledMinutes, transportMinutes }: Props) {
  if (transportMinutes <= 0) return null;
  return (
    <aside className="planner-time-budget" aria-label="Usable lab time estimate">
      <strong>{workMinutes} min work + {closeoutMinutes} min safe cleanup</strong>
      <span>{usableMinutes} min usable · {scheduledMinutes} min scheduled · {transportMinutes} min bus allowance</span>
      <p>Planning estimate: start minute 0 when students are ready in the shop. Finish safe closeout before pickup; adjust to the actual bus window.</p>
    </aside>
  );
}
