import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Check, ChevronsUpDown, MapPin } from "lucide-react";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { holidays, number } from "@/lib/hypogram-data";
import {
  getCities,
  getCriticalRoutes,
  getErrorMessage,
  getOverview,
  isCancel,
} from "@/services/hypolog";
import type { ApiCity, CriticalRoute, DeliverySummary } from "@/types/api";
import { RISK_HIGH, RISK_MEDIUM, formatDays, riskLevel, riskTone } from "@/utils/risk";
import { AppShell, ExportButton, PageHeading, PanelHeading, RiskPill } from "./shared";
import type { MapPoint } from "./risk-heatmap";

// ---------- Configuração ----------

const MIN_DATA_DATE = "2016-09-04";
const MAX_DATA_DATE = "2018-10-17";

const ROUTE_LIMIT = 50; 
const LIST_LIMIT = 10; 
const MIN_ROUTE_ORDERS = 1; 

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromIso = (s: string) => new Date(`${s}T12:00:00`);
const br = (s: string) => s.split("-").reverse().join("/");

const minDate = fromIso(MIN_DATA_DATE);
const maxDate = fromIso(MAX_DATA_DATE);
const holidayDates = holidays.map((h) => fromIso(h.date));

// Remove acentos e maiúsculas para a busca de cidade
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

type Coords = { lat: number; lng: number };

// ---------- Página ----------

type RiskMapComponent = typeof import("./risk-heatmap").RiskHeatmap;

