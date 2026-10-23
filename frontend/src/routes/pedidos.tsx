import { createFileRoute } from "@tanstack/react-router";
import { OrdersPage } from "@/components/hypogram/orders-page";
import { pageHead } from "@/lib/hypogram-data";
export const Route = createFileRoute("/pedidos")({
  head: () =>
    pageHead(
      "Pedidos",
      "Consulta de pedidos históricos Olist com filtros de período, estado, parceiro e status.",
    ),
  component: OrdersPage,
});
