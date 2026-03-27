export async function exportDossierPdf({
  dossier,
  estimate,
  metrics,
  filteredRefs,
  trend,
  areaScores = {},
  analystAdjustments = [],
  syntheseNotes = '',
}) {
  // Strip heavy snapshots — backend doesn't need raw DVF/SeLoger data
  const { dvfSnapshot, selogerSnapshot, ...dossierLight } = dossier;

  const response = await fetch('/api/pdf/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dossier: dossierLight,
      estimate,
      metrics,
      filteredRefs,
      areaScores,
      analystAdjustments,
      syntheseNotes,
      trend,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Erreur PDF' }));
    throw new Error(err.error || 'Erreur génération PDF');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `estimia_${(dossier.address || 'dossier').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
