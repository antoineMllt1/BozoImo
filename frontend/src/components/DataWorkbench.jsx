import DvfTable from './DvfTable';
import SelogerTable from './SelogerTable';
import MapView from './MapView';
import { fmtDate } from '../utils/formatters';

const RADIUS_OPTIONS = [
  { value: 250, label: '250m' },
  { value: 500, label: '500m' },
  { value: 1000, label: '1km' },
  { value: 2000, label: '2km' },
  { value: 5000, label: '5km' },
];

function clampRange(min, max, floor, ceil) {
  return {
    min: Math.max(floor, Math.min(min, max)),
    max: Math.min(ceil, Math.max(max, min)),
  };
}

function valueOrFallback(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function PriceHistogram({ refs, filterMin, filterMax }) {
  const values = refs.map(r => r.ppm2).filter(Number.isFinite);
  if (values.length < 3) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range <= 0) return null;

  const bucketCount = Math.min(20, Math.max(8, Math.ceil(values.length / 3)));
  const bucketSize = range / bucketCount;
  const buckets = Array.from({ length: bucketCount }, () => 0);
  for (const v of values) {
    const idx = Math.min(bucketCount - 1, Math.floor((v - min) / bucketSize));
    buckets[idx]++;
  }
  const maxCount = Math.max(...buckets);
  const w = 100 / bucketCount;

  return (
    <div className="dw-histogram">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="dw-histo-svg">
        {buckets.map((count, i) => {
          const x = i * w;
          const h = maxCount > 0 ? (count / maxCount) * 36 : 0;
          const bucketMin = min + i * bucketSize;
          const bucketMax = bucketMin + bucketSize;
          const inRange =
            (filterMin == null || bucketMax >= filterMin) &&
            (filterMax == null || bucketMin <= filterMax);
          return (
            <rect
              key={i}
              x={x + 0.3}
              y={40 - h}
              width={Math.max(0.5, w - 0.6)}
              height={h}
              className={inRange ? 'histo-bar-active' : 'histo-bar-muted'}
            />
          );
        })}
        {filterMin != null && (
          <line
            x1={((filterMin - min) / range) * 100}
            y1="0"
            x2={((filterMin - min) / range) * 100}
            y2="40"
            className="histo-marker"
          />
        )}
        {filterMax != null && (
          <line
            x1={((filterMax - min) / range) * 100}
            y1="0"
            x2={((filterMax - min) / range) * 100}
            y2="40"
            className="histo-marker"
          />
        )}
      </svg>
      <div className="dw-histo-labels">
        <span>{Math.round(min).toLocaleString('fr-FR')}</span>
        <span>{Math.round(max).toLocaleString('fr-FR')} €/m²</span>
      </div>
    </div>
  );
}

function RangeControl({
  label,
  minValue,
  maxValue,
  valueMin,
  valueMax,
  step,
  unit,
  onChange,
}) {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue) || minValue >= maxValue) {
    return null;
  }

  const safeMin = valueOrFallback(valueMin, minValue);
  const safeMax = valueOrFallback(valueMax, maxValue);

  return (
    <div className="dw-filter-block">
      <div className="dw-filter-head">
        <strong>{label}</strong>
        <span>{Math.round(safeMin).toLocaleString('fr-FR')} - {Math.round(safeMax).toLocaleString('fr-FR')} {unit}</span>
      </div>
      <div className="dw-range-stack">
        <input
          type="range"
          min={minValue}
          max={maxValue}
          step={step}
          value={safeMin}
          onChange={(event) => {
            const next = clampRange(+event.target.value, safeMax, minValue, maxValue);
            onChange(next.min, next.max);
          }}
        />
        <input
          type="range"
          min={minValue}
          max={maxValue}
          step={step}
          value={safeMax}
          onChange={(event) => {
            const next = clampRange(safeMin, +event.target.value, minValue, maxValue);
            onChange(next.min, next.max);
          }}
        />
      </div>
      <div className="dw-range-labels">
        <span>{Math.round(minValue).toLocaleString('fr-FR')} {unit}</span>
        <span>{Math.round(maxValue).toLocaleString('fr-FR')} {unit}</span>
      </div>
    </div>
  );
}

