import { createFileRoute } from "@tanstack/react-router";
import { MapPage } from "@/components/hypogram/map-page";
import { pageHead } from "@/lib/hypogram-data";
export const Route = createFileRoute("/mapa")({
  head: () =>
    pageHead(
      "Mapa de risco",
      "Mapeamento de gargalos logísticos e regiões com maior risco de atraso no Brasil.",
    ),
  component: MapPage,
});
