import { createServer } from 'node:http';

import { AIProjectClient } from '@azure/ai-projects';
import { ClientSecretCredential } from '@azure/identity';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.foundry.local' });

const port = Number(process.env.ULTREIA_GATEWAY_PORT ?? 7071);
const projectEndpoint = process.env.PROJECT_ENDPOINT;

for (const envName of ['PROJECT_ENDPOINT', 'AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET']) {
  if (!process.env[envName]) throw new Error(`Falta ${envName} en .env.foundry.local`);
}

const agentApplications = {
  planning: 'ultreia-planner',
  decision: 'ultreia-director',
  chat: 'ultreia-chat',
};

const credential = new ClientSecretCredential(
  process.env.AZURE_TENANT_ID,
  process.env.AZURE_CLIENT_ID,
  process.env.AZURE_CLIENT_SECRET,
);
const project = new AIProjectClient(projectEndpoint, credential);
const openAIClient = project.getOpenAIClient();

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
    const result = await invokeAgentApplication(route, payload);
    writeJson(response, 200, result);
  } catch (error) {
    writeJson(response, 500, {
      ok: false,
      errorCode: 'unknown',
      message: error instanceof Error ? error.message : 'Error desconocido en AiGateway dev.',
    });
  }
});

server.listen(port, () => {
  console.log(`Ultreia Foundry gateway escuchando en http://localhost:${port}/api/ai/{planning|decision|chat}`);
  console.log('Project endpoint configurado desde .env.foundry.local');
});
