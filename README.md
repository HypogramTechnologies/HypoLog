# 🚚 HypoLog

**HypoLog** é um sistema web de **inteligência logística** que combina **Ciência de Dados** e **Machine Learning** para mapear gargalos de entrega e prever o risco de atraso de pedidos no e-commerce brasileiro. A solução é composta por uma **API de predição** e uma **aplicação de gestão**, construídas a partir do *Brazilian E-commerce Public Dataset by Olist* — mais de 100 mil pedidos reais realizados entre 2016 e 2018.

O foco do projeto é permitir que **gestores e analistas de logística** deixem de reagir a atrasos depois que eles acontecem e passem a **atuar de forma preventiva**, identificando regiões críticas, avaliando parceiros logísticos e simulando o risco de novos envios em tempo real.

---

## 📌 Problema

O varejo digital brasileiro cresceu de forma expressiva nos últimos anos, e a **pontualidade na entrega** se tornou um dos fatores mais críticos para a satisfação, fidelização e conversão de clientes. Atrasos geram prejuízos financeiros, aumentam os custos de atendimento e desgastam a marca.

A complexidade logística do país — dimensões continentais, diversidade de rotas, dependência de múltiplas transportadoras e variações geográficas — torna difícil antecipar falhas. Na prática, gestores lidam com dados dispersos e só descobrem os problemas depois que o cliente já foi impactado.

---

## 💡 Solução

O **HypoLog** resolve esse desafio por meio de um ecossistema integrado:

* **Mapa de Calor de Gargalos:** Visualização espacial das regiões, rotas e cidades com maiores índices históricos e preditivos de atraso.
* **Predição de Risco de Atraso:** Um modelo de classificação treinado com a base Olist calcula a probabilidade de atraso de um envio a partir de variáveis como distância, peso, prazo estimado e histórico da transportadora.
* **Simulador de Envios:** O gestor informa os dados de um novo pedido (CEP de origem/destino, dimensões, peso, transportadora) e recebe o diagnóstico de risco instantaneamente.
* **Dashboard de KPIs:** Indicadores consolidados de pontualidade (*on-time delivery*), tempo médio de trânsito versus prazo prometido e eficiência por parceiro logístico.
* **Consulta e Exportação:** Filtros sobre a base histórica e exportação de relatórios analíticos em CSV ou PDF.

---

## ✅ Requisitos

### Requisitos Funcionais
* **RF01**: Consulta e filtro de dados históricos de pedidos por período, estado (UF) e parceiro logístico.
* **RF02**: API de predição que recebe parâmetros logísticos de um pedido e retorna a probabilidade de atraso calculada pelo modelo.
* **RF03**: Mapa de calor interativo com marcadores evidenciando regiões e rotas com maior incidência de atrasos.
* **RF04**: Simulador de risco com formulário interativo para diagnóstico instantâneo de novos envios.
* **RF05**: Dashboard gerencial com volume de vendas, taxa de pontualidade, principais transportadoras e tempo médio de trânsito por região.
* **RF06**: Exportação de dados analíticos e resultados de predição em CSV ou PDF.

### Requisitos Não Funcionais
* **RNF01**: Documentação completa da API (endpoints, parâmetros, esquemas de saída e códigos de erro) com **Swagger/OpenAPI**.
* **RNF02**: Backend, serviço de Machine Learning e aplicação web implantados em **nuvem**, com acesso público via navegador.
* **RNF03**: Documentação do pipeline de dados, treinamento, validação e métricas do modelo (**ROC-AUC, Precision, Recall e F1-Score**).
* **RNF04**: Interface responsiva e consultas ao mapa e predições com tempo de resposta adequado, mesmo em grandes volumes de dados.

---

## 👥 User Stories

