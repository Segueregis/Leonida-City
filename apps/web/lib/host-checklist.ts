// Checklist de segurança do console (seguro para client e server).
// Cada item vira um campo Console.check* no banco.

export const HOST_TERMS_VERSION = "2026-11-22";

export const CHECKLIST = [
  {
    field: "checkRemotePlayOn",
    title: "Reprodução Remota ativada",
    how: "No PS5: Configurações → Sistema → Reprodução Remota → ativar \"Ativar Reprodução Remota\".",
  },
  {
    field: "checkRestModeNetworkOn",
    title: "PS5 pode ser ligado pela internet",
    how: "Configurações → Sistema → Economia de energia → Recursos disponíveis no Modo de Repouso → ativar \"Permanecer conectado à Internet\" e \"Permitir ligar o PS5 pela rede\".",
  },
  {
    field: "checkConsoleSharingOn",
    title: "Compartilhamento de console ativado (conta principal)",
    how: "Entre com a SUA conta principal: Configurações → Usuários e contas → Outro → Compartilhamento de console e jogo offline → Ativar. Assim a conta secundária joga o GTA 6 e usa o seu PS Plus.",
  },
  {
    field: "checkPsPlusActive",
    title: "PlayStation Plus ativo",
    how: "Sua conta principal precisa de PS Plus ativo — é ele que libera o GTA 6 Online para a conta secundária neste console.",
  },
  {
    field: "checkSpendingLimitZero",
    title: "Conta secundária sem como gastar dinheiro",
    how: "A conta que os jogadores usam NÃO pode ter cartão salvo nem saldo. Se ela for gerenciada pela sua família na PSN, defina o limite de gastos em R$ 0.",
  },
  {
    field: "checkCommsRestricted",
    title: "Comunicação restrita na conta secundária",
    how: "Em Gerenciamento de família / Controle parental da conta secundária, restrinja comunicação e conteúdo criado por outros jogadores.",
  },
] as const;

export type ChecklistField = (typeof CHECKLIST)[number]["field"];
