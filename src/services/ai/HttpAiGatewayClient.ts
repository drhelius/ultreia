import { appConfig } from '../../core';
import type { DirectorAgentInput, DirectorAgentOutput, PlanningAgentInput, PlanningAgentOutput } from '../../domain';
import type { AiGatewayClient, AiGatewayRequest, AiGatewayResponse } from './AiGatewayClient';

const agentPath = {
  planning: 'planning',
  decision: 'decision',
  chat: 'chat',
};

export class HttpAiGatewayClient implements AiGatewayClient {
  constructor(private readonly baseUrl: string = appConfig.aiGatewayBaseUrl) {}

  invokePlanningAgent(request: AiGatewayRequest<PlanningAgentInput>): Promise<AiGatewayResponse<PlanningAgentOutput>> {
    return this.post(agentPath.planning, request);
  }

  invokeDirectorAgent(request: AiGatewayRequest<DirectorAgentInput>): Promise<AiGatewayResponse<DirectorAgentOutput>> {
    return this.post(agentPath.decision, request);
  }

  invokeChatAgent(request: AiGatewayRequest<unknown>): Promise<AiGatewayResponse<unknown>> {
    return this.post(agentPath.chat, request);
  }

  private async post<TInput, TOutput>(path: string, request: AiGatewayRequest<TInput>): Promise<AiGatewayResponse<TOutput>> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(90000),
    });

    if (!response.ok) {
      return {
        ok: false,
        errorCode: response.status === 401 || response.status === 403 ? 'unauthorized' : response.status === 429 ? 'rate_limited' : 'unknown',
        message: response.status === 429 ? 'La IA ha alcanzado su cuota temporal. Se reintentara respetando la espera minima.' : `Gateway IA respondio HTTP ${response.status}.`,
      };
    }

    return response.json() as Promise<AiGatewayResponse<TOutput>>;
  }
}

export const createDefaultAiGatewayClient = (): AiGatewayClient => new HttpAiGatewayClient();
