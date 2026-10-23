import { useState } from "react";
import {
  Activity,
  Braces,
  Check,
  Code2,
  Copy,
  Cpu,
  Database,
  FileCode2,
  GitBranch,
  Layers,
  Play,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AppShell, Kpi, PageHeading, PanelHeading } from "./shared";
const request = {
  origin_zip: "01001000",
  destination_zip: "69005010",
  weight_kg: 2.5,
  dimensions_cm: { height: 20, width: 30, length: 40 },
  estimated_days: 10,
};
const response = {
  delay_probability: 0.87,
  risk_level: "high",
  estimated_transit_days: 18,
  model_version: "demo-1.0",
  demo: true,
};
export function ModelPage() {
  const [tab, setTab] = useState("model");
  const [ran, setRan] = useState(false);
  return (
    <AppShell>
      <PageHeading
        title="Modelo & API"
        subtitle="Transparência na análise preditiva e documentação para integração."
      >
        <span className="risk-pill medium">Ambiente baseado no treinamento do modelo</span>
      </PageHeading>
      <div className="tabs-row">
        {[
          ["model", "Visão do modelo"],
          // ["api", "Documentação da API"],
          // ["pipeline", "Pipeline de dados"],
        ].map(([id, label]) => (
          <Button
            variant="ghost"
            className={`tab-button ${tab === id ? "selected" : ""}`}
            key={id}
            onClick={() => setTab(id ?? "model")}
          >
            {label}
          </Button>
        ))}
      </div>
      {tab === "model" ? (
        <>
          <div className="kpi-grid">
            <Kpi
              label="ROC-AUC (exemplo)"
              value="0,89"
              trend="Referência"
              note="ilustrativa"
              icon={Activity}
            />
            <Kpi
              label="Precisão (exemplo)"
              value="84,2%"
              trend="Referência"
              note="ilustrativa"
              icon={ShieldCheck}
            />
            <Kpi
              label="Recall (exemplo)"
              value="81,7%"
              trend="Referência"
              note="ilustrativa"
              icon={Cpu}
            />
            <Kpi
              label="F1-Score (exemplo)"
              value="82,9%"
              trend="Referência"
              note="ilustrativa"
              icon={GitBranch}
            />
          </div>
          <div className="section-grid">
            <section className="panel">
              <PanelHeading
                title="Variáveis de maior influência"
                subtitle="Exemplo de importância das características do envio"
              />
              <div className="px-[22px] pb-6">
                {[
                  ["Distância entre origem e destino", 32],
                  ["Histórico da cidade de destino", 26],
                  ["Prazo estimado de entrega", 19],
                  ["Peso e dimensões do produto", 14],
                  ["Região de destino", 9],
                ].map(([label, value]) => (
                  <div key={label} className="mb-5">
                    <div className="flex justify-between text-xs mb-2">
                      <span>{label}</span>
                      <span className="font-semibold">{value}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel">
              <PanelHeading
                title="Ficha do modelo"
                subtitle="Estrutura prevista para a implementação"
              />
              <div className="px-[22px] pb-6">
                {[
                  ["Tarefa", "Classificação binária de atraso"],
                  ["Algoritmo de referência", "Gradient Boosting"],
                  ["Dados de referência", "Brazilian E-commerce by Olist"],
                  ["Período histórico", "Setembro 2016 — Agosto 2018"],
                  ["Validação proposta", "Separação temporal"],
                  ["Estado atual", "Protótipo visual, sem modelo treinado"],
                ].map(([k, v]) => (
                  <div className="stat-row" key={k}>
                    <span className="text-muted-foreground">{k}</span>
                    <span className="text-right max-w-[55%]">{v}</span>
                  </div>
                ))}
                <div className="insight mt-5">
                  As métricas exibidas são exemplos de apresentação, não resultados de treinamento
                  ou validação reais.
                </div>
              </div>
            </section>
          </div>
        </>
      ) : tab === "api" ? (
        <>
          <section className="panel mb-5">
            <PanelHeading
              title="API de previsão"
              subtitle="Contrato proposto · documentação demonstrativa"
            />
            <div className="px-[22px] pb-6">
              <div className="flex gap-3 items-center mb-5">
                <span className="risk-pill low">POST</span>
                <code className="text-sm">/api/v1/predict</code>
                <span className="text-xs text-muted-foreground">Calcular risco de atraso</span>
              </div>
              <div className="section-grid">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-xs">Corpo da requisição</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Copiar exemplo de requisição"
                      onClick={async () => {
                        await navigator.clipboard.writeText(JSON.stringify(request, null, 2));
                        toast.success("Exemplo copiado");
                      }}
                    >
                      <Copy />
                    </Button>
                  </div>
                  <pre className="code-block">{JSON.stringify(request, null, 2)}</pre>
                  <Button
                    className="mt-4"
                    onClick={() => {
                      setRan(true);
                      toast.success("Resposta demonstrativa exibida");
                    }}
                  >
                    <Play />
                    Testar exemplo
                  </Button>
                </div>
                <div>
                  <h3 className="font-semibold text-xs mb-5">
                    Resposta · {ran ? "200 OK" : "Exemplo 200 OK"}
                  </h3>
                  <pre className="code-block">{JSON.stringify(response, null, 2)}</pre>
                  <p className="text-[11px] leading-6 text-muted-foreground mt-4">
                    Esta tela demonstra o contrato de integração. Nenhuma requisição é enviada a uma
                    API real.
                  </p>
                </div>
              </div>
            </div>
          </section>
          <section className="panel">
            <PanelHeading title="Parâmetros e códigos de resposta" />
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Parâmetro</th>
                    <th>Tipo</th>
                    <th>Descrição</th>
                    <th>Obrigatório</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["origin_zip / destination_zip", "string", "CEPs de origem e destino"],
                    ["weight_kg", "number", "Peso do pacote em quilogramas"],
                    ["dimensions_cm", "object", "Altura, largura e comprimento"],
                    ["estimated_days", "integer", "Prazo prometido em dias"],
                  ].map(([key, type, desc]) => (
                    <tr key={key}>
                      <td>
                        <code>{key}</code>
                      </td>
                      <td>{type}</td>
                      <td>{desc}</td>
                      <td>Sim</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-[22px] text-xs text-muted-foreground">
              200 — Sucesso · 400 — Dados inválidos · 422 — Parâmetros insuficientes · 503 — Modelo
              indisponível
            </div>
          </section>
        </>
      ) : (
        <section className="panel">
          <PanelHeading
            title="Pipeline de dados e treinamento"
            subtitle="Etapas previstas para o desenvolvimento do modelo"
          />
          <div className="p-[22px] space-y-5">
            {[
              {
                icon: Database,
                title: "01 · Ingestão da base Olist",
                desc: "Pedidos, clientes, vendedores, produtos, avaliações e geolocalização.",
              },
              {
                icon: Layers,
                title: "02 · Tratamento e integração",
                desc: "Remoção de duplicados, tratamento de valores ausentes e união por identificadores.",
              },
              {
                icon: Braces,
                title: "03 · Engenharia de variáveis",
                desc: "Distância geográfica, tempo de processamento, peso, volume e prazo prometido.",
              },
              {
                icon: Cpu,
                title: "04 · Treinamento e validação",
                desc: "Separação temporal de treino e teste para reduzir vazamento de informação.",
              },
              {
                icon: Activity,
                title: "05 · Avaliação e acompanhamento",
                desc: "ROC-AUC, precisão, recall, F1-Score e monitoramento de desempenho.",
              },
              {
                icon: Code2,
                title: "06 · Disponibilização da API",
                desc: "Serviço de previsão com validação de entrada e respostas documentadas.",
              },
            ].map((s) => (
              <div key={s.title} className="flex gap-4 border-b border-border pb-5 last:border-0">
                <span className="report-icon shrink-0 mb-0">
                  <s.icon size={21} />
                </span>
                <div>
                  <h3 className="font-semibold text-sm mb-2">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-6">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
