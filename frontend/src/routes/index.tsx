import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/hypogram/dashboard";
import { pageHead } from "@/lib/hypogram-data";
export const Route = createFileRoute("/")({
  head: () =>
    pageHead(
      "Visão geral",
      "Indicadores de gestão logística, pontualidade das entregas e análise preventiva de atrasos no e-commerce brasileiro.",
    ),
  component: Dashboard,
});
