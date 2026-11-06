import { useState } from "react";
import {
  Download,
  FileChartColumn,
  FileSpreadsheet,
  MapPinned,
  Package,
  Building2,
  CalendarDays,
  LoaderCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { toast } from "sonner";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { AppShell, PageHeading } from "./shared";

const API_URL = import.meta.env.VITE_API_URL;

const MIN_DATA_DATE = "2016-09-15";
const MAX_DATA_DATE = "2018-08-29";

const reports = [
  {
    title: "Resumo gerencial",
    text: "Indicadores consolidados de volume de pedidos, pontualidade e tempo de entrega.",
    icon: FileChartColumn,
    type: "summary",
  },
  {
    title: "Histórico de pedidos",
    text: "Envios, destinos e probabilidades de atraso por pedido.",
    icon: Package,
    type: "orders",
  },
  {
    title: "Risco por cidade",
    text: "Cidades de destino com volume, probabilidade de atraso e tempo médio de entrega.",
    icon: Building2,
    type: "cities",
  },
  {
    title: "Gargalos e rotas críticas",
    text: "Rotas com maior incidência de risco e regiões que precisam de atenção.",
    icon: MapPinned,
    type: "routes",
  },
] as const;

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

function formatDate(date?: Date) {
  return date ? date.toLocaleDateString("pt-BR") : "Selecionar data";
}

type ExportFormat = "csv" | "pdf";

export function ReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: parseDate(MIN_DATA_DATE),
    to: parseDate(MAX_DATA_DATE),
  });

  const [calendarOpen, setCalendarOpen] = useState(false);

  // Identifica exatamente qual botão está exportando.
  const [busy, setBusy] = useState<string | null>(null);

  const startDate = dateRange.from ? toIso(dateRange.from) : "";
  const endDate = dateRange.to ? toIso(dateRange.to) : "";

  const periodLabel = `${formatDate(dateRange.from)} até ${formatDate(dateRange.to)}`;

  const exportReport = async (type: string, title: string, format: ExportFormat) => {
    if (!dateRange.from || !dateRange.to) {
      toast.error("Selecione o período completo.");
      return;
    }

    if (!API_URL) {
      toast.error("VITE_API_URL não está configurada no frontend.");
      return;
    }

    const exportKey = `${type}-${format}`;

    setBusy(exportKey);

    try {
      const baseUrl = API_URL.replace(/\/$/, "");
      const endpoint = `${baseUrl}/api/v1/reports/${format}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tipo: type,
          data_inicio: startDate,
          data_fim: endDate,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);

        throw new Error(
          error?.detail || `Erro HTTP ${response.status} ao gerar ${format.toUpperCase()}.`,
        );
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error("A API retornou um arquivo vazio.");
      }

      if (format === "pdf" && blob.type !== "application/pdf") {
        throw new Error("A API não retornou um documento PDF válido.");
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `hypolog-${type}-${startDate}-${endDate}.${format}`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);

      toast.success(`${title} exportado em ${format.toUpperCase()}!`);
    } catch (error) {
      console.error(`Erro ao exportar ${format}:`, error);

      toast.error(error instanceof Error ? error.message : "Erro ao exportar relatório.");
    } finally {
      setBusy(null);
    }
  };

  const isExporting = (type: string, format: ExportFormat) => busy === `${type}-${format}`;

  return (
    <AppShell>
      <PageHeading
        title="Relatórios"
        subtitle="Transforme dados logísticos em informações prontas para compartilhar."
      >
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 max-w-full gap-2 px-3">
              <CalendarDays size={15} className="shrink-0" />

              <span className="truncate text-xs">
                {dateRange.from && dateRange.to
                  ? `${formatDate(dateRange.from)} — ${formatDate(dateRange.to)}`
                  : "Selecionar período"}
              </span>
            </Button>
          </PopoverTrigger>

          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={8}
            collisionPadding={12}
            className="z-50 w-[280px] max-w-[calc(100vw-16px)] overflow-hidden rounded-xl p-0"
          >
            <Calendar
              mode="range"
              locale={ptBR}
              selected={dateRange}
              onSelect={(range) => {
                if (!range) {
                  setDateRange({ from: undefined, to: undefined });
                  return;
                }

                const from = range.from;
                const to = range.to;

                if (from && (from < parseDate(MIN_DATA_DATE) || from > parseDate(MAX_DATA_DATE)))
                  return;

                if (to && (to < parseDate(MIN_DATA_DATE) || to > parseDate(MAX_DATA_DATE))) return;

                setDateRange(range);

                if (from && to) {
                  setCalendarOpen(false);
                }
              }}
              defaultMonth={dateRange.from ?? parseDate("2018-03-01")}
              disabled={(date) =>
                date < parseDate(MIN_DATA_DATE) || date > parseDate(MAX_DATA_DATE)
              }
              fixedWeeks
              className="map-calendar w-full p-3 pointer-events-auto"
            />

            <p className="px-3 pb-3 text-[10px] text-muted-foreground">
              Período disponível: 15/09/2016 a 29/08/2018
            </p>
          </PopoverContent>
        </Popover>
      </PageHeading>

      <div className="section-grid mb-6">
        {reports.map((report) => {
          const exportingCsv = isExporting(report.type, "csv");
          const exportingPdf = isExporting(report.type, "pdf");

          return (
            <article className="report-card" key={report.type}>
              <span className="report-icon">
                <report.icon size={23} />
              </span>

              <h3>{report.title}</h3>

              <p>{report.text}</p>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy !== null || !dateRange.from || !dateRange.to}
                  onClick={() => exportReport(report.type, report.title, "csv")}
                >
                  {exportingCsv ? (
                    <LoaderCircle className="animate-spin" size={16} />
                  ) : (
                    <FileSpreadsheet size={16} />
                  )}

                  {exportingCsv ? "Exportando..." : "Exportar CSV"}
                </Button>

                <Button
                  size="sm"
                  disabled={busy !== null || !dateRange.from || !dateRange.to}
                  onClick={() => exportReport(report.type, report.title, "pdf")}
                >
                  {exportingPdf ? (
                    <LoaderCircle className="animate-spin" size={16} />
                  ) : (
                    <Download size={16} />
                  )}

                  {exportingPdf ? "Gerando..." : "Exportar PDF"}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
