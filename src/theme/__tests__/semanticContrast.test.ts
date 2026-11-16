import { darkColors, lightColors } from "../themes";

function relativeLuminance(hex: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new Error("Expected an opaque RGB hex color.");
  }

  const channels = [1, 3, 5].map((offset) => {
    const srgb = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;

    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);

  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

const semanticTokens = ["success", "warning", "danger"] as const;

const surfaces = [
  "background",
  "surface",
  "surfaceSecondary",
  "primarySoft",
] as const;

describe("contrast calculation", () => {
  it("returns 21 for black against white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 10);
  });

  it("returns 1 for identical colors", () => {
    expect(contrastRatio("#C2410C", "#C2410C")).toBeCloseTo(1, 10);
  });

  it("is independent of foreground and background order", () => {
    expect(contrastRatio("#047857", "#FAF7F2")).toBeCloseTo(
      contrastRatio("#FAF7F2", "#047857"),
      10,
    );
  });
});

const modes = [
  ["light", lightColors],
  ["dark", darkColors],
] as const;

describe("semantic color contrast", () => {
  for (const [mode, colors] of modes) {
    for (const token of semanticTokens) {
      for (const surface of surfaces) {
        it(`ACC01_CONTRAST ${mode} ${token} on ${surface}`, () => {
          expect(
            contrastRatio(colors[token], colors[surface]),
          ).toBeGreaterThanOrEqual(4.5);
        });
      }
    }

    it(`ACC01_CONTRAST ${mode} destructive button text`, () => {
      expect(
        contrastRatio(colors.textOnPrimary, colors.danger),
      ).toBeGreaterThanOrEqual(4.5);
    });

    it(`ACC01_CONTRAST ${mode} completed exercise icon`, () => {
      expect(
        contrastRatio(colors.textOnPrimary, colors.success),
      ).toBeGreaterThanOrEqual(3);
    });

    it(`ACC01_CONTRAST ${mode} rating stars on surface`, () => {
      expect(
        contrastRatio(colors.warning, colors.surface),
      ).toBeGreaterThanOrEqual(3);
    });

    it(`ACC01_CONTRAST ${mode} rating controls on secondary surface`, () => {
      expect(
        contrastRatio(colors.warning, colors.surfaceSecondary),
      ).toBeGreaterThanOrEqual(3);
    });

    it(`ACC01_CONTRAST ${mode} fitness goal progress`, () => {
      expect(
        contrastRatio(colors.success, colors.surfaceSecondary),
      ).toBeGreaterThanOrEqual(3);
    });

    it(`ACC01_CONTRAST ${mode} workout completion progress`, () => {
      expect(
        contrastRatio(colors.success, colors.primarySoft),
      ).toBeGreaterThanOrEqual(3);
    });
  }
});
