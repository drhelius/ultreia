import type { Coordinates, DateIso, Evidence } from '../../core';
import type { CaminoService, CaminoStage, Hostel, Monument, StagePoint, StageSections } from '../camino';
import type { CampaignPlan, ActiveJourney } from '../journey';
import type { WeatherSnapshot } from '../realtime';
import type { NearbyEntity } from '../tracking';
import type { UserPreferences, UserProfile } from '../user';

export type DecisionTrigger =
  | 'scheduled_check'
  | 'location_changed'
  | 'stage_milestone'
  | 'weather_changed'
  | 'route_deviation'
  | 'user_action';

export type DecisionRecommendation = {
  id: string;
  type: 'seguridad' | 'agua' | 'descanso' | 'alojamiento' | 'cultural' | 'presupuesto' | 'tracking';
  priority: 'baja' | 'media' | 'alta' | 'critica';
  title: string;
  message: string;
  actionLabel?: string;
  evidence: Evidence[];
  createdAtIso?: DateIso;
  actionType?: 'mostrar' | 'notificar' | 'crear_quest' | 'actualizar_mapa' | 'registrar_diario';
};

export type DecisionCycle = {
  id: string;
  trigger: DecisionTrigger;
  startedAtIso: DateIso;
  completedAtIso?: DateIso;
  journeyId?: string;
  contextSummary?: string;
  discardedRecommendations?: DecisionRecommendation[];
  recommendations: DecisionRecommendation[];
};

export type PhysicalSignals = {
  currentLocation?: Coordinates;
  completedDistanceKm: number;
  remainingKm: number;
  progressPercent: number;
  etaMinutes?: number;
  batteryPercent?: number;
};

export type DecisionContext = {
  schemaVersion: '1.0';
  timestampIso: DateIso;
  user: UserProfile;
  preferences?: UserPreferences;
  activeJourney: ActiveJourney;
  activeCampaign: CampaignPlan;
  activeStage?: CaminoStage;
  stageContext?: {
    sections?: StageSections;
    hostels: Hostel[];
    services: CaminoService[];
    monuments: Monument[];
    points: StagePoint[];
  };
  physical: PhysicalSignals;
  weather?: WeatherSnapshot;
  nearby: NearbyEntity[];
};

export type DecisionOutput = {
  schemaVersion: '1.0';
  generatedAtIso: DateIso;
  recommendations: DecisionRecommendation[];
  discardedRecommendations: DecisionRecommendation[];
};
