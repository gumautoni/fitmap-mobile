import { calculateDistanceKm } from "../distance";

describe("calculateDistanceKm", () => {
  it("returns zero when both coordinates represent the same location", () => {
    const distance = calculateDistanceKm(
      -22.4708,
      -43.8254,
      -22.4708,
      -43.8254,
    );

    expect(distance).toBe(0);
  });

  it("calculates the approximate distance between two coordinates", () => {
    const distance = calculateDistanceKm(0, 0, 0, 1);

    expect(distance).toBeCloseTo(111.19, 1);
  });

  it("returns zero when a coordinate is invalid", () => {
    const distance = calculateDistanceKm(Number.NaN, 0, 0, 0);

    expect(distance).toBe(0);
  });
});
