import { fireEvent, render, screen } from "@testing-library/react-native";

import type {
  BodyMetric,
  BodyMetricType,
} from "../../services/bodyMetricsGoals";
import BodyEvolutionChart from "../BodyEvolutionChart";

jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: () => ({
    theme: jest.requireActual("../../theme/themes").lightTheme,
  }),
}));

function makeMetric(overrides: Partial<BodyMetric> = {}): BodyMetric {
  return {
    id: "metric-default",
    metricType: "weight",
    value: "70.00",
    unit: "kg",
    recordedAt: "2026-10-01T12:00:00Z",
    createdAt: "2026-10-01T12:01:00Z",
    updatedAt: "2026-10-01T12:01:00Z",
    ...overrides,
  };
}

async function renderChart(metrics: readonly BodyMetric[], loading = false) {
  return render(<BodyEvolutionChart metrics={metrics} loading={loading} />);
}

describe("BodyEvolutionChart", () => {
  it("shows loading without displaying chart data", async () => {
    await renderChart([makeMetric()], true);

    expect(screen.getByText("Carregando evolução corporal...")).toBeTruthy();

    expect(screen.queryByText("70 kg")).toBeNull();
    expect(
      screen.queryByLabelText("Gráfico de Peso, com 1 registros"),
    ).toBeNull();
  });

  it("distinguishes a failed request from an empty history", async () => {
    await render(
      <BodyEvolutionChart
        metrics={[]}
        loading={false}
        error="Connection failed"
      />,
    );

    expect(
      screen.getByText(/Não foi possível carregar a evolução corporal/),
    ).toBeTruthy();

    expect(screen.queryByText(/Nenhum registro válido/)).toBeNull();
  });

  it("shows an empty state when no records exist", async () => {
    await renderChart([]);

    expect(screen.getByText(/Nenhum registro válido de peso/)).toBeTruthy();

    expect(screen.queryByText("Variação do período:")).toBeNull();

    await fireEvent.press(
      screen.getByLabelText("Visualizar evolução de Quadril"),
    );

    expect(screen.getByText(/Nenhum registro válido de quadril/)).toBeTruthy();
  });

  it("renders chronological weight values and actual dates", async () => {
    await renderChart([
      makeMetric({
        id: "later",
        value: "75.00",
        recordedAt: "2026-10-05T12:00:00Z",
      }),
      makeMetric({
        id: "earlier",
        value: "70.00",
        recordedAt: "2026-10-01T12:00:00Z",
      }),
    ]);

    expect(screen.getByText("70 kg")).toBeTruthy();
    expect(screen.getByText("75 kg")).toBeTruthy();

    expect(screen.getByText("Variação do período: +5 kg")).toBeTruthy();

    expect(screen.getByText("01/10/2026")).toBeTruthy();
    expect(screen.getByText("05/10/2026")).toBeTruthy();

    expect(
      screen.getByLabelText("Gráfico de Peso, com 2 registros"),
    ).toBeTruthy();

    expect(screen.getByText("2 de 2 registros válidos exibidos.")).toBeTruthy();
  });

  it("shows a negative variation without marking it as an error", async () => {
    await renderChart([
      makeMetric({
        id: "first",
        value: "80.00",
      }),
      makeMetric({
        id: "last",
        value: "75.00",
        recordedAt: "2026-10-05T12:00:00Z",
      }),
    ]);

    expect(screen.getByText("Variação do período: -5 kg")).toBeTruthy();
  });

  it("handles a single point without inventing a variation", async () => {
    await renderChart([makeMetric()]);

    expect(
      screen.getByText("Adicione outro registro para visualizar a variação."),
    ).toBeTruthy();

    expect(
      screen.getByLabelText("Gráfico de Peso, com 1 registros"),
    ).toBeTruthy();

    expect(screen.getByText("1 de 1 registros válidos exibidos.")).toBeTruthy();
  });

  const metricOptions: {
    type: BodyMetricType;
    label: string;
  }[] = [
    { type: "weight", label: "Peso" },
    { type: "waist", label: "Cintura" },
    { type: "chest", label: "Peito" },
    { type: "arm", label: "Braço" },
    { type: "thigh", label: "Coxa" },
    { type: "hip", label: "Quadril" },
  ];

  it.each(metricOptions)(
    "selects $label and displays its own records",
    async ({ type, label }) => {
      const metrics = metricOptions.map((option) =>
        makeMetric({
          id: `metric-${option.type}`,
          metricType: option.type,
          value: "75.00",
          unit: option.type === "weight" ? "kg" : "cm",
        }),
      );

      await renderChart(metrics);

      const selector = screen.getByLabelText(`Visualizar evolução de ${label}`);

      await fireEvent.press(selector);

      expect(
        screen.getByLabelText(`Gráfico de ${label}, com 1 registros`),
      ).toBeTruthy();

      expect(
        screen.getByLabelText(`Visualizar evolução de ${label}`).props
          .accessibilityState.selected,
      ).toBe(true);

      expect(
        screen.getAllByText(type === "weight" ? "75 kg" : "75 cm"),
      ).toHaveLength(2);
    },
  );

  it("converts pounds to kilograms in the summary", async () => {
    await renderChart([
      makeMetric({
        unit: "lb",
        value: "100.00",
      }),
    ]);

    expect(screen.getAllByText("45,36 kg")).toHaveLength(2);
  });

  it("converts inches to centimeters in the summary", async () => {
    await renderChart([
      makeMetric({
        metricType: "waist",
        unit: "in",
        value: "32.00",
      }),
    ]);

    await fireEvent.press(
      screen.getByLabelText("Visualizar evolução de Cintura"),
    );

    expect(screen.getAllByText("81,28 cm")).toHaveLength(2);
  });

  it("updates the graph when the parent receives a new record", async () => {
    const first = makeMetric({
      id: "initial",
      value: "70.00",
    });

    const view = await renderChart([first]);

    expect(
      screen.getByText("Adicione outro registro para visualizar a variação."),
    ).toBeTruthy();

    await view.rerender(
      <BodyEvolutionChart
        loading={false}
        metrics={[
          first,
          makeMetric({
            id: "new-record",
            value: "73.50",
            recordedAt: "2026-10-06T12:00:00Z",
          }),
        ]}
      />,
    );

    expect(screen.getByText("73,5 kg")).toBeTruthy();

    expect(screen.getByText("Variação do período: +3,5 kg")).toBeTruthy();

    expect(
      screen.getByLabelText("Gráfico de Peso, com 2 registros"),
    ).toBeTruthy();
  });

  it("excludes future dates and invalid values from the chart", async () => {
    await renderChart([
      makeMetric({ id: "valid" }),
      makeMetric({
        id: "invalid",
        value: "NaN",
      }),
      makeMetric({
        id: "future",
        value: "90.00",
        recordedAt: "2099-01-01T12:00:00Z",
      }),
    ]);

    expect(
      screen.getByLabelText("Gráfico de Peso, com 1 registros"),
    ).toBeTruthy();

    expect(screen.getByText("1 de 1 registros válidos exibidos.")).toBeTruthy();

    expect(screen.queryByText("90 kg")).toBeNull();
  });

  it("limits the visible history to 30 real points", async () => {
    const records = Array.from({ length: 32 }, (_, index) =>
      makeMetric({
        id: `record-${index}`,
        recordedAt: new Date(Date.UTC(2026, 9, index + 1, 12)).toISOString(),
      }),
    );

    await renderChart(records);

    expect(
      screen.getByLabelText("Gráfico de Peso, com 30 registros"),
    ).toBeTruthy();

    expect(
      screen.getByText("30 de 32 registros válidos exibidos."),
    ).toBeTruthy();
  });
});
