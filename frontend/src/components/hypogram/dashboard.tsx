import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, CalendarDays, Clock3, Package, ShieldCheck, TriangleAlert, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { number, trends } from "@/lib/hypogram-data";
import { getErrorMessage, getOverview, isCancel } from "@/services/hypolog";
import type { DeliverySummary, HeatmapPoint } from "@/types/api";
import { AppShell, ExportButton, Kpi, PageHeading, PanelHeading } from "./shared";

// ---------- Configuração ----------

const MIN_DATA_DATE = "2016-09-04";
const MAX_DATA_DATE = "2018-10-17";

const RANKING_MIN_ORDERS = 50; // cidades com menos pedidos não entram no ranking
const SUMMARY_ONLY = 1_000_000; // min_orders enorme: só queremos o "summary", sem pontos de mapa
const RANKING_SIZE = 5;

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// ---------- Datas ----------

function toIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(iso: string) {
  const [year = 2018, month = 1, day = 1] = iso.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);

/** Divide o intervalo em meses de calendário (o primeiro e o último podem ser parciais). */
function monthSegments(start: Date, end: Date) {
  const multiYear = start.getFullYear() !== end.getFullYear();
  const segments: { label: string; start: string; end: string }[] = [];

  let cursor = new Date(start.getFullYear(), start.getMonth(), 1, 12);

  while (cursor <= end) {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 12);
    const segStart = cursor < start ? start : cursor;
    const segEnd = monthEnd > end ? end : monthEnd;

    segments.push({
      label: multiYear
        ? `${MONTHS[cursor.getMonth()]}/${String(cursor.getFullYear()).slice(2)}`
        : MONTHS[cursor.getMonth()]!,
      start: toIso(segStart),
      end: toIso(segEnd),
    });

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12);
  }

  return segments;
}

// ---------- Formatação ----------

const signed = (n: number) => (n < 0 ? "−" : "") + Math.abs(n).toFixed(1).replace(".", ",");
const pct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Variação em relação ao período anterior (retorna "—" quando não há base de comparação). */
function deltas(cur: DeliverySummary | null, prev: DeliverySummary | null) {
  const none = { orders: "—", onTime: "—", delay: "—", days: "—" };
  if (!cur || !prev || prev.total_orders === 0) return none;

  return {
    orders: `${signed(((cur.total_orders - prev.total_orders) / prev.total_orders) * 100)}%`,
    onTime: `${signed(prev.delay_rate - cur.delay_rate)} p.p.`,
    delay: `${signed(cur.delay_rate - prev.delay_rate)} p.p.`,
    days:
      cur.avg_delivery_days == null || prev.avg_delivery_days == null
        ? "—"
        : `${signed(cur.avg_delivery_days - prev.avg_delivery_days)} dias`,
  };
}

// ---------- Filtro de período ----------

function PeriodFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);

  const minDate = parseDate(MIN_DATA_DATE);
  const maxDate = parseDate(MAX_DATA_DATE);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 text-[11px] font-normal"
            aria-label="Selecionar período"
          >
            <CalendarDays size={14} />
            <span>
              {value.from ? toIso(value.from).split("-").reverse().join("/") : "Data inicial"}
              {" — "}
              {value.to ? toIso(value.to).split("-").reverse().join("/") : "Data final"}
            </span>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-[280px] max-w-[calc(100vw-16px)] overflow-hidden rounded-xl p-0"
        >
          <Calendar
            mode="range"
            locale={ptBR}
            selected={value}
            onSelect={(range) => {
              if (!range) {
                onChange({ from: undefined, to: undefined });
                return;
              }

              const { from, to } = range;

              if (from && (from < minDate || from > maxDate)) return;
              if (to && (to < minDate || to > maxDate)) return;

              onChange(range);

              if (from && to) setOpen(false);
            }}
            defaultMonth={value.from ?? parseDate(MIN_DATA_DATE)}
            disabled={(date) => date < minDate || date > maxDate}
            fixedWeeks
            className="map-calendar w-full p-3 pointer-events-auto"
          />

          <p className="px-3 pb-3 text-[10px] text-muted-foreground">
            Período disponível: 04/09/2016 a 17/10/2018
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ---------- Gráfico ----------

type ChartPoint = { month: string; onTime: number | null; delay: number | null };