function RetainedRefsTable({ refs, exclusions, onExclusionsChange, hoveredRefId, onHoverRef }) {
  if (!refs.length) {
    return (
      <div className="dw-empty">
        Aucune référence retenue avec les filtres actuels.
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Adresse</th>
            <th>Date</th>
            <th>Type</th>
            <th>m²</th>
            <th>€/m²</th>
            <th>Exclure</th>
          </tr>
        </thead>
        <tbody>
          {refs.map(ref => (
            <tr
              key={ref.id}
              className={hoveredRefId === ref.id ? 'ref-hovered' : ''}
              onMouseEnter={() => onHoverRef?.(ref.id)}
              onMouseLeave={() => onHoverRef?.(null)}
            >
              <td>
                <span className={`src-badge src-${ref.source}`}>{ref.source === 'dvf' ? 'DVF' : 'SL'}</span>
              </td>
              <td className="td-addr">
                {ref.url
                  ? <a href={ref.url} target="_blank" rel="noopener noreferrer">{ref.address || '—'}</a>
                  : ref.address || '—'}
              </td>
              <td className="td-date">{ref.date ? fmtDate(ref.date) : '—'}</td>
              <td className="td-c">{ref.type || '—'}</td>
              <td className="td-c">{ref.area || '—'}</td>
              <td className="td-ppm">{ref.ppm2 ? ref.ppm2.toLocaleString('fr-FR') : '—'}</td>
              <td className="td-c">
                <input
                  type="checkbox"
                  checked={!!exclusions[ref.id]}
                  onChange={() => onExclusionsChange({ ...exclusions, [ref.id]: !exclusions[ref.id] })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DataWorkbench({
  dossier,
  allRefs,
  filteredRefs,
  filters,
  onFiltersChange,
  suggested,
  exclusions,
  onExclusionsChange,
  dataTab,
  onDataTabChange,
  hoveredRefId,
  onHoverRef,
  onRefetchSeloger,
  slRefetching,
  targetType,
  pendingRadius,
  onPendingRadiusChange,
  onReloadRadius,
  reloadingRadius,
}) {
  const priceValues = allRefs.map(ref => ref.ppm2).filter(Number.isFinite);
  const areaValues = allRefs.map(ref => ref.area).filter(Number.isFinite);
  const priceMin = priceValues.length ? Math.floor(Math.min(...priceValues) / 100) * 100 : null;
  const priceMax = priceValues.length ? Math.ceil(Math.max(...priceValues) / 100) * 100 : null;
  const areaMin = areaValues.length ? Math.floor(Math.min(...areaValues)) : null;
  const areaMax = areaValues.length ? Math.ceil(Math.max(...areaValues)) : null;
  const mapPoints = dataTab === 'dvf'
    ? allRefs.filter(ref => ref.source === 'dvf')
    : dataTab === 'seloger'
      ? allRefs.filter(ref => ref.source === 'seloger')
      : filteredRefs;
  const currentRadiusLabel = RADIUS_OPTIONS.find(option => option.value === dossier.radiusMeters)?.label || `${dossier.radiusMeters}m`;
  const selectedRadiusLabel = RADIUS_OPTIONS.find(option => option.value === pendingRadius)?.label || `${pendingRadius}m`;

  return (
    <div className="data-workbench">
      <div className="data-workbench-top">
        <div className="dw-map-card">
          <div className="dw-card-head">
            <div>
              <h3>Carte</h3>
              <p>Vue simple des références et du bien cible.</p>
            </div>
          </div>

          <div className="dw-radius-panel">
            <div className="dw-filter-head">
              <strong>Rayon de collecte</strong>
              <span>Actuel: {currentRadiusLabel} · Sélection: {selectedRadiusLabel}</span>
            </div>
            <div className="dw-chip-row">
              {RADIUS_OPTIONS.map(option => (
                <button
                  key={option.value}
                  className={`dw-chip ${pendingRadius === option.value ? 'active' : ''}`}
                  onClick={() => onPendingRadiusChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button className="topbar-btn topbar-btn-primary dw-reload-btn" onClick={onReloadRadius} disabled={reloadingRadius}>
              {reloadingRadius ? 'Relance...' : 'Relancer'}
            </button>
          </div>

          <div className="dw-map-square">
            <MapView
              points={mapPoints}
              target={{ ...dossier.target, lat: dossier.lat, lng: dossier.lng, address: dossier.address }}
              hoveredRefId={hoveredRefId}
              onHoverRef={onHoverRef}
              selectedIds={filteredRefs.slice(0, 12).map(ref => ref.id)}
              showHeatmap={false}
              radiusMeters={dossier.radiusMeters}
            />
          </div>
        </div>

        <div className="dw-filter-card">
          <div className="dw-card-head">
            <div>
              <h3>Filtres</h3>
              <p>Réglages rapides pour la sélection des comparables.</p>
            </div>
            <button className="topbar-btn" onClick={() => onFiltersChange({ ...filters, ppm2Min: null, ppm2Max: null, areaMin: null, areaMax: null, types: [], sources: ['dvf', 'seloger'] })}>
              Reset
            </button>
          </div>

          <div className="dw-filter-grid">
            <RangeControl
              label="Fourchette prix"
              minValue={priceMin}
              maxValue={priceMax}
              valueMin={filters.ppm2Min}
              valueMax={filters.ppm2Max}
              step={50}
              unit="€/m²"
              onChange={(nextMin, nextMax) => onFiltersChange({ ...filters, ppm2Min: nextMin, ppm2Max: nextMax })}
            />

            <PriceHistogram refs={allRefs} filterMin={filters.ppm2Min} filterMax={filters.ppm2Max} />

            {suggested && (
              <button
                className="dw-suggest-btn"
                onClick={() => onFiltersChange({ ...filters, ppm2Min: suggested.min, ppm2Max: suggested.max })}
              >
                Suggestion auto: {suggested.min.toLocaleString('fr-FR')} - {suggested.max.toLocaleString('fr-FR')} €/m²
              </button>
            )}

            <RangeControl
              label="Surface"
              minValue={areaMin}
              maxValue={areaMax}
              valueMin={filters.areaMin}
              valueMax={filters.areaMax}
              step={1}
              unit="m²"
              onChange={(nextMin, nextMax) => onFiltersChange({ ...filters, areaMin: nextMin, areaMax: nextMax })}
            />

            <div className="dw-filter-block">
              <div className="dw-filter-head">
                <strong>Typologies</strong>
                <span>{filters.types.length ? `${filters.types.length} actives` : 'Toutes'}</span>
              </div>
              <div className="dw-chip-row">
                {['T1', 'T2', 'T3', 'T4', 'T5'].map(type => (
                  <button
                    key={type}
                    className={`dw-chip ${filters.types.includes(type) ? 'active' : ''}`}
                    onClick={() => onFiltersChange({
                      ...filters,
                      types: filters.types.includes(type)
                        ? filters.types.filter(value => value !== type)
                        : [...filters.types, type],
                    })}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="dw-filter-block">
              <div className="dw-filter-head">
                <strong>Sources</strong>
                <span>{filters.sources.join(' + ')}</span>
              </div>
              <div className="dw-chip-row">
                {[
                  ['dvf', `DVF (${allRefs.filter(ref => ref.source === 'dvf').length})`],
                  ['seloger', `SeLoger (${allRefs.filter(ref => ref.source === 'seloger').length})`],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={`dw-chip ${filters.sources.includes(value) ? 'active' : ''}`}
                    onClick={() => onFiltersChange({
                      ...filters,
                      sources: filters.sources.includes(value)
                        ? filters.sources.filter(source => source !== value)
                        : [...filters.sources, value],
                    })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="dw-filter-block">
              <div className="dw-filter-head">
                <strong>Négociation SeLoger</strong>
                <span>{filters.negotiationRate ?? 5}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="15"
                step="0.5"
                value={filters.negotiationRate ?? 5}
                onChange={(event) => onFiltersChange({ ...filters, negotiationRate: +event.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="dw-tabs">
        <button className={`dw-tab ${dataTab === 'retained' ? 'active' : ''}`} onClick={() => onDataTabChange('retained')}>
          Retenues
          <span>{filteredRefs.length}</span>
        </button>
        <button className={`dw-tab ${dataTab === 'dvf' ? 'active' : ''}`} onClick={() => onDataTabChange('dvf')}>
          DVF
          <span>{dossier.dvfSnapshot?.data?.features?.length || 0}</span>
        </button>
        <button className={`dw-tab ${dataTab === 'seloger' ? 'active' : ''}`} onClick={() => onDataTabChange('seloger')}>
          SeLoger
          <span>{dossier.selogerSnapshot?.data?.classifieds?.length || 0}</span>
        </button>
      </div>

      <div className="dw-table-card">
        {dataTab === 'retained' && (
          <RetainedRefsTable
            refs={filteredRefs}
            exclusions={exclusions}
            onExclusionsChange={onExclusionsChange}
            hoveredRefId={hoveredRefId}
            onHoverRef={onHoverRef}
          />
        )}
        {dataTab === 'dvf' && (
          <DvfTable
            snapshot={dossier.dvfSnapshot}
            selectedComps={dossier.selectedComps || []}
            onToggle={() => {}}
            hoveredRefId={hoveredRefId}
            onHoverRef={onHoverRef}
          />
        )}
        {dataTab === 'seloger' && (
          <SelogerTable
            snapshot={dossier.selogerSnapshot}
            onRefetch={onRefetchSeloger}
            refetching={slRefetching}
            hoveredRefId={hoveredRefId}
            onHoverRef={onHoverRef}
            targetType={targetType}
          />
        )}
      </div>
    </div>
  );
}
