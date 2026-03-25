import { useEffect, useMemo } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  ZoomControl,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';

const METERS_PER_DEG_LAT = 111320;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatPrice(value, unit = 'EUR') {
  if (!Number.isFinite(value)) return '-';
  return `${Math.round(value).toLocaleString('fr-FR')} ${unit}`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR');
}

function heatColor(ppm2, min, max) {
  if (!Number.isFinite(ppm2) || !Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return '#f59e0b';
  }
  const ratio = clamp((ppm2 - min) / (max - min), 0, 1);
  const hue = 210 - ratio * 210;
  return `hsl(${hue}, 85%, 48%)`;
}

function formatRadius(radiusMeters) {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return null;
  return radiusMeters >= 1000 ? `${radiusMeters / 1000}km` : `${radiusMeters}m`;
}

function radiusBoundsFromCenter(lat, lng, radiusMeters) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    return null;
  }

  const dLat = radiusMeters / METERS_PER_DEG_LAT;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const safeCosLat = Math.abs(cosLat) < 0.0001 ? 0.0001 : cosLat;
  const dLng = radiusMeters / (METERS_PER_DEG_LAT * safeCosLat);

  return L.latLngBounds(
    [lat - dLat, lng - dLng],
    [lat + dLat, lng + dLng]
  );
}

function markerFillColor(point, hovered, selected) {
  if (hovered) return '#0f172a';
  if (point.excluded) return '#cbd5e1';
  if (point.source === 'seloger') return selected ? '#d97706' : '#f59e0b';
  return selected ? '#1d4ed8' : '#4f6df0';
}

function markerStrokeColor(point, hovered, selected) {
  if (hovered) return '#0f172a';
  if (selected) return '#ffffff';
  if (point.excluded) return '#94a3b8';
  return '#ffffff';
}

function markerRadius(point, hovered, selected) {
  if (hovered) return 8.5;
  if (selected) return point.source === 'seloger' ? 7 : 6.5;
  if (point.excluded) return 4.5;
  return point.source === 'seloger' ? 5.8 : 5.2;
}

function markerWeight(point, hovered, selected) {
  if (hovered) return 2.4;
  if (selected) return 2.2;
  if (point.excluded) return 1.2;
  return 1.6;
}

function markerOpacity(point, hovered, selected) {
  if (hovered || selected) return 0.98;
  if (point.excluded) return 0.42;
  return 0.84;
}

function FitBounds({ points, target, radiusMeters }) {
  const map = useMap();

  useEffect(() => {
    const coords = [
      ...points.map(point => [point.lat, point.lng]),
      ...(Number.isFinite(target?.lat) && Number.isFinite(target?.lng) ? [[target.lat, target.lng]] : []),
    ].filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

    map.invalidateSize();

    if (!coords.length) {
      map.setView([48.8566, 2.3522], 12);
      return;
    }

    const hasTarget = Number.isFinite(target?.lat) && Number.isFinite(target?.lng);
    const radiusBounds =
      hasTarget && Number.isFinite(radiusMeters) && radiusMeters > 0
        ? radiusBoundsFromCenter(target.lat, target.lng, radiusMeters)
        : null;

    if (coords.length === 1 && !radiusBounds) {
      map.setView(coords[0], 15);
      return;
    }

    const bounds = L.latLngBounds(coords);
    if (radiusBounds) bounds.extend(radiusBounds);
    map.fitBounds(bounds.pad(0.08), { animate: false });
  }, [map, points, radiusMeters, target]);

  return null;
}

