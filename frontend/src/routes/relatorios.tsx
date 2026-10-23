import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/components/hypogram/reports-page";
import { pageHead } from "@/lib/hypogram-data";
export const Route = createFileRoute("/relatorios")({
  head: () =>
    pageHead("Relatórios", "Exportação de indicadores, pedidos, cidades e rotas em CSV e PDF."),
  component: ReportsPage,
});
