import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { appConfig, systemClock, type Coordinates } from '../../core';
import { staticCaminoDataRepository } from '../../data/camino';
import type { ActiveJourney, PilgrimClass, PlanningAgentCatalog, StageProgress, UserPreferences, UserProfile } from '../../domain';
import { useLocalPersistence } from '../../persistence';
import { PlanningAgentClient } from '../../services';
import { recommendationToCampaignPlan, type CampaignRecommendation, planCampaigns } from '../planning';
import { budgetModeOptions, dayOptions, goalOptions, pilgrimClassOptions, travelModeOptions } from './onboardingOptions';
import type { OnboardingDraft, OnboardingStep } from './onboardingTypes';

type OnboardingFlowScreenProps = {
  onCompleted: () => void;
};

type PlannerRecommendationView = {
  campaignId: string;
  fitScore: number;
  headline: string;
  reasons: string[];
  tradeoffs: string[];
};

type RouteMapPoint = {
  id: string;
  title: string;
  coordinate: Coordinates;
  kind: 'town' | 'point';
};

type RouteDetailTab = 'stages' | 'points' | 'complete';

type Option<TValue extends string | number> = { label: string; value: TValue };

const steps: OnboardingStep[] = ['profile', 'mode', 'classes', 'availability', 'goal', 'budget', 'preferences', 'recommendations'];

const initialDraft: OnboardingDraft = {
  displayName: 'Peregrino',
  pilgrimClasses: ['tranquilo'],
  travelMode: 'walk',
  availableDays: 7,
  budgetMode: 'equilibrado',
  goal: 'llegar_a_santiago',
  avoidCrowds: false,
};

