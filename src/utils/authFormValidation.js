export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

// Mesmos símbolos ASCII aceitos no RegisterRequest do backend (string.punctuation).
const SPECIAL_CHARACTERS = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export function normalizeName(name) {
  return name.trim().replace(/\s+/g, " ");
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getPasswordRequirements(password) {
  const characters = Array.from(password);
  return {
    length:
      characters.length >= MIN_PASSWORD_LENGTH &&
      characters.length <= MAX_PASSWORD_LENGTH,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: characters.some((character) =>
      SPECIAL_CHARACTERS.includes(character),
    ),
  };
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

  const characterCount = Array.from(password).length;
  const requirements = getPasswordRequirements(password);
  if (!password) {
    errors.password = "Crie uma senha.";
  } else if (characterCount < MIN_PASSWORD_LENGTH) {
    errors.password = `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  } else if (characterCount > MAX_PASSWORD_LENGTH) {
    errors.password = `A senha pode ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`;
  } else if (!requirements.uppercase) {
    errors.password = "Inclua pelo menos uma letra maiúscula.";
  } else if (!requirements.lowercase) {
    errors.password = "Inclua pelo menos uma letra minúscula.";
  } else if (!requirements.number) {
    errors.password = "Inclua pelo menos um número.";
  } else if (!requirements.special) {
    errors.password = "Inclua pelo menos um símbolo, como !, @ ou #.";
  }

  if (!confirmPassword) {
    errors.confirmPassword = "Confirme sua senha.";
  } else if (confirmPassword !== password) {
    errors.confirmPassword = "As senhas não coincidem.";
  }
  return errors;
}