export default function MapView({
  points = [],
  target = null,
  hoveredRefId = null,
  onHoverRef = null,
  selectedIds = [],
  showHeatmap = false,
  radiusMeters = null,
}) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const validPoints = useMemo(
    () => points.filter(point => Number.isFinite(point?.lat) && Number.isFinite(point?.lng)),
    [points]
  );

  const ppm2Values = validPoints.map(point => point.ppm2).filter(Number.isFinite);
  const priceMin = ppm2Values.length ? Math.min(...ppm2Values) : null;
  const priceMax = ppm2Values.length ? Math.max(...ppm2Values) : null;
  const dvfCount = validPoints.filter(point => point.source === 'dvf').length;
  const selogerCount = validPoints.filter(point => point.source === 'seloger').length;
  const radiusLabel = formatRadius(radiusMeters);
  const excludedPoints = validPoints.filter(point => point.excluded);
  const regularPoints = validPoints.filter(point => !point.excluded && !selectedSet.has(point.id) && hoveredRefId !== point.id);
  const selectedPoints = validPoints.filter(point => !point.excluded && selectedSet.has(point.id) && hoveredRefId !== point.id);
  const hoveredPoints = validPoints.filter(point => hoveredRefId === point.id);

  return (
    <div className="map-view">
      <div className="map-legend">
        <span><i className="map-legend-dot legend-dvf" /> DVF</span>
        <span><i className="map-legend-dot legend-sl" /> SeLoger</span>
        <span><i className="map-legend-dot legend-target" /> Cible</span>
        {showHeatmap && <span><i className="map-legend-dot legend-heat" /> Intensite prix</span>}
      </div>

      <div className="map-meta">
        {radiusLabel && <span className="map-badge">Rayon {radiusLabel}</span>}
        <span className="map-badge">{validPoints.length} refs</span>
        {dvfCount > 0 && <span className="map-badge map-badge-dvf">{dvfCount} DVF</span>}
        {selogerCount > 0 && <span className="map-badge map-badge-sl">{selogerCount} SL</span>}
      </div>

      <MapContainer
        center={[target?.lat || 48.8566, target?.lng || 2.3522]}
        zoom={14}
        zoomControl={false}
        className="map-canvas"
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds points={validPoints} target={target} radiusMeters={radiusMeters} />

        {Number.isFinite(target?.lat) && Number.isFinite(target?.lng) && Number.isFinite(radiusMeters) && radiusMeters > 0 && (
          <>
            <Circle
              center={[target.lat, target.lng]}
              radius={radiusMeters}
              pathOptions={{
                color: '#60a5fa',
                weight: 1.6,
                opacity: 0.9,
                dashArray: '7 9',
                fillColor: '#60a5fa',
                fillOpacity: 0.06,
              }}
            />
            <Circle
              center={[target.lat, target.lng]}
              radius={Math.min(Math.max(radiusMeters * 0.12, 36), 80)}
              pathOptions={{
                stroke: false,
                fillColor: '#ef4444',
                fillOpacity: 0.14,
              }}
            />
          </>
        )}

        {showHeatmap && validPoints.map(point => (
          <Circle
            key={`${point.id}_heat`}
            center={[point.lat, point.lng]}
            radius={point.source === 'dvf' ? 160 : 125}
            pathOptions={{
              stroke: false,
              fillColor: heatColor(point.ppm2, priceMin, priceMax),
              fillOpacity: point.excluded ? 0.02 : 0.12,
            }}
          />
        ))}

        {excludedPoints.map(point => {
          const hovered = hoveredRefId === point.id;
          const selected = selectedSet.has(point.id);
          return (
            <CircleMarker
              key={point.id}
              center={[point.lat, point.lng]}
              radius={markerRadius(point, hovered, selected)}
              pathOptions={{
                color: markerStrokeColor(point, hovered, selected),
                weight: markerWeight(point, hovered, selected),
                fillColor: markerFillColor(point, hovered, selected),
                fillOpacity: markerOpacity(point, hovered, selected),
              }}
              eventHandlers={{
                mouseover: () => onHoverRef?.(point.id),
                mouseout: () => onHoverRef?.(null),
                click: () => onHoverRef?.(point.id),
              }}
            >
              <Popup>
                <div className="map-popup">
                  <strong>{point.address || 'Reference'}</strong>
                  <span>{point.source === 'dvf' ? 'DVF' : 'SeLoger'}</span>
                  <span>{formatPrice(point.price)}</span>
                  <span>{Number.isFinite(point.ppm2) ? `${point.ppm2.toLocaleString('fr-FR')} EUR/m2` : '-'}</span>
                  <span>{Number.isFinite(point.area) ? `${point.area} m2` : '-'}</span>
                  <span>{formatDate(point.date)}</span>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {regularPoints.map(point => {
          const hovered = false;
          const selected = false;
          return (
            <CircleMarker
              key={point.id}
              center={[point.lat, point.lng]}
              radius={markerRadius(point, hovered, selected)}
              pathOptions={{
                color: markerStrokeColor(point, hovered, selected),
                weight: markerWeight(point, hovered, selected),
                fillColor: markerFillColor(point, hovered, selected),
                fillOpacity: markerOpacity(point, hovered, selected),
              }}
              eventHandlers={{
                mouseover: () => onHoverRef?.(point.id),
                mouseout: () => onHoverRef?.(null),
                click: () => onHoverRef?.(point.id),
              }}
            >
              <Popup>
                <div className="map-popup">
                  <strong>{point.address || 'Reference'}</strong>
                  <span>{point.source === 'dvf' ? 'DVF' : 'SeLoger'}</span>
                  <span>{formatPrice(point.price)}</span>
                  <span>{Number.isFinite(point.ppm2) ? `${point.ppm2.toLocaleString('fr-FR')} EUR/m2` : '-'}</span>
                  <span>{Number.isFinite(point.area) ? `${point.area} m2` : '-'}</span>
                  <span>{formatDate(point.date)}</span>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {selectedPoints.map(point => {
          const hovered = false;
          const selected = true;
          return (
            <CircleMarker
              key={point.id}
              center={[point.lat, point.lng]}
              radius={markerRadius(point, hovered, selected)}
              pathOptions={{
                color: markerStrokeColor(point, hovered, selected),
                weight: markerWeight(point, hovered, selected),
                fillColor: markerFillColor(point, hovered, selected),
                fillOpacity: markerOpacity(point, hovered, selected),
              }}
              eventHandlers={{
                mouseover: () => onHoverRef?.(point.id),
                mouseout: () => onHoverRef?.(null),
                click: () => onHoverRef?.(point.id),
              }}
            >
              <Popup>
                <div className="map-popup">
                  <strong>{point.address || 'Reference'}</strong>
                  <span>{point.source === 'dvf' ? 'DVF' : 'SeLoger'}</span>
                  <span>{formatPrice(point.price)}</span>
                  <span>{Number.isFinite(point.ppm2) ? `${point.ppm2.toLocaleString('fr-FR')} EUR/m2` : '-'}</span>
                  <span>{Number.isFinite(point.area) ? `${point.area} m2` : '-'}</span>
                  <span>{formatDate(point.date)}</span>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {hoveredPoints.map(point => {
          const hovered = hoveredRefId === point.id;
          const selected = selectedSet.has(point.id);
          return (
            <CircleMarker
              key={point.id}
              center={[point.lat, point.lng]}
              radius={markerRadius(point, hovered, selected)}
              pathOptions={{
                color: markerStrokeColor(point, hovered, selected),
                weight: markerWeight(point, hovered, selected),
                fillColor: markerFillColor(point, hovered, selected),
                fillOpacity: markerOpacity(point, hovered, selected),
              }}
              eventHandlers={{
                mouseover: () => onHoverRef?.(point.id),
                mouseout: () => onHoverRef?.(null),
                click: () => onHoverRef?.(point.id),
              }}
            >
              <Popup>
                <div className="map-popup">
                  <strong>{point.address || 'Reference'}</strong>
                  <span>{point.source === 'dvf' ? 'DVF' : 'SeLoger'}</span>
                  <span>{formatPrice(point.price)}</span>
                  <span>{Number.isFinite(point.ppm2) ? `${point.ppm2.toLocaleString('fr-FR')} EUR/m2` : '-'}</span>
                  <span>{Number.isFinite(point.area) ? `${point.area} m2` : '-'}</span>
                  <span>{formatDate(point.date)}</span>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {Number.isFinite(target?.lat) && Number.isFinite(target?.lng) && (
          <>
            <CircleMarker
              center={[target.lat, target.lng]}
              radius={13}
              pathOptions={{
                color: '#7f1d1d',
                weight: 3,
                fillColor: '#ef4444',
                fillOpacity: 0.96,
              }}
            >
              <Popup>
                <div className="map-popup">
                  <strong>{target.address || 'Bien cible'}</strong>
                  <span>Bien cible</span>
                  <span>{Number.isFinite(target.surfaceM2) ? `${target.surfaceM2} m2` : '-'}</span>
                  <span>{target.type === 'House' ? 'Maison' : 'Appartement'}</span>
                </div>
              </Popup>
            </CircleMarker>
            <CircleMarker
              center={[target.lat, target.lng]}
              radius={5}
              interactive={false}
              pathOptions={{
                color: '#ffffff',
                weight: 2,
                fillColor: '#991b1b',
                fillOpacity: 1,
              }}
            />
          </>
        )}
      </MapContainer>
    </div>
  );
}
