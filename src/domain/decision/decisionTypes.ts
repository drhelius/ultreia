import type { Coordinates, DateIso, Evidence } from '../../core';
import type { CaminoService, CaminoStage, Hostel, Monument, ServiceType, StagePoint, StageSections } from '../camino';
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
  origin?: 'local' | 'foundry';
  stageSlug?: string;
  deduplicationKey?: string;
  relatedEntityIds?: string[];
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
  simulation?: { enabled: boolean };
  nearbyPlaces?: Array<{
    id: string;
    entityId: string;
    title: string;
    type: ServiceType | 'punto';
    distanceKm: number;
    distanceKind: 'straight_line';
    address?: string;
    phone?: string;
    openingHoursText?: string;
    availability: 'unknown';
    mentionedToday?: boolean;
    evidence: Evidence[];
  }>;
  recommendationHistory?: {
    localDate: string;
    timeZone: string;
    totalShownToday: number;
    omittedCount: number;
    deduplicationKeys: string[];
    items: Array<Pick<DecisionRecommendation, 'id' | 'type' | 'priority' | 'title' | 'message' | 'createdAtIso' | 'stageSlug' | 'deduplicationKey' | 'relatedEntityIds'>>;
  };
  stageHighlights?: Array<{
    id: string;
    title: string;
    text: string;
    scope: 'stage';
    mentionedToday: boolean;
    evidence: Evidence[];
  }>;
  contentBrief?: {
    focus: string;
    newPlaceIds: string[];
    newHighlightIds: string[];
  };
};

export type DecisionOutput = {
  schemaVersion: '1.0';
  generatedAtIso: DateIso;
  recommendations: DecisionRecommendation[];
  discardedRecommendations: DecisionRecommendation[];
};
