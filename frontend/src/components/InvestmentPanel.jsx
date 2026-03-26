import { useEffect, useState } from 'react';
import {
  computeAcquisitionCost,
  computeMortgage,
  computeRentalYield,
  estimateRenovationCost,
} from '../utils/investment';
import { fmtPrice } from '../utils/formatters';
import { InfoEmpty, InfoPanelShell, InfoStatGrid } from './InfoPanelShell';

export default function InvestmentPanel({ dossier }) {
  const basePrice = dossier?.priceHistory?.currentPrice || dossier?.lastEstimate?.estimatedPrice || null;
  const target = dossier?.target || {};

  const [monthlyRent, setMonthlyRent] = useState('');
  const [ratePct, setRatePct] = useState(3.4);
  const [years, setYears] = useState(20);
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [agencyFeePct, setAgencyFeePct] = useState(0);
  const [annualCharges, setAnnualCharges] = useState('');

  useEffect(() => {
    setMonthlyRent('');
    setRatePct(3.4);
    setYears(20);
    setDownPaymentPct(20);
    setAgencyFeePct(0);
    setAnnualCharges('');
  }, [dossier?.id]);

  if (!basePrice) {
    return (
      <InfoEmpty
        title="Investissement indisponible"
        body="Il faut au moins un prix de base (Castorus ou estimation algo) pour alimenter le simulateur."
      />
    );
  }

  const acquisition = computeAcquisitionCost(basePrice, agencyFeePct, false);
  const renovationTarget = target.dpe === 'G' || target.dpe === 'F' || target.dpe === 'E' ? 'D' : null;
  const renovation = renovationTarget && target.surfaceM2
    ? estimateRenovationCost(target.dpe, renovationTarget, target.surfaceM2)
    : null;

  const totalProjectCost = acquisition.total + (renovation?.totalCost || 0);
  const downPayment = Math.round(totalProjectCost * (downPaymentPct / 100));
  const loanAmount = Math.max(0, totalProjectCost - downPayment);
  const mortgage = computeMortgage(loanAmount, ratePct, years);
  const rental = monthlyRent
    ? computeRentalYield(totalProjectCost, Number(monthlyRent), Number(annualCharges) || 0)
    : null;

  return (
    <InfoPanelShell
      title="Invest."
      subtitle="Simulation simple d'acquisition, credit, rendement et renovation."
    >
      <div className="info-form-grid">
        <label>
          Loyer mensuel cible
          <input className="te-input" type="number" value={monthlyRent} onChange={(event) => setMonthlyRent(event.target.value)} placeholder="Ex: 1450" />
        </label>
        <label>
          Taux credit %
          <input className="te-input" type="number" step="0.1" value={ratePct} onChange={(event) => setRatePct(Number(event.target.value) || 0)} />
        </label>
        <label>
          Duree (ans)
          <input className="te-input" type="number" value={years} onChange={(event) => setYears(Number(event.target.value) || 0)} />
        </label>
        <label>
          Apport %
          <input className="te-input" type="number" value={downPaymentPct} onChange={(event) => setDownPaymentPct(Number(event.target.value) || 0)} />
        </label>
        <label>
          Frais agence %
          <input className="te-input" type="number" step="0.5" value={agencyFeePct} onChange={(event) => setAgencyFeePct(Number(event.target.value) || 0)} />
        </label>
        <label>
          Charges annuelles
          <input className="te-input" type="number" value={annualCharges} onChange={(event) => setAnnualCharges(event.target.value)} placeholder="Optionnel" />
        </label>
      </div>

      <InfoStatGrid
        items={[
          { label: 'Prix de base', value: fmtPrice(basePrice) },
          { label: 'Cout acquisition', value: fmtPrice(acquisition.total) },
          { label: 'Travaux energie', value: renovation ? fmtPrice(renovation.totalCost) : null },
          { label: 'Projet total', value: fmtPrice(totalProjectCost) },
        ]}
      />

      <InfoStatGrid
        items={[
          { label: 'Apport', value: fmtPrice(downPayment) },
          { label: 'Montant emprunte', value: fmtPrice(loanAmount) },
          { label: 'Mensualite', value: fmtPrice(mortgage.monthlyPayment) },
          { label: 'Interets', value: fmtPrice(mortgage.totalInterest) },
        ]}
      />

      {rental ? (
        <InfoStatGrid
          items={[
            { label: 'Rendement brut', value: `${rental.grossYield}%` },
            { label: 'Rendement net', value: `${rental.netYield}%` },
            { label: 'Cashflow mensuel', value: fmtPrice(rental.monthlyCashflow) },
            { label: 'Charges/mois', value: fmtPrice(rental.monthlyCharges) },
          ]}
        />
      ) : (
        <div className="info-inline-note">Renseigne un loyer cible pour calculer le rendement et le cashflow.</div>
      )}
    </InfoPanelShell>
  );
}
