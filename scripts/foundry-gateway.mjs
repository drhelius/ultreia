import { createServer } from 'node:http';

import { AIProjectClient } from '@azure/ai-projects';
import { ClientSecretCredential } from '@azure/identity';
import { config as loadEnv } from 'dotenv';
import { getWeatherSnapshot } from './weather-provider.mjs';

const foundryEnvPath = process.env.ULTREIA_FOUNDRY_ENV_FILE ?? `${process.env.HOME}/.config/ultreia/foundry-gateway.env`;
loadEnv({ path: foundryEnvPath });

const port = Number(process.env.ULTREIA_GATEWAY_PORT ?? 7071);
const projectEndpoint = process.env.PROJECT_ENDPOINT;

const agentApplications = {
  planning: 'ultreia-planner',
  decision: 'ultreia-director',
  chat: 'ultreia-chat',
};

let openAIClient;
const getOpenAIClient = () => {
  for (const envName of ['PROJECT_ENDPOINT', 'AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET']) {
    if (!process.env[envName]) throw new Error(`Falta configurar ${envName} en el servidor de IA.`);
  }
  if (!openAIClient) {
    const credential = new ClientSecretCredential(process.env.AZURE_TENANT_ID, process.env.AZURE_CLIENT_ID, process.env.AZURE_CLIENT_SECRET);
    openAIClient = new AIProjectClient(projectEndpoint, credential).getOpenAIClient();
  }
  return openAIClient;
};

const readBody = async (request) => new Promise((resolve, reject) => {
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  request.on('error', reject);
});

const writeJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  response.end(JSON.stringify(payload));
};

const extractOutputText = (payload) => {
  if (typeof payload.output_text === 'string') return payload.output_text;
  if (typeof payload.content === 'string') return payload.content;

  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (typeof item.content === 'string') return item.content;
    if (Array.isArray(item.content)) {
      const text = item.content.map((contentItem) => contentItem.text ?? contentItem.output_text ?? '').join('').trim();
      if (text) return text;
    }
  }

  return JSON.stringify(payload);
};

const parseAgentJson = (payload) => {
  const outputText = typeof payload === 'string' ? payload.trim() : extractOutputText(payload).trim();
  const fenced = outputText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
  return JSON.parse(fenced ?? outputText);
};

const invokeAgentApplication = async (agentKind, requestPayload) => {
  const agentName = agentApplications[agentKind];
  if (!agentName) throw new Error(`Agente desconocido: ${agentKind}`);
  const openAIClient = getOpenAIClient();

  const conversation = await openAIClient.conversations.create();
  const response = await openAIClient.responses.create(
    {
      conversation: conversation.id,
      input: JSON.stringify(requestPayload.input),
      metadata: {
        userId: requestPayload.userId,
        correlationId: requestPayload.correlationId,
        agent: requestPayload.agent,
      },
    },
    { body: { agent_reference: { name: agentName, type: 'agent_reference' } } },
  );

  return {
    ok: true,
    data: parseAgentJson(response),
  };
};

const server = createServer(async (request, response) => {
  if (request.url === '/health' && request.method === 'GET') {
    writeJson(response, 200, { ok: true });
    return;
  }
  if (request.method === 'OPTIONS') {
    writeJson(response, 204, {});
    return;
  }

  if (request.method !== 'POST') {
    writeJson(response, 405, { ok: false, errorCode: 'unknown', message: 'Metodo no permitido.' });
    return;
  }

  const route = request.url?.replace(/^\/api\/ai\/?/, '').replace(/^\//, '').split('?')[0] ?? '';

  try {
    const body = await readBody(request);
    const payload = JSON.parse(body);
    if (request.url?.split('?')[0] === '/api/realtime/weather') {
      writeJson(response, 200, await getWeatherSnapshot(payload.coordinates));
      return;
    }
    const result = await invokeAgentApplication(route, payload);
    writeJson(response, 200, result);
  } catch (error) {
    const rateLimited = error.status === 429 || error.statusCode === 429;
    writeJson(response, rateLimited ? 429 : 500, {
      ok: false,
      errorCode: rateLimited ? 'rate_limited' : 'unknown',
      message: error instanceof Error ? error.message : 'Error desconocido en AiGateway dev.',
    });
  }
});

server.listen(port, () => {
  console.log(`Ultreia Foundry gateway escuchando en http://localhost:${port}/api/ai/{planning|decision|chat}`);
  console.log('Project endpoint configurado desde el fichero local del gateway');
});
