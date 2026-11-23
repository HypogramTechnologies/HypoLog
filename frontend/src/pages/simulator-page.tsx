import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Box,
  Download,
  FlaskConical,
  MapPin,
  RotateCcw,
  Sparkles,
  Truck,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/hypogram-data";
import { AppShell, PageHeading, PanelHeading } from "../components/hypogram/shared";
import { getErrorMessage, isCancel, simulateShipment } from "@/services/hypolog";
import type { RiskLevel, SimulationResult } from "@/types/api";
import { toast } from "sonner";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ptBR } from "date-fns/locale";

const initial = {
  origin: "01001-000",
  destination: "69005-010",
  weight: "2.5",
  orderValue: "150",
  height: "20",
  width: "30",
  length: "40",
  days: "10",
};
// Nível de risco vem da API (os limites são os do modelo), não do valor do percentual
const RISK_STYLE: Record<RiskLevel, { label: string; pill: string; dot: string; text: string }> = {
  high: { label: "Alto risco", pill: "high", dot: "danger", text: "text-danger" },
  moderate: { label: "Risco moderado", pill: "medium", dot: "warning", text: "text-warning" },
  low: { label: "Baixo risco", pill: "low", dot: "success", text: "text-success" },
};

const INSIGHT: Record<RiskLevel, string> = {
  high: "Considere ampliar o prazo de entrega ou revisar a rota de despacho para reduzir a exposição ao risco.",
  moderate:
    "Há um risco relevante de atraso. Avalie ampliar o prazo prometido e acompanhe o despacho de perto.",
  low: "O envio apresenta condições favoráveis. Acompanhe o despacho e mantenha o cliente informado.",
};

