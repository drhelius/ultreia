import type { Locale } from '../types';

export type AppConfig = {
  appName: string;
  locale: Locale;
  enableFoundryAgents: boolean;
  enableRealtimeWeather: boolean;
  aiGatewayBaseUrl: string;
  weatherGatewayBaseUrl: string;
};

export const appConfig: AppConfig = {
  appName: 'Ultreia',
  locale: 'es-ES',
  enableFoundryAgents: true,
  enableRealtimeWeather: true,
  aiGatewayBaseUrl: process.env.EXPO_PUBLIC_AI_GATEWAY_BASE_URL ?? 'http://localhost:7071/api/ai',
  weatherGatewayBaseUrl: process.env.EXPO_PUBLIC_WEATHER_GATEWAY_BASE_URL ?? 'http://localhost:7071/api/realtime/weather',
};
