import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { appConfig, systemClock } from '../../core';
import { mapRepository } from '../../data/camino/mapRepository';
import { staticCaminoDataRepository } from '../../data/camino';
import type { ActiveJourney, PilgrimClass, PlanningAgentCatalog, PlanningAgentOutput, StageProgress, UserPreferences, UserProfile } from '../../domain';
import { useLocalPersistence } from '../../persistence';
import { PlanningAgentClient } from '../../services';
import { recommendationToCampaignPlan, type CampaignRecommendation, planCampaigns } from '../planning';
import { formatCampaignRationale, planningExplanationGuidance, selectPlannerRecommendations } from '../planning/campaignPresenter';
import { MapCanvas } from '../live-map/MapCanvas';
import type { MapItineraryStage } from '../live-map/mapDocument';
import { budgetModeOptions, dayOptions, goalOptions, pilgrimClassOptions, travelModeOptions } from './onboardingOptions';
import type { OnboardingDraft, OnboardingStep } from './onboardingTypes';

type OnboardingFlowScreenProps = {
  onCompleted: () => void;
};

type PlannerRecommendationView = PlanningAgentOutput['recommendations'][number];

type Option<TValue extends string | number> = { label: string; value: TValue };

const steps: OnboardingStep[] = ['profile', 'mode', 'classes', 'availability', 'goal', 'budget', 'requirements', 'recommendations'];

const initialDraft: OnboardingDraft = {
  displayName: 'Peregrino',
  pilgrimClasses: ['tranquilo'],
  travelMode: 'walk',
  availableDays: 7,
  budgetMode: 'equilibrado',
  goal: 'llegar_a_santiago',
  avoidCrowds: false,
  additionalRequirements: '',
};

