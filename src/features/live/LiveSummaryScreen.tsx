import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bell, MessageCircle, ShieldAlert, X, Award, CheckCircle2 } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

import { staticCaminoDataRepository } from '../../data/camino';
import type { ActiveJourney, CampaignPlan, CaminoRoute, CaminoStage, CaminoService, UserProfile } from '../../domain';
import { Button } from '../../ui/components';
import { EngagementPanel, useEngagement } from '../engagement';
import { useDecisionEngine, useLiveTracking } from '../live-map';
import { AssistantChatPanel, useAssistantChat } from '../ai-chat';
import { LiveTabs, useLiveTabState } from './LiveTabs';
import { DiaryProfileView } from './views/DiaryProfileView';
import { DiscoverView } from './views/DiscoverView';
import { MapTrackingView } from './views/MapTrackingView';
import { MyCaminoView } from './views/MyCaminoView';
import { ServiceDetail } from './views/ServiceDetail';
import { SafetyPanel } from './views/SafetyPanel';
import { liveStyles as shared, liveColors as colors } from './liveStyles';

type LiveSummaryScreenProps = {
  profile: UserProfile;
  journey: ActiveJourney;
  campaign: CampaignPlan;
  onReset: () => Promise<void>;
};

export function LiveSummaryScreen({ profile, journey: initialJourney, campaign, onReset }: LiveSummaryScreenProps) {
  const [journey, setJourney] = useState(initialJourney);
  const [selectedService, setSelectedService] = useState<CaminoService>();
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [credentialOpen, setCredentialOpen] = useState(false);
  const [panel, setPanel] = useState<'avisos' | 'asistente' | 'seguridad'>();
  const [toast, setToast] = useState<string>();
  const previousNotice = useRef<string | undefined>(undefined);
  const previousXp = useRef<number | undefined>(undefined);
  const [route, setRoute] = useState<CaminoRoute>();
  const [activeStage, setActiveStage] = useState<CaminoStage>();
  const [resetting, setResetting] = useState(false);
  const tracking = useLiveTracking(journey);
  const decisionEngine = useDecisionEngine({ profile, journey, campaign, trackingState: tracking.state });
  const engagement = useEngagement({ profile, journey, campaign, trackingState: tracking.state, onJourneyChanged: setJourney });
  const chat = useAssistantChat({ profile, journey, campaign, trackingState: tracking.state, decisionState: decisionEngine.state });
  const [activeTab, setActiveTab] = useLiveTabState();
  const styles = useMemo(() => createStyles(), []);
  const notifications = decisionEngine.state.history ?? [];
  const lastNotice = decisionEngine.state.lastCycle?.recommendations[0];
  const position = tracking.state.currentLocation;

  useEffect(() => {
    if (lastNotice && previousNotice.current !== lastNotice.id) {
      previousNotice.current = lastNotice.id;
      setToast(`${lastNotice.origin === 'foundry' ? 'IA · ' : ''}${lastNotice.title}`);
    }
  }, [lastNotice?.id]);

  useEffect(() => {
    const xp = engagement.state.progression?.lifetimeXp;
    if (xp === undefined) return;
    if (previousXp.current !== undefined && xp > previousXp.current) setToast(`+${xp - previousXp.current} XP · ${engagement.state.progression?.unlockedAchievementIds.includes('achievement:primera-etapa') ? 'Tu Camino sigue creciendo' : 'Objetivo completado'}`);
    previousXp.current = xp;
  }, [engagement.state.progression?.lifetimeXp]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(undefined), 8000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      const [nextRoute, nextStage] = await Promise.all([
        staticCaminoDataRepository.getRoute(journey.routeSlug),
        journey.activeStageSlug ? staticCaminoDataRepository.getStage(journey.activeStageSlug) : Promise.resolve(undefined),
      ]);

      if (mounted) {
        setRoute(nextRoute);
        setActiveStage(nextStage);
      }
    };

    void loadData();

    return () => {
      mounted = false;
    };
  }, [journey.activeStageSlug, journey.routeSlug]);

  const reset = async () => {
    setResetting(true);
    await onReset();
    setResetting(false);
  };

  const renderTab = () => {
    if (activeTab === 'mi-camino') {
      return <MyCaminoView profile={profile} journey={journey} campaign={campaign} route={route} activeStage={activeStage} tracking={tracking.state} engagement={engagement.state} onMap={() => setActiveTab('mapa')} onCredential={() => setCredentialOpen(true)} onCompleteQuest={(id) => void engagement.completeQuest(id)} />;
    }
    if (activeTab === 'mapa') {
      return (
        <MapTrackingView
          activeStage={activeStage}
          tracking={tracking.state}
          decision={decisionEngine.state}
          onStart={tracking.startTracking}
          onPause={tracking.pauseTracking}
          onResume={tracking.resumeTracking}
          onComplete={() => { void tracking.pauseTracking(); setConfirmComplete(true); }}
          onRecordSample={tracking.recordLocationSample}
          onRunDecision={decisionEngine.runDirectorCycle}
          onMarkDecisionShown={decisionEngine.markShown}
          onStartSimulation={tracking.startSimulation}
          onAdvanceSimulation={tracking.advanceSimulation}
          simulationSpeed={tracking.simulationSpeed}
          onSimulationSpeed={tracking.setSimulationSpeed}
          onSelectService={setSelectedService}
          journeyCompleted={journey.status === 'completed'}
          campaign={campaign}
          completedStageSlugs={engagement.state.stageProgress?.filter((item) => item.state === 'completada').map((item) => item.stageSlug) ?? []}
        />
      );
    }
    if (activeTab === 'descubrir') {
      return <DiscoverView stageSlug={journey.activeStageSlug} position={position} onSelectService={setSelectedService} />;
    }
    if (activeTab === 'diario' || activeTab === 'perfil') {
      return <DiaryProfileView mode={activeTab} profile={profile} campaign={campaign} engagement={engagement.state} chat={chat.state} onSendChat={chat.sendMessage} onClearChat={chat.clear} onReset={reset} onSaveJournal={engagement.saveJournal} onSaveExpense={engagement.saveExpense} onDeleteExpense={engagement.deleteExpense} onCredential={() => setCredentialOpen(true)} />;
    }
    return null;
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}><Text style={styles.overline}>ULTREIA{journey.id.startsWith('demo:') ? ' · DEMO' : ''}</Text><Text style={styles.title}>{activeTab === 'mi-camino' ? 'Mi Camino' : activeTab === 'mapa' ? 'Mapa' : activeTab === 'descubrir' ? 'Descubrir' : activeTab === 'diario' ? 'Diario' : 'Perfil'}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Avisos (${notifications.length})`} style={shared.icon} onPress={() => setPanel('avisos')}><Bell size={22} color={colors.gold} />{notifications.length ? <Text style={{ color: colors.text, fontSize: 10, position: 'absolute', top: 1, right: 3 }}>{notifications.length}</Text> : null}</Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Asistente" style={shared.icon} onPress={() => setPanel('asistente')}><MessageCircle size={22} color={colors.text} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="SOS y seguridad" style={[shared.icon, { backgroundColor: '#682A2A' }]} onPress={() => setPanel('seguridad')}><ShieldAlert size={23} color="#FFDAD0" /></Pressable>
      </View>
      {toast ? <Pressable accessibilityRole="button" accessibilityLabel="Abrir ultimo aviso" accessibilityLiveRegion="polite" onPress={() => setPanel('avisos')} style={{ backgroundColor: '#17372F', paddingVertical: 10, paddingHorizontal: 18, flexDirection: 'row', gap: 10 }}><Award size={20} color={colors.gold} /><Text style={[shared.text, { flex: 1 }]}>{toast}</Text></Pressable> : null}
      <ScrollView contentContainerStyle={styles.content}>
        {engagement.state.error ? <Text style={shared.error}>{engagement.state.error}</Text> : null}
        {renderTab()}
        {resetting ? <Text style={styles.subtitle}>Reiniciando configuracion...</Text> : null}
      </ScrollView>
      <LiveTabs activeTab={activeTab} onChange={setActiveTab} />
      <Modal visible={confirmComplete} transparent animationType="none" onRequestClose={() => setConfirmComplete(false)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0009' }}><View style={{ backgroundColor: '#102A36', borderRadius: 8, padding: 22, gap: 16 }}>
          <Text style={styles.title}>Cerrar etapa</Text>
          <Text style={styles.subtitle}>Se guardaran {tracking.state.completedDistanceKm.toFixed(1)} km, tu progreso y el borrador del diario.{tracking.state.progressPercent < 95 ? ' El recorrido registrado aun no llega al final; confirma solo si has terminado la etapa.' : ''}</Text>
          <Button onPress={() => { setConfirmComplete(false); void engagement.completeActiveStage(); }}>Confirmar cierre</Button>
          <Button variant="secondary" onPress={() => setConfirmComplete(false)}>Volver</Button>
        </View></View>
      </Modal>
      <Modal visible={Boolean(selectedService)} transparent onRequestClose={() => setSelectedService(undefined)}>
        <View style={styles.backdrop}><View style={styles.modal}><ScrollView>{selectedService ? <ServiceDetail service={selectedService} onClose={() => setSelectedService(undefined)} /> : null}</ScrollView></View></View>
      </Modal>
      <Modal visible={Boolean(panel) || credentialOpen} transparent animationType="none" onRequestClose={() => { setPanel(undefined); setCredentialOpen(false); }}>
        <View style={styles.backdrop}><View style={styles.modal}><ScrollView contentContainerStyle={shared.section}>
          <View style={shared.between}><Text style={shared.heading}>{credentialOpen ? 'Credencial digital' : panel === 'avisos' ? 'Avisos del Camino' : panel === 'asistente' ? 'Tu acompanante' : 'SOS y seguridad'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Cerrar panel" style={shared.icon} onPress={() => { setPanel(undefined); setCredentialOpen(false); }}><X size={22} color={colors.text} /></Pressable></View>
          {panel === 'asistente' ? <AssistantChatPanel state={chat.state} onSend={chat.sendMessage} onClear={chat.clear} /> : null}
          {panel === 'avisos' ? <>{decisionEngine.state.directorRunning ? <Text style={shared.muted}>El motor IA esta preparando recomendaciones...</Text> : null}{decisionEngine.state.directorError ? <Text style={shared.error}>{decisionEngine.state.directorError}</Text> : null}{notifications.length === 0 ? <Text style={shared.muted}>No hay avisos nuevos.</Text> : null}{[...notifications].reverse().map((notice) => <View key={notice.id} style={shared.item}><Text style={shared.heading}>{notice.origin === 'foundry' ? 'IA · ' : ''}{notice.title}</Text><Text style={shared.text}>{notice.message}</Text><Text style={shared.muted}>{notice.origin === 'foundry' ? 'Foundry · ' : 'Reglas locales · '}{notice.evidence.some((item) => item.simulated) ? 'Simulacion · ' : ''}{notice.createdAtIso ? new Date(notice.createdAtIso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}</Text><Button variant="secondary" onPress={() => { setPanel(undefined); setActiveTab(notice.type === 'tracking' ? 'mapa' : 'descubrir'); }}>{notice.actionLabel || 'Ver detalle'}</Button></View>)}</> : null}
          {panel === 'seguridad' ? <SafetyPanel journey={journey} profile={profile} position={position} simulated={tracking.state.session?.mode === 'simulation' || journey.id.startsWith('demo:')} onSelectService={(service) => { setPanel(undefined); setSelectedService(service); }} onReportSaved={() => void engagement.refresh()} /> : null}
          {credentialOpen ? <>
            <Text style={shared.title}>{profile.displayName}</Text><Text style={shared.text}>{route?.title}</Text>
            <View style={{ alignSelf: 'center', padding: 14, backgroundColor: 'white' }}><QRCode size={170} value={JSON.stringify({ app: 'Ultreia', journey: journey.id, name: profile.displayName, route: campaign.routeSlug, local: true })} /></View>
            <Text style={shared.muted}>Registro digital local. No sustituye a la credencial oficial ni acredita la Compostela.</Text>
            {campaign.stageSlugs.map((slug, index) => { const progress = engagement.state.stageProgress?.find((item) => item.stageSlug === slug); return <View key={slug} style={[shared.item, shared.row]}><CheckCircle2 color={progress?.state === 'completada' ? colors.gold : colors.border} size={32} /><View style={{ flex: 1 }}><Text style={shared.text}>Etapa {index + 1} · {progress?.state === 'completada' ? 'Completada' : 'Pendiente'}</Text><Text style={shared.muted}>{progress?.completedAtIso ? new Date(progress.completedAtIso).toLocaleDateString('es-ES') : ''}{progress?.evidence?.simulated ? ' · Simulacion' : ''}</Text></View></View>; })}
          </> : null}
        </ScrollView></View></View>
      </Modal>
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  content: {
    paddingBottom: 24,
  },
  header: {
    gap: 8, padding: 14, flexDirection: 'row', alignItems: 'center', borderBottomColor: '#25485A', borderBottomWidth: 1,
  },
  overline: {
    color: '#F4B321',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  root: {
    flex: 1, width: '100%', maxWidth: 1100, alignSelf: 'center',
  },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 18, backgroundColor: '#000B' },
  modal: { backgroundColor: '#102A36', borderRadius: 8, width: '100%', maxWidth: 600, maxHeight: '90%' },
  subtitle: {
    color: '#A9B7B7',
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    color: '#F4F0E8',
    fontSize: 23,
    fontWeight: '800',
  },
});
