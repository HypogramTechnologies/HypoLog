import { createFileRoute } from "@tanstack/react-router";
import { ModelPage } from "@/components/hypogram/model-page";
import { pageHead } from "@/lib/hypogram-data";
export const Route = createFileRoute("/modelo")({
  head: () =>
    pageHead(
      "Modelo e API",
      "Documentação visual do modelo de previsão, métricas, pipeline e contrato de API.",
    ),
  component: ModelPage,
});