export function MapPage() {
  const [RiskMap, setRiskMap] = useState<RiskMapComponent | null>(null);

  useEffect(() => {
    import("./risk-heatmap").then((m) => setRiskMap(() => m.RiskHeatmap));
  }, []);

  const [range, setRange] = useState<DateRange>({ from: minDate, to: maxDate });
  const [periodOpen, setPeriodOpen] = useState(false);

  const [cities, setCities] = useState<ApiCity[]>([]);
  const [coords, setCoords] = useState<Map<number, Coords>>(new Map()); // city_id -> lat/lng
  const [city, setCity] = useState<ApiCity | null>(null); // cidade de destino
  const [cityOpen, setCityOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");

  const [risk, setRisk] = useState("all");

  const [summary, setSummary] = useState<DeliverySummary | null>(null);
  const [routes, setRoutes] = useState<CriticalRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDate = range.from ? toIso(range.from) : undefined;
  const endDate = range.to ? toIso(range.to) : undefined;
  const periodReady = !!range.from && !!range.to; // só busca com "de" e "até"

  // 1) Ao abrir: carrega as cidades + coordenadas de cada cidade (lat/lng)
  //    e já seleciona São Paulo (ou a primeira da lista).
  useEffect(() => {
    const controller = new AbortController();

    Promise.all([getCities(controller.signal), getOverview({ min_orders: 1 }, controller.signal)])
      .then(([cityList, national]) => {
        const map = new Map<number, Coords>();
        for (const p of national.heatmap.points) {
          if (p.city_id != null) map.set(p.city_id, { lat: p.lat, lng: p.lng });
        }

        setCities(cityList);
        setCoords(map);
        setCity(
          (prev) =>
            prev ??
            cityList.find((c) => normalize(c.city_name) === "sao paulo" && c.state_code === "SP") ??
            cityList[0] ??
            null,
        );
      })
      .catch((err) => {
        if (!isCancel(err)) setError(getErrorMessage(err));
      });

    return () => controller.abort();
  }, []);

  // 2) Ao mudar cidade ou período: indicadores da cidade + rotas que chegam nela
  useEffect(() => {
    if (!city || !periodReady || !startDate || !endDate) return;

    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setError(null);

    Promise.all([
      getOverview({ start_date: startDate, end_date: endDate, city_id: city.city_id }, signal),
      getCriticalRoutes(
        {
          city_id: city.city_id,
          start_date: startDate,
          end_date: endDate,
          limit: ROUTE_LIMIT,
          min_orders: MIN_ROUTE_ORDERS,
        },
        signal,
      )])
      .then(([overview, routesData]) => {
        setSummary(overview.summary);
        setRoutes(routesData.routes);
      })
      .catch((err) => {
        if (!isCancel(err)) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [startDate, endDate, city?.city_id, periodReady]);

  // Cidades filtradas enquanto o usuário digita (sem acento / sem maiúsculas)
  const filteredCities = useMemo(() => {
    const term = normalize(citySearch.trim());
    const list = term
      ? cities.filter((c) => normalize(`${c.city_name} ${c.state_code}`).includes(term))
      : cities;
    return list.slice(0, 50); // evita renderizar milhares de itens
  }, [cities, citySearch]);

  const selectCity = (next: ApiCity) => {
    setCity(next);
    setCitySearch("");
    setCityOpen(false);
  };

  // Rotas filtradas pelo nível de risco
  const visibleRoutes = routes.filter((r) => risk === "all" || riskLevel(r.delay_rate) === risk);

  // Origens que podem ser desenhadas (precisam de coordenadas)
  const origins: MapPoint[] = visibleRoutes.flatMap((r) => {
    const c = coords.get(r.origin.city_id);
    return c
      ? [
          {
            id: r.origin.city_id,
            label: r.origin.city_name,
            lat: c.lat,
            lng: c.lng,
            delay_rate: r.delay_rate,
            total_orders: r.total_orders,
          },
        ]
      : [];
  });
  const hiddenOrigins = visibleRoutes.length - origins.length;

  const destCoords = city ? coords.get(city.city_id) : undefined;
  const destination: MapPoint | null =
    city && destCoords
      ? {
          id: city.city_id,
          label: city.city_name,
          lat: destCoords.lat,
          lng: destCoords.lng,
          delay_rate: summary?.delay_rate ?? 0,
          total_orders: summary?.total_orders ?? 0,
        }
      : null;

  const selectFromMap = (id: number) => {
    const route = routes.find((r) => r.origin.city_id === id);
    if (route) selectCity(route.origin);
  };

  const score = summary ? Math.round(summary.delay_rate) : 0;

  const periodLabel =
    range.from && range.to
      ? `${br(toIso(range.from))} — ${br(toIso(range.to))}`
      : range.from
        ? `${br(toIso(range.from))} — escolha a data final`
        : "Selecionar período";

  return (
    <AppShell>
      <PageHeading title="Mapa de risco" subtitle="Veja de onde vêm as entregas e a chance de atraso de cada rota.">
        <ExportButton />
      </PageHeading>

      <div className="filter-bar">
        <div className="filters filters-map">
          {/* Período */}
          <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" aria-label="Selecionar período">
                <CalendarDays size={15} />
                {periodLabel}
              </Button>
            </PopoverTrigger>

            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                locale={ptBR}
                mode="range"
                selected={range}
                onSelect={(next) => {
                  setRange(next ?? { from: undefined, to: undefined });
                  if (next?.from && next?.to) setPeriodOpen(false);
                }}
                defaultMonth={range.from ?? minDate}
                disabled={(date) => date < minDate || date > maxDate}
                fixedWeeks
                modifiers={{ holiday: holidayDates }}
                modifiersClassNames={{ holiday: "calendar-holiday" }}
                className="map-calendar p-3 pointer-events-auto"
              />
              <p className="px-3 pb-3 text-[10px] text-muted-foreground">
                Período disponível: {br(MIN_DATA_DATE)} a {br(MAX_DATA_DATE)}
              </p>
            </PopoverContent>
          </Popover>

          {/* Cidade de destino: dá para digitar para filtrar */}
          <Popover open={cityOpen} onOpenChange={setCityOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={cityOpen}
                className="city-combo"
              >
                <MapPin size={15} />
                <span className="truncate">
                  {city ? `${city.city_name} (${city.state_code})` : "Carregando cidades..."}
                </span>
                <ChevronsUpDown size={14} className="ml-auto shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[260px] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Digite o nome da cidade..."
                  value={citySearch}
                  onValueChange={setCitySearch}
                />
                <CommandList>
                  <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
                  <CommandGroup>
                    {filteredCities.map((c) => (
                      <CommandItem
                        key={c.city_id}
                        value={String(c.city_id)}
                        onSelect={() => selectCity(c)}
                      >
                        <Check
                          size={15}
                          className={`mr-2 ${
                            city?.city_id === c.city_id ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        {c.city_name} ({c.state_code})
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Nível de risco */}
          <select
            className="select-control"
            aria-label="Nível de risco"
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
          >
            <option value="all">Todos os níveis de risco</option>
            <option value="high">Alto risco</option>
            <option value="medium">Risco moderado</option>
            <option value="low">Baixo risco</option>
          </select>
        </div>
      </div>

      {error && (
        <div role="alert" className="insight mb-5">
          {error}
        </div>
      )}

      <div className="two-col">
        <section className="panel">
          <PanelHeading
            title={city ? `Entregas para ${city.city_name}` : "Risco por rota"}
            subtitle={
              periodReady && startDate && endDate
                ? `Envios de ${br(startDate)} a ${br(endDate)}`
                : "Selecione a data final para atualizar o mapa"
            }
          >
            <span className="risk-pill low">
              {loading ? "Carregando..." : `${origins.length} origens`}
            </span>
          </PanelHeading>

          {city && RiskMap ? (
            <RiskMap
              destination={destination}
              origins={origins}
              onSelectOrigin={selectFromMap}
              loading={loading}
            />
          ) : (
            <div className="p-6 text-sm text-muted-foreground">Carregando mapa...</div>
          )}

          {hiddenOrigins > 0 && (
            <p className="px-[22px] pb-4 text-[10px] text-muted-foreground">
              {hiddenOrigins} {hiddenOrigins === 1 ? "origem não aparece" : "origens não aparecem"} no
              mapa por falta de coordenadas, mas {hiddenOrigins === 1 ? "está" : "estão"} na lista ao lado.
            </p>
          )}
        </section>

        <div className="flex flex-col gap-5">
          <section className="panel">
            <PanelHeading
              title={city ? `${city.city_name} · ${city.state_code}` : "Cidade"}
              subtitle="Pedidos recebidos no período selecionado"
            >
              <MapPin size={18} className="text-primary" />
            </PanelHeading>

            {summary && (
              <div className="px-[22px] pb-[22px]">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <div className={`text-4xl font-semibold ${riskTone(score)}`}>
                      {summary.delay_rate.toFixed(1).replace(".", ",")}%
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Chance de atraso nesta cidade
                    </p>
                  </div>
                  <RiskPill risk={score} />
                </div>

                <div className="stat-row">
                  <span className="text-muted-foreground">Pedidos analisados</span>
                  <b>{number(summary.total_orders)}</b>
                </div>
                <div className="stat-row">
                  <span className="text-muted-foreground">Pedidos atrasados</span>
                  <b>{number(summary.delayed_orders)}</b>
                </div>
                <div className="stat-row">
                  <span className="text-muted-foreground">Tempo médio de entrega</span>
                  <b>{formatDays(summary.avg_delivery_days)}</b>
                </div>

                <div className="mt-5 insight">
                  {summary.total_orders === 0
                    ? "Sem pedidos no período selecionado."
                    : score >= RISK_HIGH
                      ? "Alto risco. Considere ampliar o prazo prometido."
                      : score >= RISK_MEDIUM
                        ? "Risco moderado. Acompanhe os pedidos desta região."
                        : "Baixo risco estimado para esta região."}
                </div>
              </div>
            )}
          </section>

          <section className="panel">
            <PanelHeading
              title="Rotas com maior chance de atraso"
              subtitle={city ? `Origens → ${city.city_name}` : "Escolha uma cidade"}
            />

            <div className="route-list">
              {city &&
                visibleRoutes.slice(0, LIST_LIMIT).map((route) => (
                  <div className="route-row" key={route.origin.city_id}>
                    <div>
                      <div className="text-xs font-medium">
                        {route.origin.city_name}, {route.origin.state_code}
                        <ArrowRight size={11} className="inline mx-1" />
                        {city.city_name}
                      </div>
                      <small>
                        {number(route.total_orders)} pedidos · {formatDays(route.avg_delivery_days)}
                      </small>
                    </div>
                    <span className={`font-semibold text-sm ${riskTone(route.delay_rate)}`}>
                      {route.delay_rate.toFixed(1).replace(".", ",")}%
                    </span>
                  </div>
                ))}

              {city && !loading && visibleRoutes.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">
                  Nenhuma rota encontrada para este período e filtro.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}