function invalidApiUrl(): Error {
  return new Error(
    "EXPO_PUBLIC_API_URL must be a valid HTTP or HTTPS API base URL.",
  );
}

function isValidHostname(hostname: string): boolean {
  if (hostname.length > 253) {
    return false;
  }

  const labels = hostname.split(".");

  const validLabels = labels.every(
    (label) =>
      label.length <= 63 &&
      /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label),
  );

  if (!validLabels) {
    return false;
  }

  if (labels.every((label) => /^[0-9]+$/.test(label))) {
    // Accept canonical IPv4 only, avoiding ambiguous numeric hostnames.
    return (
      labels.length === 4 &&
      labels.every(
        (label) =>
          /^(?:0|[1-9][0-9]{0,2})$/.test(label) && Number(label) <= 255,
      )
    );
  }

  const lastLabel = labels[labels.length - 1];

  // Reject numeric and hexadecimal hostname suffixes that URL parsers
  // may interpret as non-canonical IPv4 addresses.
  return !/^(?:[0-9]+|0x[0-9a-f]*)$/i.test(lastLabel);
}

function validateApiUrl(
  value: string | undefined,
  isDevelopment: boolean,
): string {
  if (!value) {
    throw new Error(
      "EXPO_PUBLIC_API_URL is not configured. Define it in your local environment.",
    );
  }

  // A deliberately restricted API base URL grammar, independent of
  // platform-specific URL parsing behavior.
  const match =
    /^(https?):\/\/([^/:]+)(?::([0-9]{1,5}))?(\/[A-Za-z0-9._~/-]*)?$/.exec(
      value,
    );

  if (!match || match[0] !== value || /\s/.test(value)) {
    throw invalidApiUrl();
  }

  const [, protocol, hostname, port, path = ""] = match;

  if (!isValidHostname(hostname)) {
    throw invalidApiUrl();
  }

  if (port !== undefined && (Number(port) < 1 || Number(port) > 65535)) {
    throw invalidApiUrl();
  }

  const normalizedPath = path.replace(/\/+$/, "");

  if (
    normalizedPath.includes("//") ||
    normalizedPath
      .split("/")
      .some((segment) => segment === "." || segment === "..")
  ) {
    throw invalidApiUrl();
  }

  if (!isDevelopment && protocol !== "https") {
    throw new Error("EXPO_PUBLIC_API_URL must use HTTPS in production.");
  }

  const authority = port === undefined ? hostname : `${hostname}:${port}`;

  return `${protocol}://${authority}${normalizedPath}`;
}

// Expo statically replaces the direct EXPO_PUBLIC environment reference.
// Only an actual development bundle may use unencrypted HTTP.
export const environment = {
  apiUrl: validateApiUrl(
    process.env.EXPO_PUBLIC_API_URL,
    typeof __DEV__ !== "undefined" && __DEV__ === true,
  ),
} as const;
