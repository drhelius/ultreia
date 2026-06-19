import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text } from 'react-native';

import type { ActiveJourney, CampaignPlan, UserProfile } from '../domain';
import { LiveSummaryScreen } from '../features/live';
import { OnboardingFlowScreen } from '../features/onboarding';
import { useLocalPersistence } from '../persistence';
import { useAppTheme, type AppTheme } from '../ui/theme';
import { runHardeningAudit } from './hardeningAudit';

type ExperienceState =
  | { status: 'loading' }
  | { status: 'onboarding' }
  | { status: 'live'; profile: UserProfile; journey: ActiveJourney; campaign: CampaignPlan };

export function RootExperience() {
  const persistence = useLocalPersistence();
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const [state, setState] = useState<ExperienceState>({ status: 'loading' });
  const [audit] = useState(() => runHardeningAudit());

  const loadState = useCallback(async () => {
    if (!persistence.ready || !persistence.repositories) {
      setState({ status: 'loading' });
      return;
    }

    const profile = await persistence.repositories.userProfileRepository.getProfile();
    const journey = await persistence.repositories.journeyRepository.getActiveJourney();
    const campaign = journey ? await persistence.repositories.journeyRepository.getSelectedCampaign(journey.campaignId) : undefined;

    if (profile && journey && campaign) {
      setState({ status: 'live', profile, journey, campaign });
      return;
    }

    setState({ status: 'onboarding' });
  }, [persistence.ready, persistence.repositories]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const resetLocalState = async () => {
    await persistence.resetLocalState();
    setState({ status: 'onboarding' });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {!persistence.ready && state.status === 'loading' ? <Text style={styles.loadingText}>Inicializando Ultreia...</Text> : null}
      {persistence.ready && state.status === 'loading' ? <Text style={styles.loadingText}>Cargando tu Camino...</Text> : null}
      {persistence.error ? <Text style={styles.errorText}>Error local: {persistence.error}</Text> : null}
      {!audit.ok ? <Text style={styles.errorText}>Auditoria: revisar reglas de datos antes de continuar.</Text> : null}
      {persistence.ready && state.status === 'onboarding' ? <OnboardingFlowScreen onCompleted={loadState} /> : null}
      {persistence.ready && state.status === 'live' ? <LiveSummaryScreen profile={state.profile} journey={state.journey} campaign={state.campaign} onReset={resetLocalState} /> : null}
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  errorText: {
    color: theme.colors.warning,
    fontSize: 15,
    padding: theme.spacing.lg,
  },
  loadingText: {
    color: theme.colors.textMuted,
    fontSize: 16,
    padding: theme.spacing.lg,
  },
  safeArea: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
});
