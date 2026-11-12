import { formatHeightCmInput, normalizeHeightCm } from "../profileHeight";

describe("profile height validation", () => {
  it.each([
    ["50", "50.00"],
    ["50,05", "50.05"],
    ["175", "175.00"],
    ["175,5", "175.50"],
    ["175.50", "175.50"],
    ["250,00", "250.00"],
    [" 180,25 ", "180.25"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeHeightCm(input)).toBe(expected);
  });

  it.each([
    "",
    "49",
    "49,99",
    "250,01",
    "251",
    "175,555",
    "175,",
    "-175",
    "1e2",
    "NaN",
    "175,5.0",
  ])("rejects invalid height %s", (input) => {
    expect(normalizeHeightCm(input)).toBeNull();
  });

  it("formats stored height for Brazilian input", () => {
    expect(formatHeightCmInput("175.50")).toBe("175,50");
    expect(formatHeightCmInput("180.00")).toBe("180,00");
  });

  it("keeps missing height empty", () => {
    expect(formatHeightCmInput(null)).toBe("");
  });
});
