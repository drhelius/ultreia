import type {
  CaminoRoute,
  CaminoService,
  CaminoStage,
  CaminoTown,
  BudgetProfile,
  Hostel,
  Monument,
  SearchResult,
  ServiceType,
  StagePoint,
  StageSections,
  TravelMode,
} from '../domain';

export type CampaignTemplate = {
  id: string;
  title: string;
  routeSlug: string;
  stageSlugs: string[];
  recommendedDays: number;
};

export type QuestTemplate = {
  id: string;
  title: string;
  stageSlug?: string;
};

export type SearchScope = {
  routeSlug?: string;
  stageSlug?: string;
};

export type CaminoDataRepository = {
  getRoutes(): Promise<CaminoRoute[]>;
  getRoute(routeSlug: string): Promise<CaminoRoute | undefined>;
  getStagesByRoute(routeSlug: string, mode?: TravelMode): Promise<CaminoStage[]>;
  getStage(stageSlug: string): Promise<CaminoStage | undefined>;
  getTowns(): Promise<CaminoTown[]>;
  getTown(townSlug: string): Promise<CaminoTown | undefined>;
  getStageSections(stageSlug: string): Promise<StageSections | undefined>;
  getStagePoints(stageSlug: string): Promise<StagePoint[]>;
  getHostelsByStage(stageSlug: string): Promise<Hostel[]>;
  getMonumentsByStage(stageSlug: string): Promise<Monument[]>;
  getServicesByStage(stageSlug: string, types?: ServiceType[]): Promise<CaminoService[]>;
  searchByText(query: string, scope?: SearchScope): Promise<SearchResult[]>;
  getCampaignTemplates(): Promise<CampaignTemplate[]>;
  getQuestTemplatesForStage(stageSlug: string): Promise<QuestTemplate[]>;
  getBudgetProfiles(): Promise<BudgetProfile[]>;
};