const createLocalId = (scope: string): string => `${scope}:${Date.now()}`;
const normalizedTown = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

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
  const [saving, setSaving] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [planningPhase, setPlanningPhase] = useState<'preparing' | 'requesting'>('preparing');
  const planningRequest = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const [error, setError] = useState<string>();

  const step = steps[stepIndex];
  const visibleStep: OnboardingStep = planning ? 'planning' : step;
  const selectedRecommendation = recommendations.find((recommendation) => recommendation.campaign.id === selectedCampaignId) ?? recommendations[0];
  const campaignAudits = useMemo(() => new Map(recommendations.map((recommendation) => [recommendation.campaign.id, mapRepository.getCampaignAudit(recommendation.stages.map((stage) => stage.slug))])), [recommendations]);
  const selectedMapAudit = selectedRecommendation ? campaignAudits.get(selectedRecommendation.campaign.id) : undefined;
  const canConfirmCampaign = Boolean(selectedRecommendation && selectedMapAudit?.ready);
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
      routeSelection: {
        startTown: recommendation.stages[0].startTown,
        endTown: recommendation.stages[recommendation.stages.length - 1].endTown,
        stageCount: recommendation.stages.length,
        travelMode: draft.travelMode,
        variantGroups: [...new Set(recommendation.stages.map((stage) => stage.variantGroup))],
        viaTowns: [...new Set(recommendation.stages.flatMap((stage) => stage.viaTowns ?? []))],
        startsAtBaseOrigin: normalizedTown(recommendation.stages[0].startTown) === normalizedTown(recommendation.route.startTown),
        endsAtBaseDestination: normalizedTown(recommendation.stages[recommendation.stages.length - 1].endTown) === normalizedTown(recommendation.route.endTown),
      },
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
          summary: stage.summary.slice(0, 240),
          itinerarySummary: sections?.itinerarySummary?.slice(0, 300),
          difficultyNotes: sections?.difficultyNotes.slice(0, 2).map((note) => note.slice(0, 160)) ?? [],
          observations: sections?.observations.slice(0, 2).map((note) => note.slice(0, 160)) ?? [],
          whatToSee: sections?.whatToSee.slice(0, 2).map((note) => note.slice(0, 160)) ?? [],
          hostelTitles: hostels.slice(0, 3).map((hostel) => hostel.title),
          serviceTitles: services.slice(0, 5).map((service) => `${service.type}: ${service.title}`),
          monumentTitles: monuments.slice(0, 3).map((monument) => monument.title),
          pointTitles: points.slice(0, 3).map((point) => point.title),
        };
      })),
    })));

    return {
      generatedAtIso: systemClock.nowIso(),
      routes: routes.filter((route) => nextRecommendations.some((recommendation) => recommendation.route.slug === route.slug)).map((route) => ({
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
    if (planningRequest.current) return;
    planningRequest.current = true;
    setPlanningPhase('preparing');
    setPlanning(true);
    setError(undefined);
    scroll.current?.scrollTo({ y: 0, animated: false });
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
      const nextRecommendations = await planCampaigns(staticCaminoDataRepository, draft, { verifiedMapsOnly: true });
      if (!nextRecommendations.length) throw new Error('No hay un recorrido completo verificado para estas preferencias. Ajusta los dias o el objetivo.');
      const catalog = await buildPlannerCatalog(nextRecommendations);
      setPlanningPhase('requesting');
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
          additionalRequirements: draft.additionalRequirements?.trim() || undefined,
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
        explanationGuidance: planningExplanationGuidance,
      }, 'onboarding-user');

      const selected = selectPlannerRecommendations(nextRecommendations, plannerOutput.recommendations.map((item) => item.campaignId));
      setRecommendations(selected);
      setPlannerSummary(plannerOutput.summary);
      setPlannerRecommendations(plannerOutput.recommendations);
      const firstCampaignId = selected[0].campaign.id;
      setSelectedCampaignId(firstCampaignId);
      setStepIndex(steps.indexOf('recommendations'));
      scroll.current?.scrollTo({ y: 0, animated: false });
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'No se pudo calcular la planificacion.');
    } finally {
      planningRequest.current = false;
      setPlanning(false);
    }
  };

  const goNext = async () => {
    if (step === 'profile' && !draft.displayName.trim()) {
      setError('Escribe un nombre visible para continuar.');
      return;
    }
    setError(undefined);
    if (step === 'requirements') {
      await runPlanner();
      return;
    }
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  const goBack = () => {
    setError(undefined);
    setStepIndex((current) => Math.max(0, current - 1));
  };

  const selectRecommendation = (recommendation: CampaignRecommendation) => {
    setSelectedCampaignId(recommendation.campaign.id);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const completeOnboarding = async () => {
    if (!persistence.repositories || !selectedRecommendation || selectedRecommendation.stages.length === 0) {
      setError('No se puede confirmar una campana sin etapas disponibles.');
      return;
    }
    const audit = mapRepository.getCampaignAudit(selectedRecommendation.stages.map((stage) => stage.slug));
    if (!audit.ready) {
      setError('Esta ruta no tiene un mapa continuo verificado. Vuelve a solicitar recomendaciones.');
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
        <View accessibilityLiveRegion="polite" accessibilityState={{ busy: true }} style={styles.transitionPanel}>
          <ActivityIndicator size="large" color="#F4B321" accessibilityLabel="Preparando recomendaciones" />
          <Text style={styles.transitionTitle}>{planningPhase === 'preparing' ? 'Buscando rutas para ti...' : 'Consultando al planificador IA...'}</Text>
          <Text style={styles.transitionText}>{planningPhase === 'preparing' ? 'Comprobando etapas y presupuesto.' : 'Preparando tus recomendaciones personalizadas.'}</Text>
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
    if (step === 'requirements') {
      return <TextInput accessibilityLabel="Requisitos personales" value={draft.additionalRequirements ?? ''} onChangeText={(value) => updateDraft('additionalRequirements', value)} multiline maxLength={2000} placeholder="Requisitos o preferencias personales" placeholderTextColor="#6F858C" style={[styles.input, styles.requirementsInput]} />;
    }
    return (
      <View style={styles.section}>
        {plannerSummary ? <Text style={styles.plannerSummary}>{plannerSummary}</Text> : null}
        {selectedRecommendation ? <RoutePreviewMap key={selectedRecommendation.campaign.id} recommendation={selectedRecommendation} /> : null}
        {recommendations.map((recommendation) => {
          const plannerRecommendation = plannerByCampaign.get(recommendation.campaign.id);
          const fitScore = plannerRecommendation?.fitScore ?? recommendation.fitScore;
          return (
            <Pressable key={recommendation.campaign.id} accessibilityRole="radio" accessibilityLabel={recommendation.campaign.title} accessibilityState={{ selected: selectedCampaignId === recommendation.campaign.id }} style={[styles.campaignCard, selectedCampaignId === recommendation.campaign.id && styles.campaignCardActive]} onPress={() => selectRecommendation(recommendation)}>
              <View style={styles.campaignHeader}>
                <Text style={styles.campaignTitle}>{recommendation.campaign.title}</Text>
                <Text style={styles.score}>{Math.round(fitScore * 100)}%</Text>
              </View>
              <Text style={styles.campaignMeta}>{recommendation.totalKm} km · {recommendation.estimatedDays} dias · dificultad {recommendation.difficulty} · {recommendation.budgetEstimateEur} EUR</Text>
              {!campaignAudits.get(recommendation.campaign.id)?.ready ? <Text style={styles.risk}>Mapa incompleto · {campaignAudits.get(recommendation.campaign.id)?.verifiedCount ?? 0}/{recommendation.stages.length} etapas verificadas</Text> : null}
              <Text style={styles.rationale}>{formatCampaignRationale(recommendation, plannerRecommendation)}</Text>
            </Pressable>
          );
        })}
        {selectedMapAudit && !selectedMapAudit.ready ? <View style={styles.section}>
          <Text style={styles.risk}>Esta campana no tiene un mapa continuo verificado. Selecciona otra ruta.</Text>
          {selectedMapAudit.stages.filter((stage) => stage.status !== 'verified').map((audit) => <Text key={audit.stageSlug} style={styles.risk}>{selectedRecommendation?.stages.find((stage) => stage.slug === audit.stageSlug)?.title}: {audit.issues.map((issue) => issue.message).join(' ')}</Text>)}
          {selectedMapAudit.issues.map((issue, index) => <Text key={`${issue.code}:${index}`} style={styles.risk}>{issue.message}</Text>)}
        </View> : null}
      </View>
    );
  };

  return (
    <ScrollView ref={scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.overline}>Asistente de inicio · {stepIndex + 1}/{steps.length}</Text>
        <Text style={styles.title}>{stepTitle(visibleStep)}</Text>
        <Text style={styles.subtitle}>{stepSubtitle(visibleStep)}</Text>
      </View>

      <View style={styles.section}>{renderStep()}</View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {planning ? null : <View style={styles.navigationRow}>
        {stepIndex > 0 ? <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={goBack}><Text style={styles.secondaryButtonText}>Anterior</Text></Pressable> : null}
        {step === 'recommendations'
          ? <Pressable accessibilityRole="button" disabled={saving || !canConfirmCampaign} style={[styles.primaryButton, (saving || !canConfirmCampaign) && styles.primaryButtonDisabled]} onPress={completeOnboarding}><Text style={styles.primaryButtonText}>{saving ? 'Guardando...' : 'Empezar mi Camino'}</Text></Pressable>
          : <Pressable accessibilityRole="button" disabled={planning} style={[styles.primaryButton, planning && styles.primaryButtonDisabled]} onPress={() => void goNext()}><Text style={styles.primaryButtonText}>{planning ? 'Consultando planner...' : step === 'requirements' ? 'Ver recomendaciones' : 'Siguiente'}</Text></Pressable>}
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
    requirements: 'Tus requisitos',
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
    requirements: 'Opcional · Hasta 2000 caracteres.',
    planning: 'La IA esta leyendo el contexto completo para proponer una ruta coherente.',
    recommendations: 'Tu Camino, etapa a etapa.',
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

function RoutePreviewMap({ recommendation }: { recommendation: CampaignRecommendation }) {
  const styles = useMemo(() => createStyles(), []);
  const [expanded, setExpanded] = useState(false);
  const itinerary = useMemo(() => recommendation.stages.flatMap((stage, index): MapItineraryStage[] => {
    const geometry = mapRepository.getStageGeometry(stage.slug);
    return geometry ? [{ stageSlug: stage.slug, number: index + 1, startTown: stage.startTown, endTown: stage.endTown, distanceKm: geometry.distanceKm, coordinates: geometry.coordinates, status: index === 0 ? 'active' : 'future' }] : [];
  }), [recommendation]);
  const first = itinerary[0];

  return (
    <View style={styles.routeDetail}>
      <Text style={styles.sectionTitle}>{recommendation.route.title}</Text>
      <Text style={styles.campaignMeta}>{recommendation.stages[0]?.startTown} a {recommendation.stages.at(-1)?.endTown} · {recommendation.stages.length} etapas · {recommendation.totalKm} km</Text>
      <View style={styles.mapBox}>
        {first ? <MapCanvas presentation="planning" stageSlug={first.stageSlug} coordinates={first.coordinates} itinerary={itinerary} completed={[]} services={[]} onSelectService={() => undefined} /> : <Text style={styles.mapText}>Mapa no disponible para esta ruta.</Text>}
      </View>
      <View>
        {recommendation.stages.slice(0, expanded ? recommendation.stages.length : 8).map((stage, index) => <View key={stage.slug} style={styles.stageRow}>
          <Text style={styles.stageNumber}>{index + 1}</Text>
          <View style={{ flex: 1, gap: 3 }}><Text style={styles.reason}>{stage.startTown} a {stage.endTown}</Text><Text style={styles.stageLine}>{stage.distanceKm} km · {stage.difficulty}</Text></View>
        </View>)}
      </View>
      {recommendation.stages.length > 8 ? <Pressable accessibilityRole="button" accessibilityState={{ expanded }} style={styles.smallButton} onPress={() => setExpanded(!expanded)}><Text style={styles.smallButtonText}>{expanded ? 'Mostrar menos etapas' : `Ver las ${recommendation.stages.length} etapas`}</Text></Pressable> : null}
    </View>
  );
}

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
  content: { gap: 18, padding: 16, paddingBottom: 36, width: '100%', maxWidth: 900, alignSelf: 'center' },
  error: { color: '#F97316', fontSize: 14, fontWeight: '700' },
  header: { gap: 8, paddingTop: 12 },
  input: { backgroundColor: '#102A36', borderColor: '#25485A', borderRadius: 8, borderWidth: 1, color: '#F4F0E8', fontSize: 16, paddingHorizontal: 12, paddingVertical: 12 },
  requirementsInput: { minHeight: 160, textAlignVertical: 'top' },
  mapBox: { backgroundColor: '#071923', borderColor: '#25485A', borderRadius: 8, borderWidth: 1, height: 360, overflow: 'hidden' },
  mapText: { color: '#A9B7B7', fontSize: 13, padding: 12, textAlign: 'center' },
  navigationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  overline: { color: '#F4B321', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  plannerSummary: { backgroundColor: '#17372F', borderColor: '#25485A', borderRadius: 10, borderWidth: 1, color: '#F4F0E8', fontSize: 14, lineHeight: 20, padding: 12 },
  primaryButton: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4B321', borderRadius: 10, flex: 1, minWidth: 190, paddingHorizontal: 12, paddingVertical: 14 },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#071923', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  reason: { color: '#F4F0E8', fontSize: 13, lineHeight: 19 },
  rationale: { color: '#F4F0E8', fontSize: 14, lineHeight: 21 },
  risk: { color: '#F97316', fontSize: 13, lineHeight: 19 },
  routeDetail: { gap: 10 },
  score: { color: '#F4B321', fontSize: 16, fontWeight: '900' },
  secondaryButton: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#17372F', borderColor: '#25485A', borderRadius: 10, borderWidth: 1, flex: 1, minWidth: 100, paddingVertical: 14 },
  secondaryButtonText: { color: '#F4F0E8', fontSize: 16, fontWeight: '900' },
  section: { gap: 10 },
  sectionTitle: { color: '#F4B321', fontSize: 20, fontWeight: '900' },
  smallButton: { backgroundColor: '#17372F', borderColor: '#25485A', borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  smallButtonText: { color: '#F4F0E8', fontSize: 12, fontWeight: '900' },
  stageLine: { color: '#A9B7B7', fontSize: 12 },
  stageRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, borderBottomColor: '#25485A', borderBottomWidth: 1 },
  stageNumber: { width: 30, height: 30, lineHeight: 30, textAlign: 'center', borderRadius: 5, backgroundColor: '#17372F', color: '#F4B321', fontSize: 14, fontWeight: '800', overflow: 'hidden' },
  subtitle: { color: '#A9B7B7', fontSize: 15, lineHeight: 22 },
  title: { color: '#F4F0E8', fontSize: 30, fontWeight: '900' },
  transitionPanel: { backgroundColor: '#102A36', borderColor: '#25485A', borderRadius: 12, borderWidth: 1, gap: 10, padding: 18 },
  transitionText: { color: '#A9B7B7', fontSize: 14, lineHeight: 20 },
  transitionTitle: { color: '#F4B321', fontSize: 18, fontWeight: '900' },
});
