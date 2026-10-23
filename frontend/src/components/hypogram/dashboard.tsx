import { useState } from "react";
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
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Package,
  ShieldCheck,
  TriangleAlert,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { cities, number, orders, trends, type Order } from "@/lib/hypogram-data";
import { AppShell, ExportButton, Kpi, OrderDetail, PageHeading, PanelHeading } from "./shared";
import { BrazilMap, MapLegend } from "./brazil-map";

const MIN_DATA_DATE = "2016-09-04";
const MAX_DATA_DATE = "2018-10-17";

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

function PeriodFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [startText, setStartText] = useState(value.from ? toIso(value.from) : "");
  const [endText, setEndText] = useState(value.to ? toIso(value.to) : "");

  const minDate = parseDate(MIN_DATA_DATE);
  const maxDate = parseDate(MAX_DATA_DATE);

  const updateDate = (field: "from" | "to", iso: string) => {
    if (!iso) return;

    const date = parseDate(iso);

    if (field === "from") {
      onChange({
        from: date,
        to: value.to && date <= value.to ? value.to : undefined,
      });
      setStartText(iso);
    } else {
      onChange({
        from: value.from,
        to: date,
      });
      setEndText(iso);
    }
  };

  const handleTextChange = (field: "from" | "to", text: string) => {
    if (field === "from") {
      setStartText(text);
    } else {
      setEndText(text);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const date = parseDate(text);

      if (date >= minDate && date <= maxDate && toIso(date) === text) {
        updateDate(field, text);
      }
    }
  };

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

              const from = range.from;
              const to = range.to;

              if (from && (from < minDate || from > maxDate)) return;
              if (to && (to < minDate || to > maxDate)) return;

              onChange(range);

              if (from && to) {
                setOpen(false);
              }
            }}
            defaultMonth={value.from ?? parseDate("2018-03-01")}
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

export function DeliveryChart({ period = "6" }: { period?: string }) {
  const data = period === "3" ? trends.slice(-3) : trends;

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

export function Dashboard() {
  const [period, setPeriod] = useState("6");

  const [dateRange, setDateRange] = useState<DateRange>({
    from: parseDate("2018-03-01"),
    to: parseDate("2018-08-31"),
  });

  const [uf, setUf] = useState("all");
  const [detail, setDetail] = useState<Order | null>(null);

  const critical = orders.filter((o) => o.risk >= 70 && (uf === "all" || o.uf === uf)).slice(0, 4);

  const filtered = uf !== "all";

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

          <select
            className="select-control"
            aria-label="Filtrar estado"
            value={uf}
            onChange={(e) => setUf(e.target.value)}
          >
            <option value="all">Todos os estados</option>
            {["SP", "RJ", "BA", "AM", "PA", "CE", "PE"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
          <span className="live-dot" />
          Atualizado em 31 ago 2018
        </span> */}
      </div>

      <div className="kpi-grid">
        <Kpi
          label="Total de pedidos"
          value={
            filtered
              ? number(orders.filter((o) => uf === "all" || o.uf === uf).length)
              : period === "3"
                ? "48.732"
                : "99.441"
          }
          trend="12,8%"
          note="vs. período anterior"
          icon={Package}
        />

        <Kpi
          label="Entregas no prazo"
          value={uf === "AM" ? "74,2%" : "92,4%"}
          trend="2,3%"
          note="vs. período anterior"
          icon={ShieldCheck}
        />

        <Kpi
          label="Taxa de atraso"
          value={uf === "AM" ? "25,8%" : "7,6%"}
          trend="−1,8%"
          note="vs. período anterior"
          icon={TriangleAlert}
        />

        <Kpi
          label="Tempo médio de entrega"
          value={uf === "AM" ? "22,4 dias" : "12,3 dias"}
          trend="−1,2 dias"
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
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="6">Últimos 6 meses</option>
              <option value="3">Últimos 3 meses</option>
            </select>
          </PanelHeading>

          <DeliveryChart period={period} />
        </section>

        <section className="panel">
          <PanelHeading
            title="Mapa de risco logístico"
            subtitle="Regiões com maior probabilidade de atraso"
          >
            <Link to="/mapa" className="text-[10px] text-primary flex items-center gap-1">
              Ver mapa
              <ArrowRight size={12} />
            </Link>
          </PanelHeading>

          <BrazilMap onSelect={(c) => setUf(c.uf)} />
          <MapLegend />
        </section>
      </div>

      <div className="two-col">
        {/*
        <section className="panel">
          <PanelHeading
            title="Pedidos que precisam de atenção"
            subtitle="Envios com alto risco de atraso"
          >
            <span className="risk-pill high">
              {filtered ? critical.length : "148"} pedidos
            </span>
          </PanelHeading>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Destino</th>
                  <th>Risco de atraso</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {critical.map((o) => (
                  <tr key={o.id}>
                    <td className="font-medium">#{o.id.slice(3)}</td>
                    <td>
                      {o.city}
                      <div className="mt-1 text-[9px] text-muted-foreground">
                        {o.uf}
                      </div>
                    </td>
                    <td>
                      <span className="text-danger font-semibold">
                        {o.risk}%
                      </span>
                      <div className="mt-1 text-[9px] text-muted-foreground">
                        Alto risco
                      </div>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Ver pedido ${o.id}`}
                        onClick={() => setDetail(o)}
                      >
                        <ArrowRight size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!critical.length && (
              <div className="empty-state">
                Nenhum pedido crítico para os filtros selecionados.
              </div>
            )}
          </div>
          <div className="table-foot">
            <span>Monitoramento preventivo de entregas</span>
            <Link to="/pedidos" className="text-primary flex items-center gap-1">
              Ver todos os pedidos
              <ArrowRight size={12} />
            </Link>
          </div>
        </section>
        */}

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
            {[...cities]
              .sort((a, b) => b.risk - a.risk)
              .slice(0, 4)
              .map((c, i) => (
                <div
                  className="flex items-center gap-3 border-b border-border py-3.5 last:border-0"
                  key={c.name}
                >
                  <span className="text-[10px] text-muted-foreground w-3">0{i + 1}</span>

                  <div className="w-[95px] text-[11px] font-medium">{c.name}</div>

                  <div className="progress-track flex-1">
                    <div className="progress-fill" style={{ width: `${c.risk}%` }} />
                  </div>

                  <span className="text-[11px] font-semibold w-10 text-right">{c.risk}%</span>
                </div>
              ))}
          </div>

          <div className="px-[22px] pb-4 text-[9px] text-muted-foreground">
            Probabilidade histórica de atraso nas entregas para cada cidade
          </div>
        </section>
      </div>

      <div className="insight flex items-start gap-3">
        <TriangleAlert size={18} className="text-warning shrink-0 mt-0.5" />

        <div>
          <span className="font-semibold">Atenção às rotas do Norte e Nordeste.</span> Manaus e
          Salvador concentram os maiores índices de atraso. Antecipe ações com o simulador de risco.
        </div>

        <Link
          to="/simulador"
          className="ml-auto shrink-0 text-primary font-medium text-[10px] flex items-center gap-1"
        >
          Analisar risco
          <ArrowRight size={13} />
        </Link>
      </div>

      <OrderDetail order={detail} onClose={() => setDetail(null)} />
    </AppShell>
  );
}
