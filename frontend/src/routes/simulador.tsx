import { createFileRoute } from "@tanstack/react-router";
import { SimulatorPage } from "@/components/hypogram/simulator-page";
import { pageHead } from "@/lib/hypogram-data";
export const Route = createFileRoute("/simulador")({
  head: () =>
    pageHead(
      "Simulador de risco",
      "Simule um novo envio e visualize uma estimativa demonstrativa do risco de atraso.",
    ),
  component: SimulatorPage,
});
