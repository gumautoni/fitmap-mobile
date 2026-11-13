let originalApiUrl: string | undefined;
let originalDev: PropertyDescriptor | undefined;

beforeEach(() => {
  originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
  originalDev = Object.getOwnPropertyDescriptor(globalThis, "__DEV__");
});

afterEach(() => {
  if (originalApiUrl === undefined) {
    delete process.env.EXPO_PUBLIC_API_URL;
  } else {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
  }

  if (originalDev) {
    Object.defineProperty(globalThis, "__DEV__", originalDev);
  } else {
    Reflect.deleteProperty(globalThis, "__DEV__");
  }
});

function loadApiUrl(
  apiUrl: string | undefined,
  isDevelopment: boolean | undefined,
): string | undefined {
  if (apiUrl === undefined) {
    delete process.env.EXPO_PUBLIC_API_URL;
  } else {
    process.env.EXPO_PUBLIC_API_URL = apiUrl;
  }

  if (isDevelopment === undefined) {
    Reflect.deleteProperty(globalThis, "__DEV__");
  } else {
    Object.defineProperty(globalThis, "__DEV__", {
      configurable: true,
      writable: true,
      value: isDevelopment,
    });
  }

  let result: string | undefined;

  jest.isolateModules(() => {
    const module =
      jest.requireActual<typeof import("../environment")>("../environment");

    result = module.environment.apiUrl;
  });

  return result;
}

describe("API environment configuration", () => {
  it("allows HTTP on a local development network", () => {
    expect(loadApiUrl("http://192.168.1.10:8000/api/v1", true)).toBe(
      "http://192.168.1.10:8000/api/v1",
    );
  });

  it("allows localhost HTTP during development", () => {
    expect(loadApiUrl("http://localhost:8000/api/v1", true)).toBe(
      "http://localhost:8000/api/v1",
    );
  });

  it("allows HTTPS during development", () => {
    expect(loadApiUrl("https://api.example.com/api/v1", true)).toBe(
      "https://api.example.com/api/v1",
    );
  });

  it("allows HTTPS in production and removes trailing slashes", () => {
    expect(loadApiUrl("https://api.example.com/api/v1///", false)).toBe(
      "https://api.example.com/api/v1",
    );
  });

  it.each([undefined, ""])("rejects missing API configuration: %s", (value) => {
    expect(() => loadApiUrl(value, true)).toThrow();
    expect(() => loadApiUrl(value, false)).toThrow();
  });

  it.each(["http://192.168.1.10:8000/api/v1", "http://api.example.com/api/v1"])(
    "rejects HTTP in production: %s",
    (value) => {
      expect(() => loadApiUrl(value, false)).toThrow();
    },
  );

  it.each([
    "/api/v1",
    "ftp://api.example.com/api/v1",
    "https://",
    "https:///api/v1",
    "https://user:password@api.example.com/api/v1",
    "https://api.example.com/api/v1?token=example",
    "https://api.example.com/api/v1#fragment",
    "https://api.example.com/api v1",
    "https://api.example.com\\api\\v1",
    "https://api.example.com:99999/api/v1",
    "https://api..example.com/api/v1",
    "http://YOUR_LOCAL_IP:8000/api/v1",
  ])("rejects an invalid or unsafe API URL: %s", (value) => {
    expect(() => loadApiUrl(value, true)).toThrow();
    expect(() => loadApiUrl(value, false)).toThrow();
  });
});

describe("API URL security boundaries", () => {
  it.each([
    ["http://10.0.2.2:8000/api/v1", true, "http://10.0.2.2:8000/api/v1"],
    ["http://127.0.0.1:8000/api/v1", true, "http://127.0.0.1:8000/api/v1"],
    [
      "https://api.example.com:8443/api/v1",
      false,
      "https://api.example.com:8443/api/v1",
    ],
    ["https://api.example.com/", false, "https://api.example.com"],
    [
      "https://fitmap-api.example.com/api/v1///",
      false,
      "https://fitmap-api.example.com/api/v1",
    ],
  ] as const)(
    "accepts a supported URL: %s",
    (value, isDevelopment, expected) => {
      expect(loadApiUrl(value, isDevelopment)).toBe(expected);
    },
  );

  it.each([
    "https://256.0.0.1/api/v1",
    "https://127.1/api/v1",
    "https://0177.0.0.1/api/v1",
    "https://2130706433/api/v1",
    "https://0x7f000001/api/v1",
    "https://0x7f.0.0.1/api/v1",
    "https://-api.example.com/api/v1",
    "https://api-.example.com/api/v1",
    "https://api.example.com:0/api/v1",
    "https://api.example.com:/api/v1",
    "https://api.example.com/api/./v1",
    "https://api.example.com/api/../v1",
    "https://api.example.com/api//v1",
    "https://api.example.com/api/%2e%2e/v1",
    "https://api.example.com/api/v1\n",
    "https://[::1]:8000/api/v1",
  ])("rejects an unsupported or ambiguous URL: %s", (value) => {
    expect(() => loadApiUrl(value, true)).toThrow();
    expect(() => loadApiUrl(value, false)).toThrow();
  });

  it("requires HTTPS when the development indicator is absent", () => {
    expect(() =>
      loadApiUrl("http://api.example.com/api/v1", undefined),
    ).toThrow("EXPO_PUBLIC_API_URL must use HTTPS in production.");
  });

  it("allows HTTPS when the development indicator is absent", () => {
    expect(loadApiUrl("https://api.example.com/api/v1", undefined)).toBe(
      "https://api.example.com/api/v1",
    );
  });
});
