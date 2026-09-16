import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { AssistantChatState } from './useAssistantChat';

type AssistantChatPanelProps = {
  state: AssistantChatState;
  onSend: (message: string) => void;
  onClear: () => void;
};

export function AssistantChatPanel({ state, onSend, onClear }: AssistantChatPanelProps) {
  const [message, setMessage] = useState('');

  const send = () => {
    const trimmed = message.trim();
    if (!trimmed || state.sending || state.clearing) return;
    onSend(trimmed);
    setMessage('');
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Asistente Ultreia</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Limpiar chat" disabled={state.clearing} onPress={() => { setMessage(''); onClear(); }}>
          <Text style={styles.clear}>{state.clearing ? 'Limpiando...' : 'Limpiar'}</Text>
        </Pressable>
      </View>
      <View style={styles.messages}>
        {state.messages.length === 0 ? <Text style={styles.empty}>Pregunta por servicios cercanos, etapa activa, agua, alojamiento o decisiones del dia.</Text> : null}
        {state.messages.map((item) => (
          <View key={item.id} style={[styles.message, item.role === 'user' ? styles.userMessage : styles.assistantMessage]}>
            <Text style={styles.messageRole}>{item.role === 'user' ? 'Tu' : 'Ultreia'}</Text>
            <Text style={styles.messageBody}>{item.body}</Text>
          </View>
        ))}
      </View>
      {state.error ? <Text style={[styles.empty, { color: '#F37968' }]}>{state.error}</Text> : null}
      <View style={styles.inputRow}>
        <TextInput accessibilityLabel="Mensaje al asistente" editable={!state.clearing} value={message} onChangeText={setMessage} placeholder="Que necesitas saber?" placeholderTextColor="#6F858C" style={styles.input} />
        <Pressable accessibilityRole="button" accessibilityLabel="Enviar mensaje" style={styles.sendButton} onPress={send} disabled={state.sending || state.clearing || !message.trim()}>
          <Text style={styles.sendButtonText}>{state.sending ? '...' : 'Enviar'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  assistantMessage: {
    backgroundColor: '#17372F',
  },
  card: {
    backgroundColor: '#102A36',
    borderColor: '#25485A',
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  clear: {
    color: '#A9B7B7',
    fontSize: 13,
    fontWeight: '700',
  },
  empty: {
    color: '#A9B7B7',
    fontSize: 13,
    lineHeight: 19,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  input: {
    backgroundColor: '#071923',
    borderColor: '#25485A',
    borderRadius: 8,
    borderWidth: 1,
    color: '#F4F0E8',
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  message: {
    borderRadius: 10,
    gap: 4,
    padding: 10,
  },
  messageBody: {
    color: '#F4F0E8',
    fontSize: 13,
    lineHeight: 19,
  },
  messageRole: {
    color: '#F4B321',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  messages: {
    gap: 8,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#F4B321',
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  sendButtonText: {
    color: '#071923',
    fontWeight: '900',
  },
  title: {
    color: '#F4B321',
    fontSize: 18,
    fontWeight: '900',
  },
  userMessage: {
    backgroundColor: '#1B3442',
  },
});
