import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Transport = 'Walk' | 'Bike' | 'Car';
type Interest = 'Nature' | 'Religious' | 'Cultural' | 'Monuments' | 'Hiking';
type PoiType = 'Food' | 'Rest' | 'Supplies' | 'Health' | 'Landmark';

type RoutePlan = {
  id: string;
  title: string;
  start: string;
  durationDays: number;
  transport: Transport;
  scenery: Interest[];
  stages: string[];
  vibe: string;
  dailyKm: number;
};

type Poi = {
  id: string;
  name: string;
  type: PoiType;
  distanceKm: number;
  reward: string;
};

type Quest = {
  id: string;
  title: string;
  progress: string;
};

const interests: Interest[] = ['Nature', 'Religious', 'Cultural', 'Monuments', 'Hiking'];
const transports: Transport[] = ['Walk', 'Bike', 'Car'];

const mockRoutes: RoutePlan[] = [
  {
    id: 'frances',
    title: 'Hero’s Trail · Camino Francés',
    start: 'Sarria',
    durationDays: 6,
    transport: 'Walk',
    scenery: ['Religious', 'Cultural', 'Monuments'],
    stages: ['Sarria', 'Portomarín', 'Palas de Rei', 'Arzúa', 'O Pedrouzo', 'Santiago'],
    vibe: 'Balanced pilgrimage with legendary towns and easy daily rhythm.',
    dailyKm: 19,
  },
  {
    id: 'portugues',
    title: 'Forest Echo · Camino Portugués',
    start: 'Tui',
    durationDays: 5,
    transport: 'Walk',
    scenery: ['Nature', 'Cultural', 'Hiking'],
    stages: ['Tui', 'O Porriño', 'Pontevedra', 'Caldas', 'Padrón', 'Santiago'],
    vibe: 'Green valleys, stone bridges, and food-focused villages.',
    dailyKm: 22,
  },
  {
    id: 'ebike',
    title: 'Wind Waker · E-Bike Norte Highlights',
    start: 'Ribadeo',
    durationDays: 4,
    transport: 'Bike',
    scenery: ['Nature', 'Monuments', 'Hiking'],
    stages: ['Ribadeo', 'Mondoñedo', 'Vilalba', 'Sobrado', 'Santiago'],
    vibe: 'Fast exploration with mountain views and dramatic monuments.',
    dailyKm: 42,
  },
  {
    id: 'roadtrip',
    title: 'Pilgrim Caravan · Road Quest',
    start: 'Ponferrada',
    durationDays: 3,
    transport: 'Car',
    scenery: ['Cultural', 'Monuments', 'Religious'],
    stages: ['Ponferrada', 'O Cebreiro', 'Portomarín', 'Santiago'],
    vibe: 'A flexible prototype for mixed sightseeing and short walks.',
    dailyKm: 78,
  },
];

const poiDatabase: Record<string, Poi[]> = {
  frances: [
    { id: 'f1', name: 'Portomarín Tavern', type: 'Food', distanceKm: 0.4, reward: 'Warm meal buff' },
    { id: 'f2', name: 'Romanesque Bridge View', type: 'Landmark', distanceKm: 0.7, reward: 'Photo quest' },
    { id: 'f3', name: 'Farmacia do Camiño', type: 'Health', distanceKm: 1.2, reward: 'Restock kit' },
  ],
  portugues: [
    { id: 'p1', name: 'River Garden Café', type: 'Food', distanceKm: 0.3, reward: 'Hydration bonus' },
    { id: 'p2', name: 'Ancient Oak Shrine', type: 'Landmark', distanceKm: 0.8, reward: 'Nature stamp' },
    { id: 'p3', name: 'Local Market', type: 'Supplies', distanceKm: 1.5, reward: 'Trail snacks' },
  ],
  ebike: [
    { id: 'e1', name: 'Mirador del Norte', type: 'Landmark', distanceKm: 0.5, reward: 'Skyline selfie' },
    { id: 'e2', name: 'Bike Repair Shelter', type: 'Rest', distanceKm: 0.9, reward: 'Chain repair' },
    { id: 'e3', name: 'Village Bakery', type: 'Food', distanceKm: 1.4, reward: 'Energy pastry' },
  ],
  roadtrip: [
    { id: 'r1', name: 'Castillo Stop', type: 'Landmark', distanceKm: 0.6, reward: 'Castle memory' },
    { id: 'r2', name: 'Pilgrim Grocery', type: 'Supplies', distanceKm: 0.9, reward: 'Snack cache' },
    { id: 'r3', name: 'Urgent Care Point', type: 'Health', distanceKm: 1.1, reward: 'Safety check' },
  ],
};

