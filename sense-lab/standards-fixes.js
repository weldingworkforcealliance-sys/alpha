// Standards-specific prototype corrections kept separate while the lab is being reviewed.
// AWS EG2.0 identifies mechanized OFC hands-on training and manual CAC-A hands-on
// training as optional for full or partial Level I completion. They remain visible
// in the Passport, but must not block completion of Module 8.

function competenciesVerified(student, moduleId) {
  const list = student.competencies[moduleId] || [];
  const required = list.filter(item => {
    if (moduleId !== "m8") return true;
    return !item.label.includes("optional hands-on");
  });
  return required.length > 0 && required.every(c => c.status === "Verified");
}

// Re-render once after overriding the prototype completion rule.
render();
