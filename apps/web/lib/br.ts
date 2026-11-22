// Validações brasileiras puras (sem dependências) — usadas no cadastro do anfitrião.

export const onlyDigits = (s: string) => s.replace(/\D/g, "");

/** CPF válido pelos dígitos verificadores (rejeita sequências repetidas como 111.111.111-11). */
export function isValidCPF(raw: string) {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

/** "12345678909" → "***.456.789-**" (exibição sem revelar o documento inteiro). */
export const maskCPF = (cpf: string) => `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;

export type PixKeyType = "CPF" | "EMAIL" | "PHONE" | "RANDOM";

/** Normaliza e valida a chave Pix conforme o tipo. Retorna null se inválida. */
export function normalizePixKey(type: PixKeyType, raw: string): string | null {
  const v = raw.trim();
  switch (type) {
    case "CPF": {
      const d = onlyDigits(v);
      return isValidCPF(d) ? d : null;
    }
    case "EMAIL": {
      const e = v.toLowerCase();
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 77 ? e : null;
    }
    case "PHONE": {
      let d = onlyDigits(v);
      if (d.length === 10 || d.length === 11) d = `55${d}`;
      return /^55\d{10,11}$/.test(d) ? `+${d}` : null;
    }
    case "RANDOM": {
      const k = v.toLowerCase();
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(k) ? k : null;
    }
  }
}

/** Últimos 4 caracteres para exibir no painel ("final 8909"). */
export const last4 = (s: string) => s.replace(/[^0-9a-z]/gi, "").slice(-4);