const questDatabase: Quest[] = [
  { id: 'q1', title: 'Stamp Hunter', progress: '4 / 8 shrines photographed' },
  { id: 'q2', title: 'Kindness Route', progress: '2 / 3 local recommendations followed' },
  { id: 'q3', title: 'Santiago Sprint', progress: '68% of today’s stage completed' },
];

const scoreRoute = (route: RoutePlan, durationDays: number, transport: Transport, picks: Interest[]) => {
  const durationScore = Math.max(0, 5 - Math.abs(route.durationDays - durationDays));
  const transportScore = route.transport === transport ? 6 : 0;
  const interestScore = picks.filter((interest) => route.scenery.includes(interest)).length * 3;

  return durationScore + transportScore + interestScore;
};

export default function App() {
  const [activeView, setActiveView] = useState<'planner' | 'journey'>('planner');
  const [transport, setTransport] = useState<Transport>('Walk');
  const [durationDays, setDurationDays] = useState(5);
  const [selectedInterests, setSelectedInterests] = useState<Interest[]>(['Nature', 'Cultural']);
  const [selectedRouteId, setSelectedRouteId] = useState('portugues');
  const [progressKm, setProgressKm] = useState(14);
  const [deviationKm, setDeviationKm] = useState(0.3);
  const [lastReroute, setLastReroute] = useState('AI suggests a forest detour with a bakery reward.');

  const rankedRoutes = useMemo<RoutePlan[]>(() => {
    return [...mockRoutes].sort(
      (a, b) =>
        scoreRoute(b, durationDays, transport, selectedInterests) -
        scoreRoute(a, durationDays, transport, selectedInterests),
    );
  }, [durationDays, selectedInterests, transport]);

  const selectedRoute = useMemo<RoutePlan>(() => {
    return rankedRoutes.find((route: RoutePlan) => route.id === selectedRouteId) ?? rankedRoutes[0] ?? mockRoutes[0];
  }, [rankedRoutes, selectedRouteId]);

  const pois = poiDatabase[selectedRoute.id] ?? [];
  const highlightPoi = pois.find((poi) => poi.type === 'Landmark') ?? pois[0];
  const totalDistanceKm = selectedRoute.dailyKm * selectedRoute.durationDays;
  const completion = Math.min(100, Math.round((progressKm / totalDistanceKm) * 100));

  const toggleInterest = (interest: Interest) => {
    setSelectedInterests((current: Interest[]) => {
      if (current.includes(interest)) {
        return current.length === 1 ? current : current.filter((entry: Interest) => entry !== interest);
      }

      return [...current, interest];
    });
  };

  const chooseRoute = (routeId: string) => {
    setSelectedRouteId(routeId);
    setProgressKm(12);
    setDeviationKm(0.2);
    setLastReroute('Journey prepared. Offline map tiles and live guidance are ready.');
    setActiveView('journey');
  };

  const advanceJourney = () => {
    setProgressKm((current: number) => Math.min(totalDistanceKm, current + Math.round(selectedRoute.dailyKm / 2)));
    setDeviationKm((current: number) => Math.max(0, Number((current - 0.1).toFixed(1))));
  };

  const rerouteToPoi = (poi: Poi) => {
    setDeviationKm(Number((poi.distanceKm / 2).toFixed(1)));
    setLastReroute(`Rerouted through ${poi.name}. Reward unlocked: ${poi.reward}.`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroCard}>
          <Text style={styles.overline}>ULTREIA · Prototype</Text>
          <Text style={styles.title}>Camino like a living quest.</Text>
          <Text style={styles.subtitle}>
            Plan your pilgrimage, track progress offscreen, discover POIs, and earn game-style rewards.
          </Text>
        </View>

        <View style={styles.tabRow}>
          <TabButton
            active={activeView === 'planner'}
            label="Journey planner"
            onPress={() => setActiveView('planner')}
          />
          <TabButton
            active={activeView === 'journey'}
            label="Live adventure"
            onPress={() => setActiveView('journey')}
          />
        </View>

        {activeView === 'planner' ? (
          <View style={styles.sectionCard}>
            <SectionHeading title="Plan your legend" caption="Mocked route generation based on your preferences." />

            <Text style={styles.label}>Travel style</Text>
            <View style={styles.optionRow}>
              {transports.map((item) => (
                <Chip
                  key={item}
                  label={item}
                  active={transport === item}
                  onPress={() => setTransport(item)}
                />
              ))}
            </View>

            <Text style={styles.label}>Ideal duration</Text>
            <View style={styles.optionRow}>
              {[3, 4, 5, 6, 7].map((days) => (
                <Chip
                  key={days}
                  label={`${days} days`}
                  active={durationDays === days}
                  onPress={() => setDurationDays(days)}
                />
              ))}
            </View>

            <Text style={styles.label}>Adventure focus</Text>
            <View style={styles.optionRow}>
              {interests.map((interest) => (
                <Chip
                  key={interest}
                  label={interest}
                  active={selectedInterests.includes(interest)}
                  onPress={() => toggleInterest(interest)}
                />
              ))}
            </View>

            <SectionHeading title="Suggested starts and stages" caption="Fake database entries ranked like an RPG quest board." />
            {rankedRoutes.map((route: RoutePlan, index: number) => (
              <Pressable key={route.id} onPress={() => chooseRoute(route.id)} style={styles.routeCard}>
                <View style={styles.routeHeader}>
                  <Text style={styles.routeRank}>#{index + 1}</Text>
                  <View style={styles.routeTitleWrap}>
                    <Text style={styles.routeTitle}>{route.title}</Text>
                    <Text style={styles.routeMeta}>
                      Start at {route.start} · {route.durationDays} days · {route.transport}
                    </Text>
                  </View>
                </View>
                <Text style={styles.routeVibe}>{route.vibe}</Text>
                <Text style={styles.routeStages}>{route.stages.join(' → ')}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.sectionCard}>
            <SectionHeading title="Live adventure dashboard" caption="Background tracking, POIs, photos, offline maps, and AI are mocked in-app." />

            <View style={styles.metricGrid}>
              <MetricCard label="Current stage" value={`${selectedRoute.stages[1]} → ${selectedRoute.stages[2]}`} />
              <MetricCard label="Journey progress" value={`${completion}%`} />
              <MetricCard label="Route deviation" value={`${deviationKm.toFixed(1)} km`} />
              <MetricCard label="Map cache" value="12 zones saved" />
            </View>

            <View style={styles.mapCard}>
              <Text style={styles.mapTitle}>Map and tracking</Text>
              <Text style={styles.mapBody}>
                Online map tiles are cached offline for weak-signal areas. Offscreen tracking is armed to keep day
                progress updated while the app is closed.
              </Text>
              <Text style={styles.progressLine}>You are {progressKm} km into a {totalDistanceKm} km planned journey.</Text>
              <Pressable style={styles.primaryButton} onPress={advanceJourney}>
                <Text style={styles.primaryButtonText}>Advance half a stage</Text>
              </Pressable>
            </View>

            <View style={styles.aiCard}>
              <Text style={styles.aiTitle}>Foundry companion</Text>
              <Text style={styles.aiBody}>
                {`"${lastReroute}"`} This mocked AI layer can later be replaced by Microsoft Foundry agents.
              </Text>
            </View>

            <SectionHeading title="Useful nearby places" caption="Tap a POI to regenerate the track around food, rest, supplies, or health needs." />
            {pois.map((poi) => (
              <Pressable key={poi.id} onPress={() => rerouteToPoi(poi)} style={styles.poiCard}>
                <View>
                  <Text style={styles.poiName}>{poi.name}</Text>
                  <Text style={styles.poiMeta}>
                    {poi.type} · {poi.distanceKm.toFixed(1)} km away · {poi.reward}
                  </Text>
                </View>
                <Text style={styles.poiAction}>Reroute</Text>
              </Pressable>
            ))}

            <SectionHeading title="Quests and rewards" caption="Gamification keeps the prototype feeling like an adventure game." />
            {questDatabase.map((quest) => (
              <View key={quest.id} style={styles.questCard}>
                <Text style={styles.questTitle}>{quest.title}</Text>
                <Text style={styles.questProgress}>{quest.progress}</Text>
              </View>
            ))}

            <View style={styles.photoCard}>
              <Text style={styles.photoTitle}>Photo quest</Text>
              <Text style={styles.photoBody}>
                You are close to {highlightPoi?.name ?? 'the next landmark'}. Suggest taking a picture in-app and sharing it to Instagram for
                a memory shard reward.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type TabButtonProps = {
  active: boolean;
  label: string;
  onPress: () => void;
};

function TabButton({ active, label, onPress }: TabButtonProps) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

type ChipProps = {
  active: boolean;
  label: string;
  onPress: () => void;
};

function Chip({ active, label, onPress }: ChipProps) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

type SectionHeadingProps = {
  title: string;
  caption: string;
};

function SectionHeading({ title, caption }: SectionHeadingProps) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCaption}>{caption}</Text>
    </View>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
};

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#08141f',
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 36,
  },
  heroCard: {
    backgroundColor: '#0f2532',
    borderColor: '#1f4859',
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
    padding: 20,
  },
  overline: {
    color: '#78d8b0',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: '#f4ecd0',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#d4e2e8',
    fontSize: 15,
    lineHeight: 22,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  tabButton: {
    backgroundColor: '#112534',
    borderRadius: 999,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tabButtonActive: {
    backgroundColor: '#d6b85a',
  },
  tabLabel: {
    color: '#d3e2e8',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#10212c',
  },
  sectionCard: {
    backgroundColor: '#0d1d2b',
    borderRadius: 24,
    padding: 18,
  },
  sectionHeading: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#f8e8b5',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionCaption: {
    color: '#a8bfcb',
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    color: '#edf5f8',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 8,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    backgroundColor: '#173344',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: '#78d8b0',
  },
  chipLabel: {
    color: '#d9eef5',
    fontSize: 13,
    fontWeight: '700',
  },
  chipLabelActive: {
    color: '#0c202b',
  },
  routeCard: {
    backgroundColor: '#13293a',
    borderColor: '#204860',
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  routeHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  routeRank: {
    color: '#78d8b0',
    fontSize: 22,
    fontWeight: '900',
    marginRight: 12,
  },
  routeTitleWrap: {
    flex: 1,
  },
  routeTitle: {
    color: '#f4ecd0',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  routeMeta: {
    color: '#9dc0cf',
    fontSize: 13,
  },
  routeVibe: {
    color: '#d7e6ed',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  routeStages: {
    color: '#f8d97f',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    backgroundColor: '#13293a',
    borderRadius: 18,
    minWidth: '47%',
    padding: 14,
  },
  metricLabel: {
    color: '#9dc0cf',
    fontSize: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#f4ecd0',
    fontSize: 20,
    fontWeight: '800',
  },
  mapCard: {
    backgroundColor: '#143449',
    borderRadius: 20,
    marginBottom: 16,
    padding: 16,
  },
  mapTitle: {
    color: '#f8e8b5',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  mapBody: {
    color: '#d7e6ed',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  progressLine: {
    color: '#78d8b0',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#d6b85a',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#10212c',
    fontSize: 14,
    fontWeight: '800',
  },
  aiCard: {
    backgroundColor: '#231d3a',
    borderRadius: 20,
    marginBottom: 16,
    padding: 16,
  },
  aiTitle: {
    color: '#d8c7ff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  aiBody: {
    color: '#ece6ff',
    fontSize: 14,
    lineHeight: 20,
  },
  poiCard: {
    alignItems: 'center',
    backgroundColor: '#13293a',
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    padding: 14,
  },
  poiName: {
    color: '#f4ecd0',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  poiMeta: {
    color: '#bad1db',
    fontSize: 13,
  },
  poiAction: {
    color: '#78d8b0',
    fontSize: 13,
    fontWeight: '800',
  },
  questCard: {
    backgroundColor: '#173344',
    borderRadius: 18,
    marginBottom: 10,
    padding: 14,
  },
  questTitle: {
    color: '#f8e8b5',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  questProgress: {
    color: '#d7e6ed',
    fontSize: 14,
  },
  photoCard: {
    backgroundColor: '#2d2140',
    borderRadius: 20,
    padding: 16,
  },
  photoTitle: {
    color: '#ffd6e9',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  photoBody: {
    color: '#fff0f6',
    fontSize: 14,
    lineHeight: 20,
  },
});
