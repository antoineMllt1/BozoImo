function addTextBlock(doc, lines, x, y, options = {}) {
  const { lineHeight = 6, fontSize = 11, color = [17, 24, 39], maxWidth = 170 } = options;
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  let cursor = y;
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, maxWidth);
    doc.text(wrapped, x, cursor);
    cursor += wrapped.length * lineHeight;
  }
  return cursor;
}

async function addNodeSnapshot(doc, node, x, y, maxWidth, maxHeight) {
  if (!node) return y;
  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(node, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const imgData = canvas.toDataURL('image/png');
    const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
    const width = canvas.width * ratio;
    const height = canvas.height * ratio;
    doc.addImage(imgData, 'PNG', x, y, width, height);
    return y + height + 8;
  } catch {
    return y;
  }
}

export async function exportDossierPdf({
  dossier,
  estimate,
  metrics,
  filteredRefs,
  trend,
  chartNodes = {},
  logoDataUrl = null,
}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 15;

  doc.setFillColor(17, 24, 39);
  doc.rect(0, 0, 210, 32, 'F');
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'JPEG', 160, 7, 28, 18);
    } catch {
      // Ignore logo decode issues.
    }
  }
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('Estimia Report', margin, 18);
  doc.setFontSize(10);
  doc.text(new Date().toLocaleDateString('fr-FR'), margin, 25);

  let y = 42;
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(16);
  doc.text(dossier.address || 'Dossier', margin, y);
  y += 8;

  const summary = [
    `Type: ${dossier.target?.type === 'House' ? 'Maison' : 'Appartement'} · Surface: ${dossier.target?.surfaceM2 || '—'} m² · Pieces: ${dossier.target?.rooms || '—'}`,
    `Statut: ${dossier.status || 'draft'} · Rayon: ${dossier.radiusMeters || '—'} m`,
    dossier.propertyDescription || 'Aucune description saisie.',
  ];
  y = addTextBlock(doc, summary, margin, y, { fontSize: 11, lineHeight: 5.5 });

  if (dossier.coverPhoto?.dataUrl) {
    try {
      doc.addImage(dossier.coverPhoto.dataUrl, 'JPEG', 140, 42, 55, 40);
    } catch {
      // Ignore image decode issues.
    }
  }

  y += 4;
  doc.setFontSize(13);
  doc.text('Estimation', margin, y);
  y += 6;
  y = addTextBlock(
    doc,
    [
      `ML: ${estimate ? `${estimate.correctedPm2.toLocaleString('fr-FR')} €/m²` : '—'} · Fourchette: ${estimate ? `${estimate.minPm2.toLocaleString('fr-FR')} - ${estimate.maxPm2.toLocaleString('fr-FR')} €/m²` : '—'}`,
      `Prix total estime: ${estimate?.estimatedPrice ? `${estimate.estimatedPrice.toLocaleString('fr-FR')} €` : '—'}`,
      `Confiance: ${estimate?.confidence ? `${estimate.confidence.stars}/5 (${estimate.confidence.label})` : '—'}`,
      `Prix pivot: ${dossier.prixPivot ? `${Math.round(dossier.prixPivot).toLocaleString('fr-FR')} €/m²` : '—'} · Analyste: ${dossier.manualEstimate ? `${Math.round(dossier.manualEstimate).toLocaleString('fr-FR')} €/m²` : '—'}`,
    ],
    margin,
    y
  );

  const topRefs = filteredRefs.slice(0, 10);
  y += 3;
  doc.setFontSize(13);
  doc.text('Comparables retenus', margin, y);
  y += 6;
  topRefs.forEach((ref, index) => {
    const line = `${index + 1}. ${ref.source.toUpperCase()} · ${ref.address || 'Adresse indisponible'} · ${ref.ppm2 ? `${ref.ppm2.toLocaleString('fr-FR')} €/m²` : '—'} · ${ref.area || '—'} m²`;
    y = addTextBlock(doc, [line], margin, y, { fontSize: 10, lineHeight: 4.5 });
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
  });

  doc.addPage();
  y = 20;
  doc.setFontSize(14);
  doc.text('Marché et contexte', margin, y);
  y += 8;

  y = addTextBlock(
    doc,
    [
      `Transactions DVF: ${metrics?.nDvf ?? 0} · Annonces SeLoger: ${metrics?.nSl ?? 0} · References filtrees: ${metrics?.n ?? 0}`,
      `Moyenne ponderee: ${metrics?.avgWeighted ? `${metrics.avgWeighted.toLocaleString('fr-FR')} €/m²` : '—'} · Ecart-type: ${metrics?.stdDev ? `${metrics.stdDev.toLocaleString('fr-FR')} €/m²` : '—'}`,
      `Trend trimestriel: ${trend?.series?.length ? `${trend.series[0].label} → ${trend.series[trend.series.length - 1].label}` : 'Données insuffisantes'}`,
    ],
    margin,
    y
  );

  y += 4;
  y = await addNodeSnapshot(doc, chartNodes.mapNode, margin, y, 180, 80);
  y = await addNodeSnapshot(doc, chartNodes.trendNode, margin, y, 180, 60);
  y = await addNodeSnapshot(doc, chartNodes.radarNode, margin, y, 140, 80);

  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(13);
  doc.text('Methodologie', margin, y);
  y += 6;
  addTextBlock(
    doc,
    [
      'Mediane ponderee des comparables, ajustement surface, facteurs caracteristiques, facteurs de contexte quartier et correction ML issue des confirmations.',
      'Les donnees proviennent de DVF, SeLoger et enrichissements quartier (transport, education, amenites, risques).',
      'Ce rapport est un support d analyse et ne remplace pas une validation experte sur site.',
    ],
    margin,
    y,
    { fontSize: 10.5, lineHeight: 5 }
  );

  doc.save(`estimia_${(dossier.address || 'dossier').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.pdf`);
}
