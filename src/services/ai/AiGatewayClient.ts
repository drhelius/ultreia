import type { DirectorAgentInput, DirectorAgentOutput, PlanningAgentInput, PlanningAgentOutput } from '../../domain';

export type AiAgentKind = 'planning' | 'decision' | 'chat';

export type AiGatewayClientContext = {
  appVersion: string;
  locale: 'es-ES';
};

export type AiGatewayRequest<TInput> = {
  agent: AiAgentKind;
  userId: string;
  correlationId: string;
  input: TInput;
  clientContext: AiGatewayClientContext;
};

export type AiGatewayResponse<TOutput> = {
  ok: boolean;
  data?: TOutput;
  errorCode?: 'unauthorized' | 'rate_limited' | 'invalid_agent_output' | 'unknown';
  message?: string;
};

export type AiGatewayClient = {
  invokePlanningAgent(request: AiGatewayRequest<PlanningAgentInput>): Promise<AiGatewayResponse<PlanningAgentOutput>>;
  invokeDirectorAgent(request: AiGatewayRequest<DirectorAgentInput>): Promise<AiGatewayResponse<DirectorAgentOutput>>;
  invokeChatAgent(request: AiGatewayRequest<unknown>): Promise<AiGatewayResponse<unknown>>;
};

export type FoundryAgentApplicationBinding = {
  foundryAccount: string;
  projectName: 'ultreia';
  applicationName: 'ultreia-planner' | 'ultreia-director' | 'ultreia-chat';
  protocol: 'responses';
  apiVersion: '2025-11-15-preview';
};