* **RF01**: Como analista de logística, quero filtrar os pedidos históricos por período, estado e transportadora para investigar onde os atrasos se concentram.
* **RF02**: Como desenvolvedor de um sistema parceiro, quero consumir um endpoint de predição para integrar o score de risco de atraso ao meu fluxo de despacho.
* **RF03**: Como gestor de logística, quero visualizar um mapa de calor das regiões críticas para priorizar ações nas rotas com mais gargalos.
* **RF04**: Como gestor de logística, quero simular um novo envio informando CEPs, peso e transportadora para saber o risco de atraso antes de despachar o pedido.
* **RF05**: Como gestor de varejo digital, quero acompanhar a taxa de pontualidade e a eficiência de cada transportadora para negociar melhores condições com os parceiros.
* **RF06**: Como gestor, quero exportar relatórios em CSV ou PDF para compartilhar os resultados com a diretoria.

---

## 🛠️ Tecnologias Utilizadas
* **Ciência de Dados / ML:** Python, Pandas, Scikit-learn, Jupyter Notebook.
* **API de Predição:** FastAPI.
* **Backend:** Node.js, Express, TypeScript.
* **Frontend:** React.
* **Documentação da API:** Swagger / OpenAPI.
* **Infraestrutura:** Docker (Conteinerização) e deploy em nuvem.
* **DevOps:** Git (Git Flow) e Pipeline de CI/CD (GitHub Actions).

---

## 📊 Base de Dados

O projeto utiliza o [Brazilian E-commerce Public Dataset by Olist](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce), que reúne informações de pedidos, clientes, vendedores, produtos, pagamentos, avaliações e geolocalização de centenas de cidades brasileiras entre 2016 e 2018.

A documentação do pipeline de dados, do treinamento e das métricas de avaliação do modelo está disponível em [`/docs`](docs/).

---

## 🚀 Como Executar o Projeto

```bash
# Clone este repositório
git clone https://github.com/HypogramTechnologies/HypoLog.git

# Acesse a pasta do projeto
cd HypoLog

# Inicie o ambiente com Docker
docker-compose up -d
```

---

## 📅 Gestão do Projeto

- **Trello:** [link do board](https://trello.com/invite/b/6acec85ae3e54e1e69510138/ATTId19710350ae78088ca4e80a31185dbcfC6E63E6A/hypolog)

| Etapa | Data |
|---|---|
| Sprint Review 1 | 20/10/2026 |
| Sprint Review 2 | 10/11/2026 |
| Sprint Review 3 | 24/11/2026 |

---

### 🌀 Sprint 1

#### 📋 Tarefas

| ID | Nome | Responsável(is) | Status | Link | Requisitos Atendidos |
|---|---|---|---|---|---|
| -- | | | | | |

#### 📉 Burndown

[Burndown Sprint 1](https://docs.google.com/spreadsheets/d/1nbggnGXVZWFPuzSvonSQTaMruP9z9HXlCn0HXuX7xV8/edit?gid=1331580154#gid=1331580154)

---

### 🌀 Sprint 2

#### 📋 Tarefas

| ID | Nome | Responsável(is) | Status | Link | Requisitos Atendidos |
|---|---|---|---|---|---|
| -- | | | | | |

#### 📉 Burndown

[Burndown Sprint 2](https://docs.google.com/spreadsheets/d/1nbggnGXVZWFPuzSvonSQTaMruP9z9HXlCn0HXuX7xV8/edit?gid=597853115#gid=597853115)

---

### 🌀 Sprint 3

#### 📋 Tarefas

| ID | Nome | Responsável(is) | Status | Link | Requisitos Atendidos |
|---|---|---|---|---|---|
| -- | | | | | |

#### 📉 Burndown

[Burndown Sprint 3](https://docs.google.com/spreadsheets/d/1nbggnGXVZWFPuzSvonSQTaMruP9z9HXlCn0HXuX7xV8/edit?gid=1911487837#gid=1911487837)

---

## 👨🏻‍💻 Equipe

| Nome | Função |
| :--- | :--- |
| **Adson Ottoni Balbino Filho** | Developer |
| **Andressa Stephane Toledo da Silva** | Developer |
| **Carlos Eduardo da Silva Magalhães** | Developer |
| **Eduardo Henrique Alves Arantes** | Developer |
| **João Pedro Souza dos Anjos** | Developer |

---

## 📄 Licença
Este projeto é de uso acadêmico e está sob a licença [MIT](LICENSE).