import type { ChatAgentInput, ChatAgentOutput, DirectorAgentInput, DirectorAgentOutput, PlanningAgentInput, PlanningAgentOutput } from '../../domain';
import type { AiGatewayClient, AiGatewayClientContext } from './AiGatewayClient';
import { isChatAgentOutput, isDirectorAgentOutput, isPlanningAgentOutput } from './agentValidators';
import { createDefaultAiGatewayClient } from './HttpAiGatewayClient';

const context: AiGatewayClientContext = {
  appVersion: '1.0.0',
  locale: 'es-ES',
};

const ensureOk = <TOutput>(response: { ok: boolean; data?: TOutput; message?: string }, agentName: string): TOutput => {
  if (!response.ok || !response.data) {
    throw new Error(response.message ?? `${agentName} no devolvio una respuesta valida.`);
  }

  return response.data;
};

export class PlanningAgentClient {
  constructor(private readonly gateway: AiGatewayClient = createDefaultAiGatewayClient()) {}

  async invoke(input: PlanningAgentInput, userId: string): Promise<PlanningAgentOutput> {
    const output = ensureOk(await this.gateway.invokePlanningAgent({ agent: 'planning', userId, correlationId: `planning:${Date.now()}`, input, clientContext: context }), 'ultreia-planner');
    if (!isPlanningAgentOutput(output)) throw new Error('ultreia-planner devolvio un schema invalido.');
    return output;
  }
}

export class DirectorAgentClient {
  constructor(private readonly gateway: AiGatewayClient = createDefaultAiGatewayClient()) {}

  async invoke(input: DirectorAgentInput, userId: string): Promise<DirectorAgentOutput> {
    const output = ensureOk(await this.gateway.invokeDirectorAgent({ agent: 'decision', userId, correlationId: `director:${Date.now()}`, input, clientContext: context }), 'ultreia-director');
    if (!isDirectorAgentOutput(output)) throw new Error('ultreia-director devolvio un schema invalido.');
    return output;
  }
}

export class ChatAgentClient {
  constructor(private readonly gateway: AiGatewayClient = createDefaultAiGatewayClient()) {}

  async invoke(input: ChatAgentInput, userId: string): Promise<ChatAgentOutput> {
    const output = ensureOk(await this.gateway.invokeChatAgent({ agent: 'chat', userId, correlationId: `chat:${Date.now()}`, input, clientContext: context }), 'ultreia-chat');
    if (!isChatAgentOutput(output)) throw new Error('ultreia-chat devolvio un schema invalido.');
    return output;
  }
}