const createLocalId = (scope: string): string => `${scope}:${Date.now()}`;

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function OnboardingFlowScreen({ onCompleted }: OnboardingFlowScreenProps) {
  const persistence = useLocalPersistence();
  const plannerClient = useMemo(() => new PlanningAgentClient(), []);
  const styles = useMemo(() => createStyles(), []);
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);
  const [stepIndex, setStepIndex] = useState(0);
  const [recommendations, setRecommendations] = useState<CampaignRecommendation[]>([]);
  const [plannerSummary, setPlannerSummary] = useState<string>();
  const [plannerRecommendations, setPlannerRecommendations] = useState<PlannerRecommendationView[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>();
  const [routeMapPoints, setRouteMapPoints] = useState<RouteMapPoint[]>([]);
  const [routeDetailTab, setRouteDetailTab] = useState<RouteDetailTab>('stages');
  const [mapZoom, setMapZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string>();

  const step = steps[stepIndex];
  const visibleStep: OnboardingStep = planning ? 'planning' : step;
  const selectedRecommendation = recommendations.find((recommendation) => recommendation.campaign.id === selectedCampaignId) ?? recommendations[0];
  const plannerByCampaign = useMemo(() => new Map(plannerRecommendations.map((recommendation) => [recommendation.campaignId, recommendation])), [plannerRecommendations]);

  const updateDraft = <TKey extends keyof OnboardingDraft>(key: TKey, value: OnboardingDraft[TKey]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const togglePilgrimClass = (value: PilgrimClass) => {
    setDraft((current) => {
      const exists = current.pilgrimClasses.includes(value);
      const nextClasses = exists ? current.pilgrimClasses.filter((item) => item !== value) : [...current.pilgrimClasses, value];
      return { ...current, pilgrimClasses: nextClasses.length > 0 ? nextClasses : [value] };
    });
  };

  const buildRoutePoints = async (recommendation: CampaignRecommendation) => {
    const towns = await staticCaminoDataRepository.getTowns();
    const townsBySlug = new Map(towns.map((town) => [town.slug, town]));
    const points: RouteMapPoint[] = [];
    const addTownPoint = (townName: string) => {
      const town = townsBySlug.get(normalize(townName));
      if (town?.coordinateStatus === 'verified' && town.coordinate) points.push({ id: `town:${town.slug}`, title: town.title, coordinate: town.coordinate, kind: 'town' });
    };

    for (const stage of recommendation.stages) {
      addTownPoint(stage.startTown);
      addTownPoint(stage.endTown);
    }

    const stagePoints = (await Promise.all(recommendation.stages.map((stage) => staticCaminoDataRepository.getStagePoints(stage.slug)))).flat();
    for (const point of stagePoints) {
      if (point.coordinateStatus === 'verified' && point.coordinate) {
        points.push({ id: `point:${point.id}`, title: point.title, coordinate: point.coordinate, kind: 'point' });
      }
    }

    setRouteMapPoints(points.filter((point, index, all) => all.findIndex((candidate) => candidate.id === point.id || (candidate.coordinate.latitude === point.coordinate.latitude && candidate.coordinate.longitude === point.coordinate.longitude && candidate.title === point.title)) === index));
  };

  const buildPlannerCatalog = async (nextRecommendations: CampaignRecommendation[]): Promise<PlanningAgentCatalog> => {
    const [routes, budgetProfiles] = await Promise.all([
      staticCaminoDataRepository.getRoutes(),
      staticCaminoDataRepository.getBudgetProfiles(),
    ]);
    const candidates = await Promise.all(nextRecommendations.map(async (recommendation) => ({
      campaignId: recommendation.campaign.id,
      title: recommendation.campaign.title,
      routeSlug: recommendation.campaign.routeSlug,
      fitScore: recommendation.fitScore,
      score: recommendation.score,
      totalKm: recommendation.totalKm,
      estimatedDays: recommendation.estimatedDays,
      dailyKm: recommendation.dailyKm,
      difficulty: recommendation.difficulty,
      budgetEstimateEur: recommendation.budgetEstimateEur,
      reasons: recommendation.reasons,
      risks: recommendation.risks,
      route: {
        title: recommendation.route.title,
        subtitle: recommendation.route.subtitle,
        startTown: recommendation.route.startTown,
        endTown: recommendation.route.endTown,
        totalKm: recommendation.route.totalKm,
      },
      stages: await Promise.all(recommendation.stages.map(async (stage) => {
        const [sections, hostels, services, monuments, points] = await Promise.all([
          staticCaminoDataRepository.getStageSections(stage.slug),
          staticCaminoDataRepository.getHostelsByStage(stage.slug),
          staticCaminoDataRepository.getServicesByStage(stage.slug),
          staticCaminoDataRepository.getMonumentsByStage(stage.slug),
          staticCaminoDataRepository.getStagePoints(stage.slug),
        ]);

        return {
          slug: stage.slug,
          order: stage.order,
          title: stage.title,
          startTown: stage.startTown,
          endTown: stage.endTown,
          distanceKm: stage.distanceKm,
          difficulty: stage.difficulty,
          summary: stage.summary,
          itinerarySummary: sections?.itinerarySummary,
          difficultyNotes: sections?.difficultyNotes ?? [],
          observations: sections?.observations ?? [],
          whatToSee: sections?.whatToSee ?? [],
          hostelTitles: hostels.map((hostel) => hostel.title),
          serviceTitles: services.map((service) => `${service.type}: ${service.title}`),
          monumentTitles: monuments.map((monument) => monument.title),
          pointTitles: points.map((point) => point.title),
        };
      })),
    })));

    return {
      generatedAtIso: systemClock.nowIso(),
      routes: routes.map((route) => ({
        slug: route.slug,
        title: route.title,
        subtitle: route.subtitle,
        startTown: route.startTown,
        endTown: route.endTown,
        totalKm: route.totalKm,
        walkingStageCount: route.walkingStageCount,
        cyclingStageCount: route.cyclingStageCount,
        hostelCount: route.hostelCount,
        hasMonuments: route.hasMonuments,
      })),
      budgetProfiles: budgetProfiles.map((profile) => ({ mode: profile.mode, dailyTargetEur: profile.dailyTargetEur, notes: [] })),
      candidates,
    };
  };

  const runPlanner = async () => {
    setPlanning(true);
    setError(undefined);
    try {
      const nextRecommendations = await planCampaigns(staticCaminoDataRepository, draft);
      const catalog = await buildPlannerCatalog(nextRecommendations);
      const plannerOutput = await plannerClient.invoke({
        schemaVersion: '1.0',
        locale: 'es-ES',
        user: {
          displayName: draft.displayName,
          pilgrimClasses: draft.pilgrimClasses,
          travelMode: draft.travelMode,
        },
        constraints: {
          availableDays: draft.availableDays,
          target: draft.goal,
          budgetMode: draft.budgetMode,
          avoidCrowds: draft.avoidCrowds,
        },
        deterministicRanking: nextRecommendations.map((recommendation) => ({
          campaignId: recommendation.campaign.id,
          routeSlug: recommendation.campaign.routeSlug,
          estimatedDays: recommendation.estimatedDays,
          totalKm: recommendation.totalKm,
          difficulty: recommendation.difficulty,
          budgetEstimateEur: recommendation.budgetEstimateEur,
          reasons: recommendation.reasons,
          risks: recommendation.risks,
        })),
        catalog,
      }, 'onboarding-user');

      setRecommendations(nextRecommendations);
      setPlannerSummary(plannerOutput.summary);
      setPlannerRecommendations(plannerOutput.recommendations);
      const firstCampaignId = plannerOutput.recommendations[0]?.campaignId ?? nextRecommendations[0]?.campaign.id;
      setSelectedCampaignId(firstCampaignId);
      const firstRecommendation = nextRecommendations.find((recommendation) => recommendation.campaign.id === firstCampaignId) ?? nextRecommendations[0];
      if (firstRecommendation) await buildRoutePoints(firstRecommendation);
      setStepIndex(steps.indexOf('recommendations'));
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'No se pudo calcular la planificacion.');
    } finally {
      setPlanning(false);
    }
  };

  const goNext = async () => {
    if (step === 'profile' && !draft.displayName.trim()) {
      setError('Escribe un nombre visible para continuar.');
      return;
    }
    setError(undefined);
    if (step === 'preferences') {
      await runPlanner();
      return;
    }
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  const goBack = () => {
    setError(undefined);
    setStepIndex((current) => Math.max(0, current - 1));
  };

  const selectRecommendation = async (recommendation: CampaignRecommendation) => {
    setSelectedCampaignId(recommendation.campaign.id);
    await buildRoutePoints(recommendation);
  };

  const completeOnboarding = async () => {
    if (!persistence.repositories || !selectedRecommendation || selectedRecommendation.stages.length === 0) {
      setError('No se puede confirmar una campana sin etapas disponibles.');
      return;
    }

    setSaving(true);
    setError(undefined);
    try {
      const nowIso = systemClock.nowIso();
      const userId = createLocalId('user');
      const campaignPlan = recommendationToCampaignPlan(selectedRecommendation, draft.travelMode);
      const journeyId = createLocalId('journey');
      const primaryClass = draft.pilgrimClasses[0] ?? 'tranquilo';
      const profile: UserProfile = {
        id: userId,
        displayName: draft.displayName.trim() || 'Peregrino',
        locale: appConfig.locale,
        pilgrimClass: primaryClass,
        pilgrimClasses: draft.pilgrimClasses,
        travelMode: draft.travelMode,
        budgetMode: draft.budgetMode,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      };
      const preferences: UserPreferences = {
        userId,
        notificationTolerance: 'normal',
        allowLocationTracking: true,
        allowCommunityFeatures: false,
      };
      const journey: ActiveJourney = {
        id: journeyId,
        userId,
        campaignId: campaignPlan.id,
        routeSlug: campaignPlan.routeSlug,
        activeStageSlug: campaignPlan.stageSlugs[0],
        status: 'active',
        startedAtIso: nowIso,
        updatedAtIso: nowIso,
      };

      await persistence.repositories.userProfileRepository.saveProfile(profile);
      await persistence.repositories.userProfileRepository.savePreferences(preferences);
      await persistence.repositories.journeyRepository.saveSelectedCampaign(campaignPlan);
      await persistence.repositories.journeyRepository.saveActiveJourney(journey);

      for (const [index, stageSlug] of campaignPlan.stageSlugs.entries()) {
        const progress: StageProgress = { journeyId, stageSlug, state: index === 0 ? 'activa' : 'futura' };
        await persistence.repositories.journeyRepository.saveStageProgress(progress);
      }

      onCompleted();
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'No se pudo guardar el onboarding.');
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    if (planning) {
      return (
        <View style={styles.transitionPanel}>
          <Text style={styles.transitionTitle}>Utilizando IA para hacerte una recomendacion</Text>
          <Text style={styles.transitionText}>ultreia-planner esta revisando tus preferencias, etapas reales, servicios, albergues, puntos de interes, riesgos y presupuesto.</Text>
        </View>
      );
    }
    if (step === 'profile') {
      return <TextInput value={draft.displayName} onChangeText={(value) => updateDraft('displayName', value)} placeholder="Peregrino" placeholderTextColor="#6F858C" style={styles.input} />;
    }
    if (step === 'mode') {
      return <SingleOptionGroup options={travelModeOptions} selected={draft.travelMode} onSelect={(value) => updateDraft('travelMode', value)} />;
    }
    if (step === 'classes') {
      return <MultiOptionGroup options={pilgrimClassOptions} selected={draft.pilgrimClasses} onToggle={togglePilgrimClass} />;
    }
    if (step === 'availability') {
      return <SingleOptionGroup options={dayOptions} selected={draft.availableDays} onSelect={(value) => updateDraft('availableDays', value)} />;
    }
    if (step === 'goal') {
      return <SingleOptionGroup options={goalOptions} selected={draft.goal} onSelect={(value) => updateDraft('goal', value)} />;
    }
    if (step === 'budget') {
      return <SingleOptionGroup options={budgetModeOptions} selected={draft.budgetMode} onSelect={(value) => updateDraft('budgetMode', value)} />;
    }
    if (step === 'preferences') {
      return (
        <Pressable style={[styles.toggle, draft.avoidCrowds && styles.toggleActive]} onPress={() => updateDraft('avoidCrowds', !draft.avoidCrowds)}>
          <Text style={[styles.toggleText, draft.avoidCrowds && styles.toggleTextActive]}>Evitar masificacion</Text>
        </Pressable>
      );
    }
    return (
      <View style={styles.section}>
        {plannerSummary ? <Text style={styles.plannerSummary}>{plannerSummary}</Text> : null}
        {selectedRecommendation ? <RoutePreviewMap points={routeMapPoints} recommendation={selectedRecommendation} selectedTab={routeDetailTab} zoom={mapZoom} onSelectTab={setRouteDetailTab} onZoomIn={() => setMapZoom((current) => Math.min(3, Number((current + 0.5).toFixed(1))))} onZoomOut={() => setMapZoom((current) => Math.max(1, Number((current - 0.5).toFixed(1))))} /> : null}
        {recommendations.map((recommendation) => {
          const plannerRecommendation = plannerByCampaign.get(recommendation.campaign.id);
          const fitScore = plannerRecommendation?.fitScore ?? recommendation.fitScore;
          return (
            <Pressable key={recommendation.campaign.id} style={[styles.campaignCard, selectedCampaignId === recommendation.campaign.id && styles.campaignCardActive]} onPress={() => void selectRecommendation(recommendation)}>
              <View style={styles.campaignHeader}>
                <Text style={styles.campaignTitle}>{recommendation.campaign.title}</Text>
                <Text style={styles.score}>{Math.round(fitScore * 100)}%</Text>
              </View>
              {plannerRecommendation?.headline ? <Text style={styles.reason}>{plannerRecommendation.headline}</Text> : null}
              <Text style={styles.campaignMeta}>{recommendation.totalKm} km · {recommendation.estimatedDays} dias · dificultad {recommendation.difficulty} · {recommendation.budgetEstimateEur} EUR</Text>
              <Text style={styles.reason}>{plannerRecommendation?.reasons[0] ?? recommendation.reasons[0]}</Text>
              {(plannerRecommendation?.tradeoffs[0] ?? recommendation.risks[0]) ? <Text style={styles.risk}>{plannerRecommendation?.tradeoffs[0] ?? recommendation.risks[0]}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.overline}>Asistente de inicio · {stepIndex + 1}/{steps.length}</Text>
        <Text style={styles.title}>{stepTitle(visibleStep)}</Text>
        <Text style={styles.subtitle}>{stepSubtitle(visibleStep)}</Text>
      </View>

      <View style={styles.section}>{renderStep()}</View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {planning ? null : <View style={styles.navigationRow}>
        {stepIndex > 0 ? <Pressable style={styles.secondaryButton} onPress={goBack}><Text style={styles.secondaryButtonText}>Anterior</Text></Pressable> : null}
        {step === 'recommendations'
          ? <Pressable disabled={saving || !selectedRecommendation} style={[styles.primaryButton, (saving || !selectedRecommendation) && styles.primaryButtonDisabled]} onPress={completeOnboarding}><Text style={styles.primaryButtonText}>{saving ? 'Guardando...' : 'Empezar mi Camino'}</Text></Pressable>
          : <Pressable disabled={planning} style={[styles.primaryButton, planning && styles.primaryButtonDisabled]} onPress={() => void goNext()}><Text style={styles.primaryButtonText}>{planning ? 'Consultando planner...' : step === 'preferences' ? 'Ver recomendaciones' : 'Siguiente'}</Text></Pressable>}
      </View>}
    </ScrollView>
  );
}

function stepTitle(step: OnboardingStep): string {
  const titles: Record<OnboardingStep, string> = {
    profile: 'Como quieres aparecer?',
    mode: 'Como haras el Camino?',
    classes: 'Que tipo de peregrino eres?',
    availability: 'Cuantos dias tienes?',
    goal: 'Cual es tu objetivo?',
    budget: 'Como quieres viajar?',
    preferences: 'Alguna preferencia extra?',
    planning: 'Preparando tu recomendacion',
    recommendations: 'Elige tu ruta',
  };
  return titles[step];
}

function stepSubtitle(step: OnboardingStep): string {
  const subtitles: Record<OnboardingStep, string> = {
    profile: 'Este nombre se usara en tu credencial y diario local.',
    mode: 'A pie, en bici o en coche cambian ritmo y recomendaciones.',
    classes: 'Puedes elegir varias clases; activan pesos de recomendacion distintos.',
    availability: 'La disponibilidad ajusta etapas, presupuesto y dificultad.',
    goal: 'El planner priorizara rutas segun lo que quieras vivir.',
    budget: 'Usamos perfiles del data pack para estimar coste total.',
    preferences: 'Antes de mostrar rutas consultaremos ultreia-planner.',
    planning: 'La IA esta leyendo el contexto completo para proponer una ruta coherente.',
    recommendations: 'Resumen del planner, detalle de ruta y mapa esquematico con coordenadas verificadas.',
  };
  return subtitles[step];
}

function SingleOptionGroup<TValue extends string | number>({ options, selected, onSelect }: { options: Option<TValue>[]; selected: TValue; onSelect: (value: TValue) => void }) {
  const styles = useMemo(() => createStyles(), []);
  return <View style={styles.optionRow}>{options.map((option) => <OptionChip key={String(option.value)} label={option.label} active={selected === option.value} onPress={() => onSelect(option.value)} />)}</View>;
}

function MultiOptionGroup<TValue extends string>({ options, selected, onToggle }: { options: Option<TValue>[]; selected: TValue[]; onToggle: (value: TValue) => void }) {
  const styles = useMemo(() => createStyles(), []);
  return <View style={styles.optionRow}>{options.map((option) => <OptionChip key={option.value} label={option.label} active={selected.includes(option.value)} onPress={() => onToggle(option.value)} />)}</View>;
}

function OptionChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const styles = useMemo(() => createStyles(), []);
  return <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function RoutePreviewMap({
  points,
  recommendation,
  selectedTab,
  zoom,
  onSelectTab,
  onZoomIn,
  onZoomOut,
}: {
  points: RouteMapPoint[];
  recommendation: CampaignRecommendation;
  selectedTab: RouteDetailTab;
  zoom: number;
  onSelectTab: (tab: RouteDetailTab) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  const styles = useMemo(() => createStyles(), []);
  const bounds = points.length > 0 ? getBounds(points) : undefined;
  const stagePointItems = points.filter((point) => point.kind === 'point');

  return (
    <View style={styles.routeDetail}>
      <Text style={styles.sectionTitle}>Detalle de ruta</Text>
      <Text style={styles.campaignMeta}>{recommendation.stages.length} etapas · {points.length} puntos con coordenada verificada</Text>
      <View style={styles.mapToolbar}>
        <Pressable style={styles.smallButton} onPress={onZoomOut}><Text style={styles.smallButtonText}>Zoom -</Text></Pressable>
        <Text style={styles.zoomText}>{zoom.toFixed(1)}x</Text>
        <Pressable style={styles.smallButton} onPress={onZoomIn}><Text style={styles.smallButtonText}>Zoom +</Text></Pressable>
      </View>
      <View style={styles.mapBox}>
        {bounds ? points.map((point) => <View key={point.id} style={[styles.mapPoint, point.kind === 'point' && styles.stageMapPoint, projectPoint(point.coordinate, bounds), { height: 8 + zoom * 3, width: 8 + zoom * 3 }]} />) : <Text style={styles.mapText}>No hay coordenadas verificadas suficientes para previsualizar esta ruta.</Text>}
      </View>
      <View style={styles.tabRow}>
        <DetailTabChip label="Etapas" active={selectedTab === 'stages'} onPress={() => onSelectTab('stages')} />
        <DetailTabChip label="Puntos" active={selectedTab === 'points'} onPress={() => onSelectTab('points')} />
        <DetailTabChip label="Ruta completa" active={selectedTab === 'complete'} onPress={() => onSelectTab('complete')} />
      </View>
      {selectedTab === 'points' && (stagePointItems.length > 0 ? stagePointItems.slice(0, 12).map((point) => <Text key={point.id} style={styles.stageLine}>{point.title}</Text>) : <Text style={styles.stageLine}>No hay puntos verificados adicionales para estas etapas.</Text>)}
      {selectedTab !== 'points' && recommendation.stages.slice(0, selectedTab === 'complete' ? recommendation.stages.length : 8).map((stage) => <Text key={stage.slug} style={styles.stageLine}>{stage.order}. {stage.title} · {stage.distanceKm} km</Text>)}
    </View>
  );
}

function DetailTabChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const styles = useMemo(() => createStyles(), []);
  return <Pressable style={[styles.detailTab, active && styles.detailTabActive]} onPress={onPress}><Text style={[styles.detailTabText, active && styles.detailTabTextActive]}>{label}</Text></Pressable>;
}

const getBounds = (points: RouteMapPoint[]) => {
  const latitudes = points.map((point) => point.coordinate.latitude);
  const longitudes = points.map((point) => point.coordinate.longitude);
  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLon: Math.min(...longitudes),
    maxLon: Math.max(...longitudes),
  };
};

const projectPoint = (point: Coordinates, bounds: ReturnType<typeof getBounds>) => {
  const latSpan = Math.max(0.0001, bounds.maxLat - bounds.minLat);
  const lonSpan = Math.max(0.0001, bounds.maxLon - bounds.minLon);
  return {
    left: `${8 + ((point.longitude - bounds.minLon) / lonSpan) * 84}%`,
    top: `${8 + (1 - (point.latitude - bounds.minLat) / latSpan) * 84}%`,
  } as const;
};

const createStyles = () => StyleSheet.create({
  campaignCard: {
    backgroundColor: '#102A36',
    borderColor: '#25485A',
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  campaignCardActive: { borderColor: '#F4B321' },
  campaignHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  campaignMeta: { color: '#A9B7B7', fontSize: 13 },
  campaignTitle: { color: '#F4F0E8', flex: 1, fontSize: 16, fontWeight: '800' },
  chip: { backgroundColor: '#102A36', borderColor: '#25485A', borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  chipActive: { backgroundColor: '#F4B321', borderColor: '#F4B321' },
  chipText: { color: '#D9E3E6', fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#071923' },
  content: { gap: 18, padding: 16, paddingBottom: 36 },
  error: { color: '#F97316', fontSize: 14, fontWeight: '700' },
  header: { gap: 8, paddingTop: 12 },
  input: { backgroundColor: '#102A36', borderColor: '#25485A', borderRadius: 8, borderWidth: 1, color: '#F4F0E8', fontSize: 16, paddingHorizontal: 12, paddingVertical: 12 },
  detailTab: { backgroundColor: '#17372F', borderColor: '#25485A', borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  detailTabActive: { backgroundColor: '#F4B321', borderColor: '#F4B321' },
  detailTabText: { color: '#D9E3E6', fontSize: 12, fontWeight: '800' },
  detailTabTextActive: { color: '#071923' },
  mapBox: { backgroundColor: '#071923', borderColor: '#25485A', borderRadius: 8, borderWidth: 1, height: 180, overflow: 'hidden' },
  mapPoint: { backgroundColor: '#F4B321', borderColor: '#071923', borderRadius: 999, borderWidth: 2, height: 10, marginLeft: -5, marginTop: -5, position: 'absolute', width: 10 },
  mapText: { color: '#A9B7B7', fontSize: 13, padding: 12, textAlign: 'center' },
  mapToolbar: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  navigationRow: { flexDirection: 'row', gap: 10 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  overline: { color: '#F4B321', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  plannerSummary: { backgroundColor: '#17372F', borderColor: '#25485A', borderRadius: 10, borderWidth: 1, color: '#F4F0E8', fontSize: 14, lineHeight: 20, padding: 12 },
  primaryButton: { alignItems: 'center', backgroundColor: '#F4B321', borderRadius: 10, flex: 1, paddingVertical: 14 },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#071923', fontSize: 16, fontWeight: '900' },
  reason: { color: '#F4F0E8', fontSize: 13, lineHeight: 19 },
  risk: { color: '#F97316', fontSize: 13, lineHeight: 19 },
  routeDetail: { backgroundColor: '#102A36', borderColor: '#25485A', borderRadius: 12, borderWidth: 1, gap: 10, padding: 14 },
  score: { color: '#F4B321', fontSize: 16, fontWeight: '900' },
  secondaryButton: { alignItems: 'center', backgroundColor: '#17372F', borderColor: '#25485A', borderRadius: 10, borderWidth: 1, flex: 1, paddingVertical: 14 },
  secondaryButtonText: { color: '#F4F0E8', fontSize: 16, fontWeight: '900' },
  section: { gap: 10 },
  sectionTitle: { color: '#F4B321', fontSize: 20, fontWeight: '900' },
  smallButton: { backgroundColor: '#17372F', borderColor: '#25485A', borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  smallButtonText: { color: '#F4F0E8', fontSize: 12, fontWeight: '900' },
  stageLine: { color: '#A9B7B7', fontSize: 12 },
  stageMapPoint: { backgroundColor: '#39B86A' },
  subtitle: { color: '#A9B7B7', fontSize: 15, lineHeight: 22 },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  title: { color: '#F4F0E8', fontSize: 30, fontWeight: '900' },
  toggle: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#102A36', borderColor: '#25485A', borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  toggleActive: { backgroundColor: '#39B86A', borderColor: '#39B86A' },
  toggleText: { color: '#D9E3E6', fontWeight: '800' },
  toggleTextActive: { color: '#071923' },
  transitionPanel: { backgroundColor: '#102A36', borderColor: '#25485A', borderRadius: 12, borderWidth: 1, gap: 10, padding: 18 },
  transitionText: { color: '#A9B7B7', fontSize: 14, lineHeight: 20 },
  transitionTitle: { color: '#F4B321', fontSize: 18, fontWeight: '900' },
  zoomText: { color: '#F4F0E8', fontSize: 13, fontWeight: '900' },
});
