import { useState } from "react";
import { Minus, Plus, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import geometry from "@/assets/brazil-map.json";
import { cities, cityRisk, type City } from "@/lib/hypogram-data";

const tone = (r: number) => (r >= 70 ? "high" : r >= 40 ? "medium" : "low");

export function BrazilMap({
  large = false,
  selected,
  onSelect,
  showRoutes = true,
  date = "2018-08-31",
  filter = "all",
}: {
  large?: boolean;
  selected?: string;
  onSelect?: (city: City) => void;
  showRoutes?: boolean;
  date?: string;
  filter?: string;
}) {
  const [zoom, setZoom] = useState(1);
  const list = cities
    .map((c) => ({ ...c, risk: cityRisk(c.risk, date) }))
    .filter((c) => filter === "all" || tone(c.risk) === filter);
  const origin = cities[0]!;
  const radius = (n: number) => Math.max(3.5, Math.min(13, Math.sqrt(n) / 12));
  return (
    <div className={`map-stage ${large ? "large" : ""}`}>
      <svg
        className="brazil-svg"
        viewBox="25 5 485 470"
        role="img"
        aria-label="Mapa de risco de atraso por cidade"
      >
        <g transform={`translate(${267 * (1 - zoom)} ${240 * (1 - zoom)}) scale(${zoom})`}>
          {Array.from({ length: 10 }, (_, i) => (
            <path key={i} className="map-grid" d={`M0 ${i * 60}H650 M${i * 65} 0V550`} />
          ))}
          {geometry.map((s) => (
            <path key={s.uf} d={s.path} className="map-state base">
              <title>{s.name}</title>
            </path>
          ))}
          {showRoutes &&
            list
              .filter((c) => c.risk >= 70)
              .map((c) => (
                <path
                  key={"r" + c.name}
                  className="map-route"
                  d={`M${origin.x} ${origin.y} Q${(origin.x + c.x) / 2 - 30} ${(origin.y + c.y) / 2} ${c.x} ${c.y}`}
                />
              ))}
          {list.map((c) => (
            <g
              key={c.name}
              className={`city-point ${tone(c.risk)} ${selected === c.name ? "selected" : ""}`}
              tabIndex={0}
              role="button"
              aria-label={`${c.name}, ${c.uf}: ${c.risk}% de risco`}
              onClick={() => onSelect?.(c)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelect?.(c);
              }}
            >
              <circle className="city-halo" cx={c.x} cy={c.y} r={radius(c.orders) + 5} />
              <circle className="city-dot" cx={c.x} cy={c.y} r={radius(c.orders)} />
              <title>{`${c.name} (${c.uf}) · ${c.risk}%`}</title>
            </g>
          ))}
          {large &&
            list
              .filter(
                (c) =>
                  (c.orders > 1800 &&
                    !["Campinas", "Niterói", "Ribeirão Preto"].includes(c.name)) ||
                  selected === c.name,
              )
              .map((c) => (
                <text
                  key={"t" + c.name}
                  x={c.x + radius(c.orders) + 3}
                  y={c.y + 3}
                  className="map-label"
                >
                  {c.name}
                </text>
              ))}
        </g>
      </svg>
      <div className="map-zoom">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Ampliar mapa"
          onClick={() => setZoom((z) => Math.min(z + 0.3, 3))}
        >
          <Plus />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Reduzir mapa"
          onClick={() => setZoom((z) => Math.max(z - 0.3, 0.8))}
        >
          <Minus />
        </Button>
        {large && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Restaurar mapa"
            onClick={() => setZoom(1)}
          >
            <Maximize2 />
          </Button>
        )}
      </div>
      <span className="map-caption">BRASIL · RISCO DE ATRASO POR CIDADE</span>
    </div>
  );
}

export function MapLegend() {
  return (
    <div className="map-footer">
      <div className="flex gap-3">
        <span>
          <i className="legend-dot dot-success" />
          Baixo
        </span>
        <span>
          <i className="legend-dot dot-warning" />
          Moderado
        </span>
        <span>
          <i className="legend-dot dot-danger" />
          Alto
        </span>
      </div>
    </div>
  );
}
