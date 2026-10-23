import { useState } from "react";
import {
  Download,
  FileChartColumn,
  FileSpreadsheet,
  MapPinned,
  Package,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cities, criticalRoutes, downloadCsv, orders } from "@/lib/hypogram-data";
import { AppShell, PageHeading, PanelHeading } from "./shared";
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
];
export function ReportsPage() {
  const [period, setPeriod] = useState("2018-08");
  const [exports, setExports] = useState<
    { name: string; format: string; time: string; period: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const rows = (type: string): Record<string, unknown>[] =>
    type === "orders"
      ? orders.filter((o) => o.date.startsWith(period))
      : type === "cities"
        ? cities.map(({ x, y, ...c }) => c)
        : type === "routes"
          ? criticalRoutes
          : [
              {
                periodo: period,
                pedidos: period === "2018-08" ? 99441 : 48372,
                pontualidade: "92.4%",
                taxa_atraso: "7.6%",
                tempo_medio: "12.3 dias",
                tipo: "Dados demonstrativos",
              },
            ];
  const exportReport = async (type: string, title: string, format: string) => {
    const data = rows(type);
    if (format === "CSV") downloadCsv(data, `hypogram-${type}-${period}`);
    else {
      setBusy(true);
      try {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF();
        doc.setFillColor(30, 94, 72);
        doc.rect(0, 0, 210, 35, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("hypogram.", 16, 22);
        doc.setTextColor(40, 50, 45);
        doc.setFontSize(16);
        doc.text(title, 16, 50);
        doc.setFontSize(10);
        doc.text(`Periodo: ${period} | Ambiente de demonstracao`, 16, 60);
        let y = 76;
        for (const row of data) {
          for (const [key, val] of Object.entries(row)) {
            const lines = doc.splitTextToSize(`${key}: ${String(val)}`, 175);
            if (y + lines.length * 5 > 277) {
              doc.addPage();
              y = 20;
            }
            doc.text(lines, 16, y);
            y += lines.length * 5;
          }
          y += 7;
        }
        doc.save(`hypogram-${type}-${period}.pdf`);
      } finally {
        setBusy(false);
      }
    }
    setExports((s) => [
      {
        name: title,
        format,
        period,
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      },
      ...s,
    ]);
    toast.success(`${title} exportado em ${format}`);
  };
  return (
    <AppShell>
      <PageHeading
        title="Relatórios"
        subtitle="Transforme dados logísticos em informações prontas para compartilhar."
      >
        <select
          className="select-control"
          aria-label="Período do relatório"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="2018-08">Agosto de 2018</option>
          <option value="2018-07">Julho de 2018</option>
        </select>
      </PageHeading>
      <div className="section-grid mb-6">
        {reports.map((r) => (
          <article className="report-card" key={r.type}>
            <span className="report-icon">
              <r.icon size={23} />
            </span>
            <h3>{r.title}</h3>
            <p>{r.text}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportReport(r.type, r.title, "CSV")}
              >
                <FileSpreadsheet />
                Exportar CSV
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => exportReport(r.type, r.title, "PDF")}
              >
                <Download />
                Exportar PDF
              </Button>
            </div>
          </article>
        ))}
      </div>
      <section className="panel">
        <PanelHeading
          title="Exportações desta sessão"
          subtitle="Arquivos gerados durante sua navegação"
        />
        {exports.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Relatório</th>
                  <th>Formato</th>
                  <th>Período</th>
                  <th>Horário</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {exports.map((e, i) => (
                  <tr key={i}>
                    <td>{e.name}</td>
                    <td>{e.format}</td>
                    <td>{e.period}</td>
                    <td>{e.time}</td>
                    <td>
                      <span className="risk-pill low">Concluído</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Download className="mx-auto mb-3" />
            <p>Nenhum relatório exportado nesta sessão.</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
