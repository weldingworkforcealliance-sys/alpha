(() => {
  const isSmawPosition = assignment =>
    assignment?.processId === "smaw" &&
    assignment?.rubricType === "weld" &&
    assignment?.type === "position";

  const electrodeLabel = assignment =>
    String(assignment?.electrodeCode || assignment?.electrode || "").trim();

  const optionLabel = assignment => {
    const joint = assignment.family === "Groove"
      ? `${assignment.family} · ${assignment.backing}`
      : assignment.family;
    return [joint, assignment.position, electrodeLabel(assignment)]
      .filter(Boolean)
      .join(" · ");
  };

  const escapeRegExp = value =>
    String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const baseProjectGroupKey = projectGroupKey;
  projectGroupKey = assignment => {
    const base = baseProjectGroupKey(assignment);
    return isSmawPosition(assignment)
      ? `${base}|${electrodeLabel(assignment)}`
      : base;
  };

  const baseRenderLab = renderLab;
  renderLab = () => {
    let html = baseRenderLab();
    const assignments = Array.isArray(state?.assignments) ? state.assignments : [];

    assignments.filter(isSmawPosition).forEach(assignment => {
      const id = escapeRegExp(escapeHtml(assignment.id));
      const label = escapeHtml(optionLabel(assignment));
      const option = new RegExp(`(<option value="${id}"[^>]*>)[^<]*(</option>)`);
      html = html.replace(option, `$1${label}$2`);
    });

    const selected = assignmentById(state?.ui?.labAssignmentId);
    if (isSmawPosition(selected)) {
      const baseTitle = `${selected.process} ${selected.material} · ${selected.family}${selected.family === "Groove" ? ` · ${selected.backing}` : ""}`;
      const enhancedTitle = `${baseTitle} · ${electrodeLabel(selected)}`;
      html = html.replace(
        `${escapeHtml(baseTitle)} · only the current project group is shown so the gradebook stays usable.`,
        `${escapeHtml(enhancedTitle)} · only the current project group is shown so the gradebook stays usable.`
      );
    }

    return html;
  };
})();
