import { useState } from 'react';
import { Pressable, Share, Text, TextInput, View } from 'react-native';
import { Trash2, BookOpen, Wallet } from 'lucide-react-native';

import type { CampaignPlan, ExpenseCategory, JournalEntry, UserProfile } from '../../../domain';
import { Button, Chip, CredentialCard } from '../../../ui/components';
import type { EngagementState } from '../../engagement';
import { AssistantChatPanel, type AssistantChatState } from '../../ai-chat';
import { liveStyles as styles, liveColors as colors } from '../liveStyles';

type DiaryProfileViewProps = {
  profile: UserProfile;
  campaign: CampaignPlan;
  engagement: EngagementState;
  chat: AssistantChatState;
  onSendChat: (message: string) => void;
  onClearChat: () => void;
  onReset: () => void;
  mode: 'diario' | 'perfil';
  onSaveJournal: (entry: JournalEntry) => Promise<void>;
  onSaveExpense: (amount: number, note: string, category: ExpenseCategory) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
  onCredential: () => void;
};

export function DiaryProfileView({ profile, campaign, engagement, onReset, mode, onSaveJournal, onSaveExpense, onDeleteExpense, onCredential }: DiaryProfileViewProps) {
  const classLabel = profile.pilgrimClasses?.length ? profile.pilgrimClasses.join(', ') : profile.pilgrimClass;
  const modeLabel = profile.travelMode === 'bike' ? 'bici' : profile.travelMode === 'car' ? 'coche' : 'a pie';
  const [editing, setEditing] = useState<JournalEntry>();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('comida');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmReset, setConfirmReset] = useState(false);
  const entries = [...(engagement.entries ?? [])].filter((entry) => entry.status !== 'discarded').sort((left, right) => right.dateIso.localeCompare(left.dateIso));
  const expenses = [...(engagement.expenses ?? [])].sort((left, right) => right.spentAtIso.localeCompare(left.spentAtIso));
  const today = new Date().toLocaleDateString('en-CA');
  const dailySpent = expenses.filter((expense) => new Date(expense.spentAtIso).toLocaleDateString('en-CA') === today).reduce((total, expense) => total + expense.amountEur, 0);
  const run = async (action: () => Promise<void>) => { setBusy(true); setError(undefined); try { await action(); } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo guardar.'); } finally { setBusy(false); } };

  if (mode === 'diario') return <View style={styles.section}>
    <View style={styles.between}><Text style={styles.title}>Mi diario del Camino</Text><BookOpen color={colors.gold} size={26} /></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {editing ? <View style={{ gap: 12 }}>
      <TextInput accessibilityLabel="Titulo del diario" value={editing.title} onChangeText={(title) => setEditing({ ...editing, title })} style={styles.input} />
      <TextInput accessibilityLabel="Texto del diario" multiline value={editing.body} onChangeText={(body) => setEditing({ ...editing, body })} style={[styles.input, { minHeight: 200, textAlignVertical: 'top' }]} />
      <Button disabled={busy || !editing.title.trim()} onPress={() => void run(async () => { await onSaveJournal(editing); setEditing(undefined); })}>Guardar entrada</Button>
      <Button variant="secondary" onPress={() => setEditing(undefined)}>Cancelar</Button>
    </View> : null}
    {entries.length === 0 ? <Text style={styles.muted}>Todavia no hay entradas. Tu primera etapa quedara guardada aqui.</Text> : null}
    {entries.map((entry) => <View key={entry.id} style={styles.item}>
      <Text style={styles.muted}>{new Date(entry.dateIso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} · {entry.status === 'draft' ? 'Borrador' : 'Guardado'}</Text>
      <Text style={styles.heading}>{entry.title}</Text><Text style={styles.text}>{entry.body}</Text>
      <View style={styles.row}><Button variant="secondary" onPress={() => setEditing(entry)}>Editar entrada</Button><Button variant="secondary" onPress={() => void run(async () => { await Share.share({ message: `${entry.title}\n\n${entry.body}` }); })}>Compartir</Button></View>
    </View>)}
  </View>;

  return (
    <View style={styles.section}>
      <CredentialCard pilgrimName={profile.displayName} caminoTitle={campaign.title} stamps={engagement.stageProgress?.filter((item) => item.state === 'completada').length ?? 0} totalStamps={campaign.stageSlugs.length} onOpen={onCredential} />
      <View style={styles.item}>
        <Text style={styles.title}>{profile.displayName}</Text>
        <Text style={styles.text}>Clase: {classLabel}</Text>
        <Text style={styles.text}>Modo: {modeLabel}</Text>
        <Text style={styles.muted}>Ubicacion compartida: desactivada. Datos guardados en este dispositivo.</Text>
      </View>
      <View style={styles.between}><Text style={styles.title}>Presupuesto</Text><Wallet color={colors.gold} size={26} /></View>
      <Text style={styles.text}>Hoy: {dailySpent.toFixed(2)} EUR / {engagement.budget?.dailyTargetEur ?? 0} EUR estimados</Text>
      <Text style={styles.text}>Viaje: {engagement.budget?.spentTotalEur.toFixed(2) ?? '0.00'} EUR / {engagement.budget?.estimatedTotalEur ?? 0} EUR estimados</Text>
      <Text style={[styles.heading, { color: dailySpent > (engagement.budget?.dailyTargetEur ?? Infinity) ? colors.red : colors.green }]}>{((engagement.budget?.dailyTargetEur ?? 0) - dailySpent).toFixed(2)} EUR de margen hoy</Text>
      <TextInput accessibilityLabel="Importe del gasto" placeholder="Importe en EUR" placeholderTextColor={colors.muted} value={amount} keyboardType="decimal-pad" onChangeText={setAmount} style={styles.input} />
      <View style={styles.row}>{(['comida', 'alojamiento', 'extras', 'transporte', 'lavanderia', 'farmacia', 'donativo', 'monumento', 'bici'] as ExpenseCategory[]).map((id) => <Chip key={id} label={id} active={category === id} onPress={() => setCategory(id)} />)}</View>
      <TextInput accessibilityLabel="Nota del gasto" placeholder="Nota opcional" placeholderTextColor={colors.muted} value={note} onChangeText={setNote} style={styles.input} />
      <Button disabled={busy || !amount.trim()} onPress={() => void run(async () => { await onSaveExpense(Number(amount.replace(',', '.')), note.trim(), category); setAmount(''); setNote(''); })}>Registrar gasto</Button>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {expenses.map((expense) => <View key={expense.id} style={[styles.item, styles.between]}><View style={{ flex: 1 }}><Text style={styles.text}>{expense.note || expense.category}</Text><Text style={styles.muted}>{expense.category} · {new Date(expense.spentAtIso).toLocaleDateString('es-ES')}</Text></View><Text style={styles.heading}>{expense.amountEur.toFixed(2)} EUR</Text><Pressable accessibilityRole="button" accessibilityLabel={`Eliminar gasto ${expense.note || expense.category}`} style={styles.icon} onPress={() => void run(() => onDeleteExpense(expense.id))}><Trash2 size={20} color={colors.red} /></Pressable></View>)}
      <View style={styles.item}><Button variant="danger" onPress={() => setConfirmReset(!confirmReset)}>Reiniciar Camino</Button>{confirmReset ? <><Text style={styles.error}>Se borraran los datos locales, el diario y los gastos de este dispositivo.</Text><Button variant="danger" onPress={onReset}>Confirmar reinicio</Button><Button variant="secondary" onPress={() => setConfirmReset(false)}>Cancelar</Button></> : null}</View>
    </View>
  );
}
