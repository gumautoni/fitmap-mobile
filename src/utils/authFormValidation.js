// Regra temporária alinhada ao backend atual.
// O mínimo de 8 caracteres com composição obrigatória será aplicado
// quando o backend e seus testes forem atualizados no Ciclo 22-D.
export const MIN_PASSWORD_LENGTH = 15;
export const MAX_PASSWORD_LENGTH = 128;

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export function normalizeName(name) {
  return name.trim().replace(/\s+/g, " ");
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateLoginForm(email, password) {
  const errors = {};
  if (!email) {
    errors.email = "Informe seu e-mail.";
  } else if (!isValidEmail(email)) {
    errors.email = "Informe um e-mail válido.";
  }
  if (!password) {
    errors.password = "Informe sua senha.";
  }
  return errors;
}

export function validateRegistrationForm(
  name,
  email,
  password,
  confirmPassword,
) {
  const errors = {};
  if (!name) {
    errors.name = "Informe seu nome completo.";
  } else if (name.length < 3) {
    errors.name = "O nome deve ter pelo menos 3 caracteres.";
  }
  if (!email) {
    errors.email = "Informe seu e-mail.";
  } else if (!isValidEmail(email)) {
    errors.email = "Informe um e-mail válido.";
  }
  if (!password) {
    errors.password = "Crie uma senha.";
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.password = `A senha pode ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`;
  }
  if (!confirmPassword) {
    errors.confirmPassword = "Confirme sua senha.";
  } else if (confirmPassword !== password) {
    errors.confirmPassword = "As senhas não coincidem.";
  }
  return errors;
}
