import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { riskLevel } from "@/utils/risk";

export type MapPoint = {
  id: number;
  label: string;
  lat: number;
  lng: number;
  delay_rate: number;
  total_orders: number;
};

const COLORS = {
  low: "#087f5b",
  medium: "#d9921b",
  high: "#e5483d",
} as const;

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const LABELED_ORIGINS = 5;
const BRAZIL_CENTER: [number, number] = [-14.2, -51.9];

const BRAZIL_BOUNDS: [[number, number], [number, number]] = [
  [-34.5, -74.5],
  [6, -31.5],
];

const pct = (n: number) => n.toFixed(1).replace(".", ",");
const dotRadius = (orders: number) => Math.max(5, Math.min(14, Math.sqrt(orders) / 2.5));


function LockToBrazil() {
  const map = useMap();

  useEffect(() => {
    const lock = () => {
      map.setMinZoom(0); // libera antes de calcular
      const minZoom = map.getBoundsZoom(BRAZIL_BOUNDS);
      map.setMinZoom(minZoom);
      if (map.getZoom() < minZoom) map.setZoom(minZoom);
    };

    map.setMaxBounds(BRAZIL_BOUNDS);
    lock();
    map.on("resize", lock);

    return () => {
      map.off("resize", lock);
    };
  }, [map]);

  return null;
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join(";");

  useEffect(() => {
    if (points.length === 0) return;

    if (points.length === 1) {
      map.setView(points[0], 8);
    } else {
      map.fitBounds(points, { padding: [50, 50], maxZoom: 9 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);

  return null;
}

export function RiskHeatmap({
  destination,
  origins,
  onSelectOrigin,
  loading = false,
}: {
  destination: MapPoint | null;
  origins: MapPoint[];
  onSelectOrigin?: (id: number) => void;
  loading?: boolean;
}) {
  // Menores primeiro: as origens com mais pedidos ficam por cima
  const list = origins
    .filter((o) => o.id !== destination?.id)
    .sort((a, b) => a.total_orders - b.total_orders);

  const labeledIds = new Set(list.slice(-LABELED_ORIGINS).map((o) => o.id));

  const fitPoints: [number, number][] = [
    ...(destination ? [[destination.lat, destination.lng] as [number, number]] : []),
    ...list.map((o) => [o.lat, o.lng] as [number, number]),
  ];

  const destColor = destination ? COLORS[riskLevel(destination.delay_rate)] : COLORS.low;

  return (
    <div className="relative isolate z-0 h-[520px] w-full select-none overflow-hidden">
      <MapContainer
        center={BRAZIL_CENTER}
        zoom={4}
        zoomSnap={0.25}
        maxBounds={BRAZIL_BOUNDS}
        maxBoundsViscosity={1}
        scrollWheelZoom
        className="h-full w-full select-none"
        style={{ background: "transparent" }}
      >
        <TileLayer url={TILE_URL} maxZoom={19} />

        <LockToBrazil />
        <FitBounds points={fitPoints} />

        {/* Linhas origem -> destino */}
        {destination &&
          list.map((o) => (
            <Polyline
              key={`line-${o.id}`}
              positions={[
                [o.lat, o.lng],
                [destination.lat, destination.lng],
              ]}
              pathOptions={{
                color: COLORS[riskLevel(o.delay_rate)],
                weight: 1.5,
                opacity: 0.6,
                dashArray: "5 5",
                interactive: false,
              }}
            />
          ))}

        {/* Cidades de origem */}
        {list.map((o) => {
          const color = COLORS[riskLevel(o.delay_rate)];

          return (
            <CircleMarker
              key={o.id}
              center={[o.lat, o.lng]}
              radius={dotRadius(o.total_orders)}
              pathOptions={{ color: "#ffffff", weight: 1.5, fillColor: color, fillOpacity: 0.85 }}
              eventHandlers={{ click: () => onSelectOrigin?.(o.id) }}
            >
              {labeledIds.has(o.id) ? (
                <Tooltip permanent direction="right" offset={[8, 0]}>
                  {o.label} · {pct(o.delay_rate)}%
                </Tooltip>
              ) : (
                <Tooltip direction="top">
                  {o.label} · {pct(o.delay_rate)}% · {o.total_orders} pedidos
                </Tooltip>
              )}
            </CircleMarker>
          );
        })}

        {/* Cidade de destino */}
        {destination && (
          <>
            <CircleMarker
              center={[destination.lat, destination.lng]}
              radius={15}
              pathOptions={{ color: destColor, weight: 2, fill: false, interactive: false }}
            />
            <CircleMarker
              center={[destination.lat, destination.lng]}
              radius={9}
              pathOptions={{ color: "#ffffff", weight: 2, fillColor: destColor, fillOpacity: 1 }}
            >
              <Tooltip permanent direction="right" offset={[14, 0]}>
                <strong>{destination.label}</strong> · {pct(destination.delay_rate)}%
              </Tooltip>
            </CircleMarker>
          </>
        )}
      </MapContainer>

      {loading && (
        <span className="absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded bg-white/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm">
          Atualizando...
        </span>
      )}

      {!loading && destination && list.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="max-w-sm rounded-xl border border-border bg-white px-6 py-4 text-center shadow-lg">
            <p className="text-base font-semibold text-black">
              Nenhuma rota com atraso encontrada para este período e filtro.
            </p>
          </div>
        </div>
      )}

      <div className="absolute bottom-6 left-3 z-[1000] flex items-center gap-3 rounded bg-white/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm">
        {(["low", "medium", "high"] as const).map((tone) => (
          <span key={tone} className="flex items-center gap-1">
            <i className="inline-block h-2 w-2 rounded-full" style={{ background: COLORS[tone] }} />
            {tone === "low" ? "Baixo" : tone === "medium" ? "Moderado" : "Alto"}
          </span>
        ))}
        <span>· tamanho = volume de pedidos</span>
      </div>
    </div>
  );
}