/**
 * Investment analysis utilities — notary fees, rental yield,
 * mortgage simulation, renovation cost estimation.
 */

// ── Notary fees ──────────────────────────────────────────────────────────────

export function computeNotaryFees(price, isNew = false) {
  if (!price || price <= 0) return { total: 0, pct: 0, breakdown: {} };

  if (isNew) {
    // Neuf: ~2-3% (TVA included in price)
    const taxePublicite = price * 0.00715;
    const emoluments = Math.min(price * 0.008, 80000);
    const divers = 1200;
    const total = Math.round(taxePublicite + emoluments + divers);
    return { total, pct: Math.round((total / price) * 1000) / 10, breakdown: { taxePublicite: Math.round(taxePublicite), emoluments: Math.round(emoluments), divers } };
  }

  // Ancien: ~7-8%
  const droitsMutation = price * 0.0580665; // 5.80665% departement + commune
  const emoluments = computeNotaryEmoluments(price);
  const debours = 1400;
  const contribution = price * 0.001;
  const total = Math.round(droitsMutation + emoluments + debours + contribution);
  return {
    total,
    pct: Math.round((total / price) * 1000) / 10,
    breakdown: {
      droitsMutation: Math.round(droitsMutation),
      emoluments: Math.round(emoluments),
      debours,
      contribution: Math.round(contribution),
    },
  };
}

function computeNotaryEmoluments(price) {
  // Barème proportionnel par tranches
  const tranches = [
    { limit: 6500, rate: 0.03945 },
    { limit: 17000, rate: 0.01627 },
    { limit: 60000, rate: 0.01085 },
    { limit: Infinity, rate: 0.00814 },
  ];
  let remaining = price;
  let total = 0;
  let prevLimit = 0;
  for (const { limit, rate } of tranches) {
    const tranche = Math.min(remaining, limit - prevLimit);
    if (tranche <= 0) break;
    total += tranche * rate;
    remaining -= tranche;
    prevLimit = limit;
  }
  return total * 1.2; // + 20% TVA
}

// ── Rental yield ─────────────────────────────────────────────────────────────

export function computeRentalYield(purchasePrice, monthlyRent, annualCharges = 0) {
  if (!purchasePrice || purchasePrice <= 0 || !monthlyRent || monthlyRent <= 0) {
    return { grossYield: 0, netYield: 0, monthlyCharges: 0, monthlyCashflow: 0 };
  }

  const annualRent = monthlyRent * 12;
  const grossYield = (annualRent / purchasePrice) * 100;

  // Estimate annual charges if not provided
  const charges = annualCharges > 0 ? annualCharges : estimateAnnualCharges(purchasePrice, monthlyRent);
  const netRent = annualRent - charges;
  const netYield = (netRent / purchasePrice) * 100;
  const monthlyCashflow = netRent / 12;

  return {
    grossYield: Math.round(grossYield * 100) / 100,
    netYield: Math.round(netYield * 100) / 100,
    annualRent,
    annualCharges: Math.round(charges),
    monthlyCashflow: Math.round(monthlyCashflow),
    monthlyCharges: Math.round(charges / 12),
  };
}

function estimateAnnualCharges(price, monthlyRent) {
  const annualRent = monthlyRent * 12;
  // Taxe foncière: ~1 mois de loyer
  const taxeFonciere = monthlyRent;
  // Charges copro: ~15% loyer
  const chargesCopro = annualRent * 0.15;
  // Assurance PNO: ~0.2% du prix
  const assurance = price * 0.002;
  // Gestion locative: 7% loyer
  const gestion = annualRent * 0.07;
  // Vacance: 5% loyer
  const vacance = annualRent * 0.05;
  // Provision travaux: 3% loyer
  const travaux = annualRent * 0.03;

  return taxeFonciere + chargesCopro + assurance + gestion + vacance + travaux;
}

// ── Mortgage simulation ──────────────────────────────────────────────────────

export function computeMortgage(amount, annualRatePct, durationYears) {
  if (!amount || amount <= 0 || !annualRatePct || !durationYears) {
    return { monthlyPayment: 0, totalCost: 0, totalInterest: 0, amortization: [] };
  }

  const monthlyRate = annualRatePct / 100 / 12;
  const nPayments = durationYears * 12;

  const monthlyPayment = monthlyRate > 0
    ? amount * (monthlyRate * Math.pow(1 + monthlyRate, nPayments)) / (Math.pow(1 + monthlyRate, nPayments) - 1)
    : amount / nPayments;

  const totalCost = monthlyPayment * nPayments;
  const totalInterest = totalCost - amount;

  return {
    monthlyPayment: Math.round(monthlyPayment),
    totalCost: Math.round(totalCost),
    totalInterest: Math.round(totalInterest),
    amount,
    ratePct: annualRatePct,
    durationYears,
  };
}

// ── Renovation cost estimation ───────────────────────────────────────────────

const RENOVATION_COST_PER_M2 = {
  'G_to_F': 150,
  'F_to_E': 200,
  'E_to_D': 250,
  'D_to_C': 350,
  'C_to_B': 500,
  'B_to_A': 600,
};

const DPE_ORDER = ['G', 'F', 'E', 'D', 'C', 'B', 'A'];

export function estimateRenovationCost(currentDpe, targetDpe, surfaceM2) {
  if (!currentDpe || !targetDpe || !surfaceM2) return null;

  const currentIdx = DPE_ORDER.indexOf(currentDpe);
  const targetIdx = DPE_ORDER.indexOf(targetDpe);
  if (currentIdx < 0 || targetIdx < 0 || targetIdx <= currentIdx) return null;

  let totalCost = 0;
  const postes = [];

  for (let i = currentIdx; i < targetIdx; i++) {
    const from = DPE_ORDER[i];
    const to = DPE_ORDER[i + 1];
    const key = `${from}_to_${to}`;
    const costPerM2 = RENOVATION_COST_PER_M2[key] || 300;
    const cost = costPerM2 * surfaceM2;
    totalCost += cost;
    postes.push({
      type: `${from} → ${to}`,
      description: `Passage de ${from} à ${to}`,
      estimatedCost: Math.round(cost),
      costPerM2,
    });
  }

  return {
    currentDpe,
    targetDpe,
    surfaceM2,
    totalCost: Math.round(totalCost),
    postes,
  };
}

// ── Full acquisition cost ────────────────────────────────────────────────────

export function computeAcquisitionCost(price, agencyFeePct = 5, isNew = false) {
  const notary = computeNotaryFees(price, isNew);
  const agencyFees = Math.round(price * (agencyFeePct / 100));
  return {
    price,
    notaryFees: notary.total,
    notaryPct: notary.pct,
    agencyFees,
    agencyFeePct,
    total: price + notary.total + agencyFees,
    breakdown: notary.breakdown,
  };
}
