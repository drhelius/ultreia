import { StyleSheet, Text, View } from 'react-native';

import type { CampaignPlan, UserProfile } from '../../../domain';
import { Button, CredentialCard, Surface } from '../../../ui/components';
import type { EngagementState } from '../../engagement';
import { AssistantChatPanel, type AssistantChatState } from '../../ai-chat';

type DiaryProfileViewProps = {
  profile: UserProfile;
  campaign: CampaignPlan;
  engagement: EngagementState;
  chat: AssistantChatState;
  onSendChat: (message: string) => void;
  onClearChat: () => void;
  onReset: () => void;
};

export function DiaryProfileView({ profile, campaign, engagement, chat, onSendChat, onClearChat, onReset }: DiaryProfileViewProps) {
  const classLabel = profile.pilgrimClasses?.length ? profile.pilgrimClasses.join(', ') : profile.pilgrimClass;
  const modeLabel = profile.travelMode === 'bike' ? 'bici' : profile.travelMode === 'car' ? 'coche' : 'a pie';

  return (
    <View style={styles.container}>
      <CredentialCard pilgrimName={profile.displayName} caminoTitle={campaign.title} stamps={engagement.progression?.unlockedAchievementIds.length ?? 0} onOpen={() => undefined} />
      <Surface>
        <Text style={styles.title}>Diario</Text>
        <Text style={styles.cardTitle}>{engagement.journalDraft?.title ?? 'Borrador pendiente'}</Text>
        <Text style={styles.text}>{engagement.journalDraft?.body ?? 'Completa una etapa para generar el diario automaticamente.'}</Text>
      </Surface>
      <AssistantChatPanel state={chat} onSend={onSendChat} onClear={onClearChat} />
      <Surface>
        <Text style={styles.title}>Perfil</Text>
        <Text style={styles.text}>Clase: {classLabel}</Text>
        <Text style={styles.text}>Modo: {modeLabel}</Text>
        <Text style={styles.text}>Presupuesto: {profile.budgetMode}</Text>
        <Button variant="danger" onPress={onReset}>Reiniciar configuracion local</Button>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: '#F4F0E8', fontSize: 16, fontWeight: '900', marginBottom: 8 },
  container: { gap: 14 },
  text: { color: '#A9B7B7', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  title: { color: '#F4B321', fontSize: 20, fontWeight: '900', marginBottom: 8 },
});
