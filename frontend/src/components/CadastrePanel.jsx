import { InfoEmpty, InfoPanelShell, InfoStatGrid, PrimitiveEntries } from './InfoPanelShell';

function compactEntries(source) {
  return Object.entries(source || {}).filter(([, value]) => value != null && typeof value !== 'object').slice(0, 10);
}

export default function CadastrePanel({ parcelleInfo, buildingProfile }) {
  const parcelles = parcelleInfo?.features || [];
  const buildings = buildingProfile?.results || [];

  if (!parcelles.length && !buildings.length) {
    return (
      <InfoEmpty
        title="Cadastre indisponible"
        body="Aucune geometrie parcellaire ni information batiment n'a ete recuperee."
      />
    );
  }

  return (
    <InfoPanelShell
      title="Cadastre"
      subtitle="Geometrie parcellaire IGN et voisinage bati issu de la BDTOPO."
    >
      <InfoStatGrid
        items={[
          { label: 'Parcelles', value: parcelles.length },
          { label: 'Batiments proches', value: buildings.length },
        ]}
      />

      {parcelles.length ? (
        <div className="info-section">
          <div className="info-section-head">
            <strong>Parcelles IGN</strong>
          </div>
          <div className="info-grid-2">
            {parcelles.slice(0, 4).map((feature, index) => (
              <div key={`parcel_${index}`} className="info-card">
                <h4>Parcelle {index + 1}</h4>
                <PrimitiveEntries entries={compactEntries(feature.properties)} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {buildings.length ? (
        <div className="info-section">
          <div className="info-section-head">
            <strong>Batiments IGN</strong>
          </div>
          <div className="info-grid-2">
            {buildings.slice(0, 4).map((item, index) => (
              <div key={`building_${index}`} className="info-card">
                <h4>Batiment {index + 1}</h4>
                <PrimitiveEntries entries={compactEntries(item)} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </InfoPanelShell>
  );
}
