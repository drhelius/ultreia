import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { staticCaminoDataRepository } from '../../data/camino';
import type { ActiveJourney, CampaignPlan, CaminoRoute, CaminoStage, UserProfile } from '../../domain';
import { EngagementPanel, useEngagement } from '../engagement';
import { useDecisionEngine, useLiveTracking } from '../live-map';
import { useAssistantChat } from '../ai-chat';
import { LiveTabs, useLiveTabState } from './LiveTabs';
import { DiaryProfileView } from './views/DiaryProfileView';
import { DiscoverView } from './views/DiscoverView';
import { MapTrackingView } from './views/MapTrackingView';
import { MyCaminoView } from './views/MyCaminoView';

type LiveSummaryScreenProps = {
  profile: UserProfile;
  journey: ActiveJourney;
  campaign: CampaignPlan;
  onReset: () => Promise<void>;
};

export function LiveSummaryScreen({ profile, journey, campaign, onReset }: LiveSummaryScreenProps) {
  const [route, setRoute] = useState<CaminoRoute>();
  const [activeStage, setActiveStage] = useState<CaminoStage>();
  const [resetting, setResetting] = useState(false);
  const tracking = useLiveTracking(journey);
  const decisionEngine = useDecisionEngine({ profile, journey, campaign, trackingState: tracking.state });
  const engagement = useEngagement({ profile, journey, campaign, trackingState: tracking.state });
  const chat = useAssistantChat({ profile, journey, campaign, trackingState: tracking.state, decisionState: decisionEngine.state });
  const [activeTab, setActiveTab] = useLiveTabState();
  const styles = useMemo(() => createStyles(), []);

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
      return <MyCaminoView profile={profile} journey={journey} campaign={campaign} route={route} activeStage={activeStage} tracking={tracking.state} engagement={engagement.state} />;
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
          onComplete={tracking.completeTracking}
          onRecordSample={tracking.recordLocationSample}
          onRunDecision={decisionEngine.runDecisionCycle}
          onMarkDecisionShown={decisionEngine.markShown}
        />
      );
    }
    if (activeTab === 'descubrir') {
      return <DiscoverView stageSlug={journey.activeStageSlug} />;
    }
    if (activeTab === 'diario' || activeTab === 'perfil') {
      return <DiaryProfileView profile={profile} campaign={campaign} engagement={engagement.state} chat={chat.state} onSendChat={chat.sendMessage} onClearChat={chat.clear} onReset={reset} />;
    }
    return <EngagementPanel state={engagement.state} onActivateQuest={engagement.activateQuest} onCompleteStage={engagement.completeActiveStage} onSaveExpense={engagement.saveExpense} />;
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.overline}>Modo live</Text>
          <Text style={styles.title}>{activeTab === 'mi-camino' ? 'Mi Camino' : activeTab === 'mapa' ? 'Mapa' : activeTab === 'descubrir' ? 'Descubrir' : activeTab === 'diario' ? 'Diario' : 'Perfil'}</Text>
          <Text style={styles.subtitle}>Tu configuracion esta persistida localmente y lista para continuar.</Text>
        </View>

        {renderTab()}
        {resetting ? <Text style={styles.subtitle}>Reiniciando configuracion...</Text> : null}
      </ScrollView>
      <LiveTabs activeTab={activeTab} onChange={setActiveTab} />
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  content: {
    gap: 16,
    padding: 16,
    paddingBottom: 36,
  },
  header: {
    gap: 8,
    paddingTop: 12,
  },
  overline: {
    color: '#F4B321',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  root: {
    flex: 1,
  },
  subtitle: {
    color: '#A9B7B7',
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    color: '#F4F0E8',
    fontSize: 30,
    fontWeight: '900',
  },
});
