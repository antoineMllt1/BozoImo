import { DPE_OPTIONS, CONDITION_OPTIONS, VIEW_QUALITY_OPTIONS } from '../utils/dossiers';
import Dropdown from './Dropdown';
import NumberInput from './NumberInput';

const ORIENTATION_OPTIONS = [
  { value: '', label: '—' },
  { value: 'N', label: 'Nord' },
  { value: 'NE', label: 'Nord-Est' },
  { value: 'E', label: 'Est' },
  { value: 'SE', label: 'Sud-Est' },
  { value: 'S', label: 'Sud' },
  { value: 'SW', label: 'Sud-Ouest' },
  { value: 'W', label: 'Ouest' },
  { value: 'NW', label: 'Nord-Ouest' },
];

function Row({ label, children }) {
  return (
    <div className="te-row">
      <span className="te-label">{label}</span>
      <div className="te-control">{children}</div>
    </div>
  );
}

function Toggle({ value, onChange, label }) {
  return (
    <button
      type="button"
      className={`te-toggle ${value === true ? 'on' : ''}`}
      onClick={() => onChange(value === true ? null : true)}
    >
      {label}
    </button>
  );
}

export default function TargetEditor({ target, onChange }) {
  const t = target || {};

  const set = (key, value) => {
    onChange({ ...t, [key]: value });
  };

  return (
    <div className="target-editor">
      <div className="te-grid">
        <Row label="Surface m²">
          <NumberInput
            label="Surface m2"
            min={1}
            step={0.5}
            size="md"
            value={t.surfaceM2 ?? null}
            onChange={value => set('surfaceM2', value)}
          />
        </Row>

        <Row label="Pièces">
          <NumberInput
            label="Pieces"
            min={1}
            max={20}
            step={1}
            size="sm"
            value={t.rooms ?? null}
            onChange={value => set('rooms', value)}
          />
        </Row>

        <Row label="Étage">
          <NumberInput
            label="Etage"
            min={0}
            max={50}
            step={1}
            size="sm"
            value={t.floor ?? null}
            placeholder="0"
            onChange={value => set('floor', value)}
          />
        </Row>

        <Row label="Étages total">
          <NumberInput
            label="Etages total"
            min={1}
            max={50}
            step={1}
            size="sm"
            value={t.totalFloors ?? null}
            onChange={value => set('totalFloors', value)}
          />
        </Row>

        <Row label="Orientation">
          <Dropdown
            value={t.orientation || ''}
            onChange={v => set('orientation', v || null)}
            options={ORIENTATION_OPTIONS}
            className="te-select"
          />
        </Row>

        <Row label="DPE">
          <Dropdown
            value={t.dpe || ''}
            onChange={v => set('dpe', v || null)}
            options={[{ value: '', label: '—' }, ...DPE_OPTIONS.map(d => ({ value: d, label: d }))]}
            className="te-select"
          />
        </Row>

        <Row label="État">
          <Dropdown
            value={t.condition || ''}
            onChange={v => set('condition', v || null)}
            options={[{ value: '', label: '—' }, ...CONDITION_OPTIONS]}
            className="te-select"
          />
        </Row>

        <Row label="Vue">
          <Dropdown
            value={t.viewQuality || ''}
            onChange={v => set('viewQuality', v || null)}
            options={[{ value: '', label: '—' }, ...VIEW_QUALITY_OPTIONS]}
            className="te-select"
          />
        </Row>

        <Row label="Année construction">
          <NumberInput
            label="Annee construction"
            min={1800}
            max={new Date().getFullYear()}
            step={1}
            size="md"
            value={t.yearBuilt ?? null}
            onChange={value => set('yearBuilt', value)}
          />
        </Row>
      </div>

      <div className="te-toggles">
        <Toggle value={t.hasElevator} onChange={v => set('hasElevator', v)} label="Ascenseur" />
        <Toggle value={t.hasBalcony} onChange={v => set('hasBalcony', v)} label="Balcon" />
        <Toggle value={t.hasTerrace} onChange={v => set('hasTerrace', v)} label="Terrasse" />
        <Toggle value={t.hasParking} onChange={v => set('hasParking', v)} label="Parking" />
        <Toggle value={t.hasCellar} onChange={v => set('hasCellar', v)} label="Cave" />
        <Toggle value={t.hasPool} onChange={v => set('hasPool', v)} label="Piscine" />
        <Toggle value={t.hasGarden} onChange={v => set('hasGarden', v)} label="Jardin" />
        <Toggle value={t.isDuplex} onChange={v => set('isDuplex', v)} label="Duplex" />
      </div>
    </div>
  );
}
