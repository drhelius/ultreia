import { StatusBar } from 'expo-status-bar';

import { AppProviders } from './AppProviders';
import { RootExperience } from './RootExperience';

export function AppRoot() {
  return (
    <AppProviders>
      <StatusBar style="light" />
      <RootExperience />
    </AppProviders>
  );
}
