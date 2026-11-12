export function normalizeHeightCm(input: string): string | null {
  const match = /^(\d{2,3})(?:[.,](\d{1,2}))?$/.exec(input.trim());

  if (!match) {
    return null;
  }

  const whole = Number(match[1]);
  const decimals = Number((match[2] ?? "").padEnd(2, "0"));
  const hundredths = whole * 100 + decimals;

  if (hundredths < 5000 || hundredths > 25000) {
    return null;
  }

  return `${whole}.${String(decimals).padStart(2, "0")}`;
}

export function formatHeightCmInput(heightCm: string | null): string {
  return heightCm === null ? "" : heightCm.replace(".", ",");
}