export function DeliveryChart({
  period = "6",
  data: dataProp,
}: {
  period?: string;
  data?: ChartPoint[];
}) {
  // Sem `data`, mantém o comportamento antigo (dados de exemplo)
  const data = dataProp ?? (period === "3" ? trends.slice(-3) : trends);

  return (
    <>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: 0, right: 16, top: 14, bottom: 6 }}>
            <defs>
              <linearGradient id="onTimeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--success)" stopOpacity={0.15} />
                <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />

            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              dy={8}
            />

            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v) => `${v}%`}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
              width={47}
            />

            <Tooltip
              formatter={(value: number, name: string) => [
                `${value}%`,
                name === "onTime" ? "Entregas no prazo" : "Entregas atrasadas",
              ]}
              contentStyle={{
                borderRadius: 6,
                borderColor: "var(--border)",
                fontSize: 11,
              }}
            />

            <Area
              isAnimationActive={false}
              type="monotone"
              dataKey="onTime"
              stroke="var(--success)"
              strokeWidth={2.5}
              fill="url(#onTimeFill)"
            />

            <Area
              isAnimationActive={false}
              type="monotone"
              dataKey="delay"
              stroke="var(--danger)"
              strokeWidth={2}
              fill="transparent"
              strokeDasharray="5 4"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-legend">
        <span>
          <i className="legend-dot dot-success" />
          Entregas no prazo
        </span>
        <span>
          <i className="legend-dot dot-danger" />
          Entregas atrasadas
        </span>
      </div>
    </>
  );
}

// ---------- Página ----------

