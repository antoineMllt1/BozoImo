import { fmtPm2 } from '../utils/formatters';

function fmtInt(value) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString('fr-FR') : '—';
}

function fmtPct(value) {
  return Number.isFinite(value) ? `${Math.round(value * 10) / 10}%` : '—';
}

function fmtScore5(value) {
  return Number.isFinite(value) ? `${Math.round(value * 10) / 10}/5` : '—';
}

function fmtScore100(value) {
  return Number.isFinite(value) ? `${Math.round(value)}/100` : '—';
}

function fmtKm(value) {
  return Number.isFinite(value) ? `${Math.round(value * 10) / 10} km` : '—';
}

function fieldRows(rows) {
  return rows.filter(([, value]) => value !== '—');
}

function algoScores(areaScores = {}) {
  return [
    ['Transport', areaScores.transportScore],
    ['Walk', areaScores.walkScore],
    ['Ecoles', areaScores.educationScore],
    ['Environnement', areaScores.environmentScore],
    ['Securite', areaScores.safetyScore],
    ['Services', areaScores.servicesScore],
    ['Economie', areaScores.economyScore],
    ['Cadre de vie', areaScores.liveabilityScore],
  ].filter(([, value]) => value != null);
}

export default function NeighborhoodWorkbench({ areaContext, areaScores, target, onReload, reloading = false, canReload = false, error = '' }) {
  const city = areaContext?.villesAVivre;

  if (!city || city?.error) {
    return (
      <div className="neighborhood-workbench">
        <div className="algo-card">
          <div className="nwb-empty">
            <p>Les donnees quartier de Villes a vivre ne sont pas encore disponibles pour ce dossier.</p>
            {error && <p className="nwb-error">{error}</p>}
            <button
              className="topbar-btn topbar-btn-primary"
              onClick={onReload}
              disabled={!canReload || reloading}
            >
              {reloading ? 'Scraping...' : 'Lancer le scraping quartier'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isHouse = target?.type === 'House';
  const marketPm2 = isHouse ? city.housing?.housePricePm2 : city.housing?.apartmentPricePm2;
  const marketTrend = isHouse ? city.housing?.housePriceTrendPct : city.housing?.apartmentPriceTrendPct;
  const scoreList = algoScores(areaScores);

  const ratingsRows = fieldRows([
    ['Note globale', fmtScore5(city.ratings?.overall)],
    ['Environnement', fmtScore5(city.ratings?.environment)],
    ['Securite', fmtScore5(city.ratings?.security)],
    ['Transport', fmtScore5(city.ratings?.transport)],
    ['Education', fmtScore5(city.ratings?.education)],
    ['Sante', fmtScore5(city.ratings?.health)],
    ['Services', fmtScore5(city.ratings?.services)],
    ['Culture', fmtScore5(city.ratings?.culture)],
  ]);

  const profileRows = fieldRows([
    ['Population', fmtInt(city.population?.inhabitants)],
    ['Croissance 2017-2023', fmtPct(city.population?.growthPct)],
    ['Densite', Number.isFinite(city.population?.densityKm2) ? `${fmtInt(city.population?.densityKm2)} hab/km²` : '—'],
    ['Age median', Number.isFinite(city.population?.medianAge) ? `${fmtInt(city.population?.medianAge)} ans` : '—'],
    ['Revenu median', Number.isFinite(city.economy?.medianIncome) ? `${fmtInt(city.economy?.medianIncome)} €` : '—'],
    ['Chomage', fmtPct(city.economy?.unemploymentPct)],
    ['Fibre', fmtPct(city.economy?.fiberPct)],
    ['Creation d entreprises', fmtPct(city.economy?.businessCreationPct)],
  ]);

  const housingRows = fieldRows([
    ['Prix local cible', fmtPm2(marketPm2)],
    ['Tendance cible', fmtPct(marketTrend)],
    ['Prix median ville', fmtPm2(city.housing?.housingPricePm2)],
    ['Transactions', fmtInt(city.housing?.transactionCount)],
    ['Part appartements', fmtPct(city.housing?.apartmentSharePct)],
    ['Part maisons', fmtPct(city.housing?.houseSharePct)],
    ['Vacance', fmtPct(city.housing?.vacantPct)],
    ['Proprietaires', fmtPct(city.housing?.ownerPct)],
    ['Locataires', fmtPct(city.housing?.tenantPct)],
  ]);

  const safetyRows = fieldRows([
    [
      'Crimes et delits',
      Number.isFinite(city.safety?.crimesPer1000) && Number.isFinite(city.safety?.nationalCrimesPer1000)
        ? `${fmtInt(city.safety.crimesPer1000)} vs ${fmtInt(city.safety.nationalCrimesPer1000)}`
        : '—',
    ],
    [
      'Cambriolages',
      Number.isFinite(city.safety?.burglaryPer1000) && Number.isFinite(city.safety?.burglaryNationalPer1000)
        ? `${fmtInt(city.safety.burglaryPer1000)} vs ${fmtInt(city.safety.burglaryNationalPer1000)}`
        : '—',
    ],
    [
      'Vols auto',
      Number.isFinite(city.safety?.carTheftPer1000) && Number.isFinite(city.safety?.carTheftNationalPer1000)
        ? `${fmtInt(city.safety.carTheftPer1000)} vs ${fmtInt(city.safety.carTheftNationalPer1000)}`
        : '—',
    ],
    [
      'Violences physiques',
      Number.isFinite(city.safety?.physicalViolencePer1000) && Number.isFinite(city.safety?.physicalViolenceNationalPer1000)
        ? `${fmtInt(city.safety.physicalViolencePer1000)} vs ${fmtInt(city.safety.physicalViolenceNationalPer1000)}`
        : '—',
    ],
    [
      'Violences sexuelles',
      Number.isFinite(city.safety?.sexualViolencePer1000) && Number.isFinite(city.safety?.sexualViolenceNationalPer1000)
        ? `${fmtInt(city.safety.sexualViolencePer1000)} vs ${fmtInt(city.safety.sexualViolenceNationalPer1000)}`
        : '—',
    ],
  ]);

  const serviceRows = fieldRows([
    ['Medecins', fmtInt(city.services?.doctors)],
    ['Pharmacies', fmtInt(city.services?.pharmacies)],
    ['Creches', fmtInt(city.services?.nurseries)],
    ['Ecoles maternelles', fmtInt(city.services?.nurserySchools)],
    ['Ecoles elementaires', fmtInt(city.services?.elementarySchools)],
    ['Colleges', fmtInt(city.services?.colleges)],
    ['Lycees', fmtInt(city.services?.highSchools)],
    ['Supermarches', fmtInt(city.services?.supermarkets)],
    ['Boulangeries', fmtInt(city.services?.bakeries)],
    ['Restaurants', fmtInt(city.services?.restaurants)],
    ['Gare SNCF', fmtKm(city.services?.trainStationDistanceKm)],
    ['Aeroport', fmtKm(city.services?.airportDistanceKm)],
  ]);

  return (
    <div className="neighborhood-workbench">
      <section className="nwb-hero-card">
        <div>
          <span className="algo-kicker">Profil quartier / commune</span>
          <h3>{city.commune?.name || 'Commune'}</h3>
          <p>
            {city.commune?.postalCode || '—'}
            {city.commune?.department ? ` · ${city.commune.department}` : ''}
            {city.commune?.region ? ` · ${city.commune.region}` : ''}
          </p>
          {error && <p className="nwb-error">{error}</p>}
        </div>
        <div className="nwb-hero-side">
          <button className="topbar-btn" onClick={onReload} disabled={!canReload || reloading}>
            {reloading ? 'Actualisation...' : 'Actualiser'}
          </button>
          <div className="algo-mini">
            <span>Note globale</span>
            <strong>{fmtScore5(city.ratings?.overall)}</strong>
          </div>
          <div className="algo-mini">
            <span>Prix cible local</span>
            <strong>{fmtPm2(marketPm2)}</strong>
          </div>
          <div className="algo-mini">
            <span>Avis</span>
            <strong>{fmtInt(city.ratings?.reviewCount)}</strong>
          </div>
        </div>
      </section>

      <div className="nwb-grid">
        <section className="nwb-card">
          <div className="nwb-card-head">
            <h3>Notes Villes a vivre</h3>
            <p>Notes residents et perception globale de la commune.</p>
          </div>
          <div className="nwb-list">
            {ratingsRows.map(([label, value]) => (
              <div key={label} className="nwb-row">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="nwb-card">
          <div className="nwb-card-head">
            <h3>Profil socio-demo</h3>
            <p>Population, revenu, emploi et connectivite.</p>
          </div>
          <div className="nwb-list">
            {profileRows.map(([label, value]) => (
              <div key={label} className="nwb-row">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="nwb-card">
          <div className="nwb-card-head">
            <h3>Immobilier local</h3>
            <p>Signal marche communal complementaire aux comparables.</p>
          </div>
          <div className="nwb-list">
            {housingRows.map(([label, value]) => (
              <div key={label} className="nwb-row">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="nwb-card">
          <div className="nwb-card-head">
            <h3>Securite</h3>
            <p>Local vs moyenne nationale quand disponible.</p>
          </div>
          <div className="nwb-list">
            {safetyRows.map(([label, value]) => (
              <div key={label} className="nwb-row">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="nwb-card">
          <div className="nwb-card-head">
            <h3>Services</h3>
            <p>Sante, education, commerces et acces principaux.</p>
          </div>
          <div className="nwb-list">
            {serviceRows.map(([label, value]) => (
              <div key={label} className="nwb-row">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="nwb-card">
          <div className="nwb-card-head">
            <h3>Impact algo</h3>
            <p>Ces scores alimentent directement les ponderations de l estimation.</p>
          </div>
          <div className="nwb-score-grid">
            {scoreList.map(([label, value]) => (
              <div key={label} className="nwb-score-pill">
                <span>{label}</span>
                <strong>{fmtScore100(value)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="nwb-summary-card">
        <div className="nwb-card-head">
          <h3>Resume source</h3>
          <p>Extraits syntheses de Villes a vivre.</p>
        </div>
        <div className="nwb-summary-copy">
          {city.summaries?.city && <p>{city.summaries.city}</p>}
          {city.summaries?.climate && <p>{city.summaries.climate}</p>}
          {city.summaries?.housing && <p>{city.summaries.housing}</p>}
        </div>
        <div className="nwb-source-row">
          <a className="topbar-btn" href={city.url} target="_blank" rel="noreferrer">Ouvrir la source</a>
          <span>{Array.isArray(city.references) ? city.references.join(' · ') : 'villesavivre.fr'}</span>
        </div>
      </section>
    </div>
  );
}
