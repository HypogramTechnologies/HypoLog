import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Box,
  Check,
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
import { AppShell, PageHeading, PanelHeading, RiskPill } from "../components/hypogram/shared";
import { toast } from "sonner";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ptBR } from "date-fns/locale";

const initial = {
  origin: "01001-000",
  destination: "69005-010",
  weight: "2.5",
  height: "20",
  width: "30",
  length: "40",
  days: "10",
};
export function SimulatorPage() {
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const pendingSimulation = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const fromIso = (s: string) => new Date(`${s}T12:00:00`);

  const br = (s: string) => s.split("-").reverse().join("/");

  const [date, setDate] = useState(() => toIso(new Date()));
  const [open, setOpen] = useState(false);
  useEffect(
    () => () => {
      if (pendingSimulation.current !== null) {
        clearTimeout(pendingSimulation.current);
      }
    },
    [],
  );
  const invalidateSimulation = () => {
    if (pendingSimulation.current !== null) {
      clearTimeout(pendingSimulation.current);
      pendingSimulation.current = null;
    }
    setLoading(false);
    setResult(null);
  };
  const set = (key: keyof typeof initial, value: string) => {
    invalidateSimulation();
    setForm((s) => ({ ...s, [key]: value }));
  };
  const field = (key: keyof typeof initial, label: string, type = "number") => (
    <div className="field">
      <label htmlFor={key}>{label}</label>
      <input
        id={key}
        value={form[key]}
        type={type}
        required
        min={type === "number" ? "0.1" : undefined}
        step={type === "number" ? "0.1" : undefined}
        max={type === "number" ? "100000" : undefined}
        pattern={type === "text" ? "[0-9]{5}-?[0-9]{3}" : undefined}
        onChange={(e) => set(key, e.target.value)}
      />
    </div>
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    invalidateSimulation();
    setLoading(true);
    pendingSimulation.current = setTimeout(() => {
      const dest = Number(form.destination.replace(/\D/g, "").slice(0, 2));
      const origin = Number(form.origin.replace(/\D/g, "").slice(0, 2));
      const geographic = Math.abs(dest - origin) * 0.65;
      const score = Math.round(
        Math.min(
          96,
          Math.max(8, 20 + geographic + Number(form.weight) * 2 - Number(form.days) * 1.4),
        ),
      );
      setResult(score);
      setLoading(false);
      pendingSimulation.current = null;
      toast.success("Simulação de risco de atraso concluída.");
    }, 800);
  };
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

              {field("days", "Prazo estimado (dias)")}
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
            {result === null ? (
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
                <div
                  className={`result-score ${result >= 70 ? "text-danger" : result >= 40 ? "text-warning" : "text-success"}`}
                >
                  {result}
                  <span className="text-3xl">%</span>
                </div>
                <p className="text-xs text-muted-foreground mb-5">
                  Probabilidade demonstrativa de atraso
                </p>
                <RiskPill risk={result} />
                <div className="result-meter">
                  <div className="result-meter-fill" style={{ width: `${result}%` }} />
                </div>
                <div className="stat-row">
                  <span className="text-muted-foreground">Prazo informado</span>
                  <b>{form.days} dias</b>
                </div>
                <div className="stat-row">
                  <span className="text-muted-foreground">Peso do pacote</span>
                  <b>{form.weight} kg</b>
                </div>
                <h3 className="font-semibold text-xs mt-6 mb-3">
                  Fatores que influenciam o resultado
                </h3>
                <p className="text-xs text-muted-foreground leading-7">
                  • Proximidade entre faixas de CEP
                  <br />• Peso do pacote e prazo disponível
                  <br />• Histórico da cidade de destino
                </p>
                <div className="insight mt-5">
                  {result >= 70
                    ? "Considere ampliar o prazo de entrega ou revisar a rota de despacho para reduzir a exposição ao risco."
                    : "O envio apresenta condições favoráveis. Acompanhe o despacho e mantenha o cliente informado."}
                </div>
                <Button
                  className="w-full mt-5"
                  variant="outline"
                  onClick={() => {
                    downloadCsv(
                      [{ ...form, probabilidade: result, tipo: "Estimativa demonstrativa" }],
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