export function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: parseDate(MIN_DATA_DATE),
    to: parseDate(MAX_DATA_DATE),
  }); // por padrão, todo o período disponível

  const [current, setCurrent] = useState<DeliverySummary | null>(null);
  const [previous, setPrevious] = useState<DeliverySummary | null>(null);
  const [series, setSeries] = useState<ChartPoint[]>([]);
  const [topCities, setTopCities] = useState<HeatmapPoint[]>([]);
  const [chartPeriod, setChartPeriod] = useState<"6" | "3">("6"); // últimos N meses do gráfico
  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { from, to } = dateRange;
    if (!from || !to) return; // só busca com período completo

    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setError(null);

    // Período anterior com o mesmo tamanho, logo antes do atual (para o "vs. período anterior")
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
    const prevTo = addDays(from, -1);
    const prevFrom = addDays(prevTo, -(days - 1));

    Promise.all([
      // período atual: totalizadores + ranking de cidades (pontos do mapa)
      getOverview(
        { start_date: toIso(from), end_date: toIso(to), min_orders: RANKING_MIN_ORDERS },
        signal,
      ),
      // período anterior: só o resumo
      getOverview(
        { start_date: toIso(prevFrom), end_date: toIso(prevTo), min_orders: SUMMARY_ONLY },
        signal,
      ),
    ])
      .then(([cur, prev]) => {
        setCurrent(cur.summary);
        setPrevious(prev.summary);

        setTopCities(
          cur.heatmap.points
            .filter((p) => p.city_id != null)
            .sort((a, b) => b.delay_rate - a.delay_rate)
            .slice(0, RANKING_SIZE),
        );
      })
      .catch((err) => {
        if (!isCancel(err)) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [dateRange.from?.getTime(), dateRange.to?.getTime()]);

  // Gráfico: últimos N meses (de calendário) até a data final
  useEffect(() => {
    const { from, to } = dateRange;
    if (!from || !to) return;

    const controller = new AbortController();
    const { signal } = controller;
    setChartLoading(true);

    // N meses de calendário terminando no mês da data final (o último pode ser parcial).
    // Ex.: final 17/10 e N=3 → Ago, Set e Out (01/10 a 17/10). Nunca começa antes do início do período.
    const firstMonth = new Date(to.getFullYear(), to.getMonth() - (Number(chartPeriod) - 1), 1, 12);
    const chartFrom = firstMonth > from ? firstMonth : from;

    // uma chamada por mês (se o backend ganhar um endpoint de série, troque aqui)
    Promise.all(
      monthSegments(chartFrom, to).map((seg) =>
        getOverview({ start_date: seg.start, end_date: seg.end, min_orders: SUMMARY_ONLY }, signal).then(
          (ov) => ({ label: seg.label, summary: ov.summary }),
        ),
      ),
    )
      .then((months) =>
        setSeries(
          months.map(({ label, summary }) =>
            summary.total_orders > 0
              ? {
                  month: label,
                  onTime: round1(100 - summary.delay_rate),
                  delay: round1(summary.delay_rate),
                }
              : { month: label, onTime: null, delay: null },
          ),
        ),
      )
      .catch((err) => {
        if (!isCancel(err)) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!signal.aborted) setChartLoading(false);
      });

    return () => controller.abort();
  }, [dateRange.from?.getTime(), dateRange.to?.getTime(), chartPeriod]);

  const emptyMonths = series.filter((p) => p.onTime == null).map((p) => p.month);

  const delta = deltas(current, previous);

  return (
    <AppShell>
      <PageHeading
        title="Visão geral"
        subtitle="Uma visão completa da sua operação. Decisões mais inteligentes, entregas no prazo."
      >
        <ExportButton />
        <Button asChild className="text-[11px]">
          <Link to="/simulador">
            <TrendingUp size={14} />
            Simular novo envio
          </Link>
        </Button>
      </PageHeading>

      <div className="filter-bar">
        <div className="filters">
          <PeriodFilter value={dateRange} onChange={setDateRange} />
          {(loading || chartLoading) && <span className="text-[10px] text-muted-foreground">Atualizando...</span>}
        </div>
      </div>

      {error && (
        <div role="alert" className="insight mb-5">
          {error}
        </div>
      )}

      <div className="kpi-grid">
        <Kpi
          label="Total de pedidos"
          value={current ? number(current.total_orders) : "—"}
          trend={delta.orders}
          note="vs. período anterior"
          icon={Package}
        />

        <Kpi
          label="Entregas no prazo"
          value={current ? pct(100 - current.delay_rate) : "—"}
          trend={delta.onTime}
          note="vs. período anterior"
          icon={ShieldCheck}
        />

        <Kpi
          label="Taxa de atraso"
          value={current ? pct(current.delay_rate) : "—"}
          trend={delta.delay}
          note="vs. período anterior"
          icon={TriangleAlert}
        />

        <Kpi
          label="Tempo médio de entrega"
          value={
            current?.avg_delivery_days != null
              ? `${current.avg_delivery_days.toFixed(1).replace(".", ",")} dias`
              : "—"
          }
          trend={delta.days}
          note="vs. período anterior"
          icon={Clock3}
        />
      </div>

      <div className="two-col">
        <section className="panel">
          <PanelHeading
            title="Evolução das entregas"
            subtitle="Pontualidade e atrasos ao longo do período"
          >
            <select
              className="select-control"
              aria-label="Intervalo do gráfico"
              value={chartPeriod}
              onChange={(e) => setChartPeriod(e.target.value as "6" | "3")}
            >
              <option value="6">Últimos 6 meses</option>
              <option value="3">Últimos 3 meses</option>
            </select>
          </PanelHeading>

          <DeliveryChart data={series} />

          {emptyMonths.length > 0 && (
            <p className="px-[22px] pb-4 text-[10px] text-muted-foreground">
              Sem entregas registradas no período em: {emptyMonths.join(", ")}.
            </p>
          )}
        </section>

        <section className="panel">
          <PanelHeading
            title="Cidades com maior risco"
            subtitle="Probabilidade de atraso por cidade de destino"
          >
            <Link to="/mapa" className="text-[10px] text-primary flex items-center gap-1">
              Ver mapa
              <ArrowRight size={12} />
            </Link>
          </PanelHeading>

          <div className="px-[22px] pb-3">
            {topCities.map((c, i) => (
              <div
                className="flex items-center gap-3 border-b border-border py-3.5 last:border-0"
                key={c.city_id}
              >
                <span className="text-[10px] text-muted-foreground w-3">0{i + 1}</span>

                <div className="w-[95px] truncate text-[11px] font-medium" title={c.label}>
                  {c.label}
                </div>

                <div className="progress-track flex-1">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(100, c.delay_rate)}%` }}
                  />
                </div>

                <span className="text-[11px] font-semibold w-12 text-right">
                  {pct(c.delay_rate)}
                </span>
              </div>
            ))}

            {!loading && topCities.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">
                Nenhuma cidade com pedidos suficientes neste período.
              </p>
            )}
          </div>

          <div className="px-[22px] pb-4 text-[9px] text-muted-foreground">
            Taxa de atraso por cidade no período (cidades com pelo menos {RANKING_MIN_ORDERS} pedidos)
          </div>
        </section>
      </div>
    </AppShell>
  );
}