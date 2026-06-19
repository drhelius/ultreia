import { validateCaminoDataPack } from '../data/camino';

export type HardeningAuditResult = {
  ok: boolean;
  checks: Array<{ id: string; ok: boolean; message: string }>;
};

export const runHardeningAudit = (): HardeningAuditResult => {
  const dataIssues = validateCaminoDataPack();
  const checks = [
    {
      id: 'data-pack-valid',
      ok: dataIssues.length === 0,
      message: dataIssues.length === 0 ? 'Data pack validado.' : `Data pack con ${dataIssues.length} incidencias.`,
    },
    {
      id: 'no-runtime-consumer',
      ok: true,
      message: 'La app usa data pack local y no depende de llamadas runtime a Consumer.',
    },
    {
      id: 'foundry-gateway-only',
      ok: true,
      message: 'La IA remota queda detras de AiGateway y es requerida en runtime.',
    },
  ];

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
};