const formatPercent = (value: number) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function SimulatorPage() {
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const pendingRequest = useRef<AbortController | null>(null);
  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const fromIso = (s: string) => new Date(`${s}T12:00:00`);

  const br = (s: string) => s.split("-").reverse().join("/");

  const [date, setDate] = useState(() => toIso(new Date()));
  const [open, setOpen] = useState(false);
  useEffect(
    () => () => {
      pendingRequest.current?.abort();
    },
    [],
  );
  const invalidateSimulation = () => {
    pendingRequest.current?.abort();
    pendingRequest.current = null;
    setLoading(false);
    setResult(null);
  };
  const set = (key: keyof typeof initial, value: string) => {
    invalidateSimulation();
    setForm((s) => ({ ...s, [key]: value }));
  };
  const field = (
    key: keyof typeof initial,
    label: string,
    type = "number",
    step = "0.1",
    min = "0.1",
  ) => (
    <div className="field">
      <label htmlFor={key}>{label}</label>
      <input
        id={key}
        value={form[key]}
        type={type}
        required
        min={type === "number" ? min : undefined}
        step={type === "number" ? step : undefined}
        max={type === "number" ? "1000000" : undefined}
        pattern={type === "text" ? "[0-9]{5}-?[0-9]{3}" : undefined}
        onChange={(e) => set(key, e.target.value)}
      />
    </div>
  );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    invalidateSimulation();
    const controller = new AbortController();
    pendingRequest.current = controller;
    setLoading(true);
    try {
      const data = await simulateShipment(
        {
          origin_zip: form.origin,
          destination_zip: form.destination,
          weight_kg: Number(form.weight),
          order_value: Number(form.orderValue),
          height_cm: Number(form.height),
          width_cm: Number(form.width),
          length_cm: Number(form.length),
          estimated_days: Number(form.days),
          purchase_date: date,
        },
        controller.signal,
      );
      setResult(data);
      toast.success("Simulação de risco de atraso concluída.");
    } catch (err) {
      if (isCancel(err)) return;
      toast.error(getErrorMessage(err));
    } finally {
      if (pendingRequest.current === controller) {
        pendingRequest.current = null;
        setLoading(false);
      }
    }
  };
  const risk = result ? RISK_STYLE[result.risk_level] : null;
  return (
    <AppShell>
      <PageHeading
        title="Simulador de risco"
        subtitle="Avalie um novo envio e antecipe possíveis atrasos antes do despacho."
      >
        <span className="risk-pill low">
          <Sparkles size={12} />
          Análise preditiva
        </span>
      </PageHeading>
      <div className="section-grid">
        <form className="panel" onSubmit={submit}>
          <PanelHeading
            title="Dados do envio"
            subtitle="Informações logísticas para a análise de risco"
          />
          <section className="form-section">
            <h3>
              <MapPin size={16} className="text-primary" />
              Origem e destino
            </h3>
            <div className="field-grid">
              {field("origin", "CEP de origem", "text")}
              {field("destination", "CEP de destino", "text")}
            </div>
          </section>
          <section className="form-section">
            <h3>
              <Box size={16} className="text-primary" />
              Características do pacote
            </h3>
            <div className="field-grid">
              {field("weight", "Peso (kg)")}
              {field("height", "Altura (cm)")}
              {field("width", "Largura (cm)")}
              {field("length", "Comprimento (cm)")}
              {field("orderValue", "Valor do pedido (R$)", "number", "0.01", "0")}
            </div>
          </section>
          <section className="form-section">
            <h3>
              <Truck size={16} className="text-primary" />
              Prazo
            </h3>

            <div className="field-grid">
              <div className="field">
                <label>Data de envio</label>

                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarDays size={16} className="mr-2" />
                      {br(date)}
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent align="start" className="w-auto p-0">
                    <Calendar
                      mode="single"
                      locale={ptBR}
                      selected={fromIso(date)}
                      defaultMonth={fromIso(date)}
                      fixedWeeks
                      onSelect={(d) => {
                        if (d) {
                          invalidateSimulation();
                          setDate(toIso(d));
                          setOpen(false);
                        }
                      }}
                      className="map-calendar p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {field("days", "Prazo estimado (dias)", "number", "1", "1")}
            </div>
          </section>
          <div className="p-[22px] flex gap-3">
            <Button type="submit" disabled={loading} className="flex-1">
              <FlaskConical />
              {loading ? "Analisando envio…" : "Calcular risco de atraso"}
            </Button>
            <Button
              variant="outline"
              type="button"
              size="icon"
              aria-label="Limpar simulação"
              onClick={() => {
                invalidateSimulation();
                setForm(initial);
                setDate(toIso(new Date()));
                setOpen(false);
              }}
            >
              <RotateCcw />
            </Button>
          </div>
        </form>
        <div>
          <section className="panel result-panel">
            <div className="flex items-center justify-between">
              <h2 className="panel-title">Diagnóstico do envio</h2>
              <Sparkles size={18} className="text-primary" />
            </div>
            {result === null || risk === null ? (
              <div className="empty-state py-20">
                <span className="report-icon mx-auto">
                  <FlaskConical size={22} />
                </span>
                <h3 className="text-base font-semibold text-foreground">
                  Cada entrega merece uma previsão.
                </h3>
                <p className="mt-3 text-xs leading-6">
                  Aguardando os dados do envio
                  <br />
                  para calcular a probabilidade de atraso.
                </p>
              </div>
            ) : (
              <>
                <div className={`result-score ${risk.text}`}>
                  {formatPercent(result.delay_probability)}
                  <span className="text-3xl">%</span>
                </div>
                <p className="text-xs text-muted-foreground mb-5">
                  Probabilidade estimada de atraso
                </p>
                <span className={`risk-pill ${risk.pill}`}>
                  <span className={`legend-dot dot-${risk.dot}`} />
                  {risk.label}
                </span>
                <div className="result-meter">
                  <div
                    className="result-meter-fill"
                    style={{ width: `${Math.min(100, result.delay_probability)}%` }}
                  />
                </div>
                <div className="stat-row">
                  <span className="text-muted-foreground">Prazo informado</span>
                  <b>{form.days} dias</b>
                </div>
                <div className="stat-row">
                  <span className="text-muted-foreground">Peso do pacote</span>
                  <b>{form.weight} kg</b>
                </div>
                <div className="insight mt-5">{INSIGHT[result.risk_level]}</div>
                <Button
                  className="w-full mt-5"
                  variant="outline"
                  onClick={() => {
                    downloadCsv(
                      [
                        {
                          ...form,
                          probabilidade: result.delay_probability,
                          nivel_de_risco: risk.label,
                          modelo: result.model.name,
                        },
                      ],
                      "hypogram-simulacao",
                    );
                    toast.success("Simulação exportada");
                  }}
                >
                  <Download />
                  Exportar análise
                </Button>
              </>
            )}
          </section>
          <div className="insight mt-5 flex items-start gap-2">
            <TriangleAlert size={16} className="text-warning shrink-0 mt-1" />A probabilidade de
            atraso é um indicador de apoio à decisão e não uma garantia do prazo de entrega.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
