import { describe, expect, test } from "@jest/globals";

import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  getPasswordRequirements,
  normalizeEmail,
  normalizeName,
  validateLoginForm,
  validateRegistrationForm,
} from "../authFormValidation";

const VALID_PASSWORD = "Aa1!bcde";
const register = (password, confirmation = password) =>
  validateRegistrationForm(
    "Ana Silva",
    "ana@example.com",
    password,
    confirmation,
  );

describe("Formulários de autenticação", () => {
  test("normaliza o e-mail e o nome", () => {
    expect(normalizeEmail("  PESSOA@EXEMPLO.COM  ")).toBe("pessoa@exemplo.com");
    expect(normalizeName("  Maria    Silva  ")).toBe("Maria Silva");
  });

  test("valida campos obrigatórios no login", () => {
    expect(validateLoginForm("", "")).toEqual({
      email: "Informe seu e-mail.",
      password: "Informe sua senha.",
    });
  });

  test("mantém a compatibilidade do login com senhas antigas", () => {
    expect(validateLoginForm("pessoa@exemplo.com", "senha")).toEqual({});
    expect(validateLoginForm("sem-arroba", "senha")).toHaveProperty("email");
  });

  test("rejeita cadastro com nome curto e e-mail inválido", () => {
    const errors = validateRegistrationForm(
      "A",
      "x",
      VALID_PASSWORD,
      VALID_PASSWORD,
    );
    expect(errors).toHaveProperty("name");
    expect(errors).toHaveProperty("email");
  });

  test("aceita exatamente 8 e 128 caracteres", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(MAX_PASSWORD_LENGTH).toBe(128);
    expect(register(VALID_PASSWORD)).toEqual({});
    const longValid = `Aa1!${"x".repeat(124)}`;
    expect(Array.from(longValid)).toHaveLength(128);
    expect(register(longValid)).toEqual({});
  });

  test.each([
    { description: "curta", password: "Aa1!abc" },
    { description: "longa", password: `Aa1!${"x".repeat(125)}` },
    { description: "sem maiúscula", password: "aa1!bcde" },
    { description: "sem minúscula", password: "AA1!BCDE" },
    { description: "sem número", password: "Aa!!bcde" },
    { description: "sem símbolo", password: "Aa11bcde" },
  ])("rejeita senha $description", ({ password }) => {
    expect(register(password)).toHaveProperty("password");
    expect(Object.values(getPasswordRequirements(password))).toContain(false);
  });

  test("rejeita confirmação divergente", () => {
    expect(register(VALID_PASSWORD, "Aa1!bcdf")).toHaveProperty(
      "confirmPassword",
    );
  });

  test("o checklist reflete cada requisito da mesma política", () => {
    expect(getPasswordRequirements(VALID_PASSWORD)).toEqual({
      length: true,
      uppercase: true,
      lowercase: true,
      number: true,
      special: true,
    });
    expect(getPasswordRequirements("abcdefgh")).toEqual({
      length: true,
      uppercase: false,
      lowercase: true,
      number: false,
      special: false,
    });
  });

  test("conta caracteres Unicode completos, não unidades UTF-16", () => {
    expect(register("Aa1!😀xyz")).toEqual({});
    expect(getPasswordRequirements("Aa1!😀xy").length).toBe(false);
  });

  test("não trata emoji isolado como substituto do símbolo ASCII", () => {
    expect(register("Aa1😀bcde")).toHaveProperty("password");
  });
});
