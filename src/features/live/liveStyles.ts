import { StyleSheet } from 'react-native';
export const liveColors = { background: '#071923', surface: '#102A36', border: '#2C4B56', text: '#F4F0E8', muted: '#A9B7B7', gold: '#F4B321', green: '#58C894', red: '#F37968' };
export const liveStyles = StyleSheet.create({
  section: { gap: 14, padding: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  title: { color: liveColors.text, fontSize: 23, fontWeight: '800' },
  heading: { color: liveColors.gold, fontSize: 17, fontWeight: '800' },
  text: { color: liveColors.text, fontSize: 14, lineHeight: 21 },
  muted: { color: liveColors.muted, fontSize: 13, lineHeight: 20 },
  input: { backgroundColor: liveColors.surface, borderWidth: 1, borderColor: liveColors.border, borderRadius: 6, padding: 12, color: liveColors.text, fontSize: 15, minHeight: 46 },
  item: { borderBottomWidth: 1, borderBottomColor: liveColors.border, paddingVertical: 14, gap: 8 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: liveColors.surface },
  error: { color: liveColors.red, fontSize: 13, lineHeight: 20 },
});