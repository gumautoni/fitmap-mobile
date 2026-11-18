import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";

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

  it("accessibility: provides visible chart selection indicators and practical touch targets", async () => {
    await renderChart([]);

    function expectSelection(label: string, selected: boolean) {
      const button = screen.getByLabelText(
        `Visualizar evolu\u00e7\u00e3o de ${label}`,
      );

      expect(button).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ selected }),
      );

      expect(button).toHaveStyle({
        minHeight: 48,
        minWidth: 48,
      });

      if (selected) {
        expect(within(button).getByText("\u2713")).toBeTruthy();
      } else {
        expect(within(button).queryByText("\u2713")).toBeNull();
      }
    }

    for (const option of metricOptions) {
      expectSelection(option.label, option.type === "weight");
    }

    await fireEvent.press(
      screen.getByLabelText("Visualizar evolu\u00e7\u00e3o de Cintura"),
    );

    for (const option of metricOptions) {
      expectSelection(option.label, option.type === "waist");
    }

    expect(
      screen.getByText(/Nenhum registro v\u00e1lido de cintura/),
    ).toBeTruthy();
  });

  it("accessibility: describes chronological values and changes in the selected chart", async () => {
    await renderChart([
      makeMetric({
        id: "weight-later",
        value: "75.00",
        recordedAt: "2026-10-05T12:00:00Z",
      }),
      makeMetric({
        id: "weight-earlier",
        value: "80.00",
      }),
      makeMetric({
        id: "waist-earlier",
        metricType: "waist",
        unit: "in",
        value: "32.00",
      }),
      makeMetric({
        id: "waist-later",
        metricType: "waist",
        unit: "cm",
        value: "85.00",
        recordedAt: "2026-10-05T12:00:00Z",
      }),
    ]);

    const weightChart = screen.getByRole("image", {
      name: "Gr\u00e1fico de Peso, com 2 registros",
    });

    expect(weightChart).toHaveProp(
      "accessibilityHint",
      "Primeiro registro: 80 kg em 01/10/2026. " +
        "Mais recente: 75 kg em 05/10/2026. " +
        "Varia\u00e7\u00e3o do per\u00edodo: -5 kg. " +
        "2 de 2 registros v\u00e1lidos exibidos.",
    );

    expect(
      screen.getByText("Varia\u00e7\u00e3o do per\u00edodo: -5 kg"),
    ).toBeTruthy();

    await fireEvent.press(
      screen.getByLabelText("Visualizar evolu\u00e7\u00e3o de Cintura"),
    );

    const waistChart = screen.getByRole("image", {
      name: "Gr\u00e1fico de Cintura, com 2 registros",
    });

    expect(waistChart).toHaveProp(
      "accessibilityHint",
      "Primeiro registro: 81,28 cm em 01/10/2026. " +
        "Mais recente: 85 cm em 05/10/2026. " +
        "Varia\u00e7\u00e3o do per\u00edodo: +3,72 cm. " +
        "2 de 2 registros v\u00e1lidos exibidos.",
    );

    expect(
      screen.getByText("Varia\u00e7\u00e3o do per\u00edodo: +3,72 cm"),
    ).toBeTruthy();

    expect(
      screen.queryByLabelText("Gr\u00e1fico de Peso, com 2 registros"),
    ).toBeNull();

    expect(screen.getAllByRole("image")).toHaveLength(1);
  });

  it("accessibility: describes a single converted measurement without inventing a variation", async () => {
    await renderChart([
      makeMetric({
        unit: "lb",
        value: "100.00",
      }),
    ]);

    const chart = screen.getByRole("image", {
      name: "Gr\u00e1fico de Peso, com 1 registros",
    });

    expect(chart).toHaveProp(
      "accessibilityHint",
      "Registro: 45,36 kg em 01/10/2026. " +
        "Adicione outro registro para visualizar a varia\u00e7\u00e3o. " +
        "1 de 1 registros v\u00e1lidos exibidos.",
    );

    expect(screen.getAllByText("45,36 kg")).toHaveLength(2);

    expect(
      screen.getByText(
        "Adicione outro registro para visualizar a varia\u00e7\u00e3o.",
      ),
    ).toBeTruthy();

    expect(
      screen.queryByText(/Varia\u00e7\u00e3o do per\u00edodo:/),
    ).toBeNull();
  });

  it("accessibility: describes only the displayed valid history when the series is limited", async () => {
    const records = Array.from({ length: 32 }, (_, index) =>
      makeMetric({
        id: `accessible-record-${index}`,
        value: `${70 + index}.00`,
        recordedAt: new Date(Date.UTC(2026, 9, index + 1, 12)).toISOString(),
      }),
    );

    records.push(
      makeMetric({
        id: "invalid-accessibility-record",
        value: "NaN",
      }),
      makeMetric({
        id: "future-accessibility-record",
        value: "999.00",
        recordedAt: "2099-01-01T12:00:00Z",
      }),
    );

    await renderChart(records);

    const chart = screen.getByRole("image", {
      name: "Gr\u00e1fico de Peso, com 30 registros",
    });

    expect(chart).toHaveProp(
      "accessibilityHint",
      "Primeiro registro: 72 kg em 03/10/2026. " +
        "Mais recente: 101 kg em 01/11/2026. " +
        "Varia\u00e7\u00e3o do per\u00edodo: +29 kg. " +
        "30 de 32 registros v\u00e1lidos exibidos.",
    );

    expect(
      screen.getByText("30 de 32 registros v\u00e1lidos exibidos."),
    ).toBeTruthy();

    expect(screen.queryByText("70 kg")).toBeNull();
    expect(screen.queryByText("999 kg")).toBeNull();
  });

  it("accessibility: distinguishes loading, failure and empty chart states", async () => {
    const metrics = [makeMetric()];

    const view = await renderChart(metrics, true);

    const loadingLabel = "Carregando evolu\u00e7\u00e3o corporal";

    const progress = screen.getByRole("progressbar", {
      name: loadingLabel,
    });

    expect(progress).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ busy: true }),
    );

    expect(progress).toHaveProp("accessibilityLiveRegion", "polite");

    expect(
      screen.getByText("Carregando evolu\u00e7\u00e3o corporal..."),
    ).toBeTruthy();

    expect(screen.queryAllByRole("image")).toHaveLength(0);

    await view.rerender(
      <BodyEvolutionChart
        metrics={metrics}
        loading={false}
        error="Connection failed"
      />,
    );

    const alert = screen.getByRole("alert");

    expect(alert).toHaveTextContent(
      /N\u00e3o foi poss\u00edvel carregar a evolu\u00e7\u00e3o corporal/,
    );

    expect(alert).toHaveProp("accessibilityLiveRegion", "polite");

    expect(screen.queryByLabelText(loadingLabel)).toBeNull();

    expect(screen.queryAllByRole("image")).toHaveLength(0);

    expect(screen.queryByText(/Nenhum registro v\u00e1lido/)).toBeNull();

    await view.rerender(<BodyEvolutionChart metrics={[]} loading={false} />);

    const empty = screen.getByText(/Nenhum registro v\u00e1lido de peso/);

    expect(empty).toHaveProp("accessibilityLiveRegion", "polite");

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    expect(screen.queryAllByRole("image")).toHaveLength(0);

    await view.rerender(
      <BodyEvolutionChart metrics={metrics} loading={false} />,
    );

    expect(
      screen.getByRole("image", {
        name: "Gr\u00e1fico de Peso, com 1 registros",
      }),
    ).toBeTruthy();

    expect(screen.queryByText(/Nenhum registro v\u00e1lido/)).toBeNull();
  });
});
