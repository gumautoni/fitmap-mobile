import { describe, expect, test } from "@jest/globals";

import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  normalizeName,
  validateLoginForm,
  validateRegistrationForm,
} from "../authFormValidation";

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

  test("rejeita e-mail inválido e aceita login preenchido", () => {
    expect(validateLoginForm("sem-arroba", "senha")).toHaveProperty("email");
    expect(validateLoginForm("pessoa@exemplo.com", "senha")).toEqual({});
  });

  test("rejeita cadastro com nome curto e e-mail inválido", () => {
    const errors = validateRegistrationForm(
      "A",
      "x",
      "a".repeat(15),
      "a".repeat(15),
    );
    expect(errors).toHaveProperty("name");
    expect(errors).toHaveProperty("email");
  });

  test("mantém a regra atual de 15 a 128 caracteres até o backend ser atualizado", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(15);
    expect(MAX_PASSWORD_LENGTH).toBe(128);

    const short = validateRegistrationForm(
      "Ana Silva",
      "ana@example.com",
      "abc123",
      "abc123",
    );
    expect(short).toHaveProperty("password");

    const long = "x".repeat(129);
    expect(
      validateRegistrationForm("Ana Silva", "ana@example.com", long, long),
    ).toHaveProperty("password");
  });

  test("rejeita senhas divergentes", () => {
    const errors = validateRegistrationForm(
      "Ana Silva",
      "ana@example.com",
      "abcdefghijklmno",
      "abcdefghijklmnp",
    );
    expect(errors).toHaveProperty("confirmPassword");
  });

  test("aceita cadastro válido de acordo com a política atual", () => {
    expect(
      validateRegistrationForm(
        "Ana Silva",
        "ana@example.com",
        "abcdefghijklmno",
        "abcdefghijklmno",
      ),
    ).toEqual({});
  });
});
