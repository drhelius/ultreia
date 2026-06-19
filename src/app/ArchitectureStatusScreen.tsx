import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { appConfig } from '../core';
import { staticCaminoDataRepository } from '../data/camino';
import { useLocalPersistence } from '../persistence';
import { StatusPill, Surface } from '../ui/components';
import { type AppTheme, useAppTheme } from '../ui/theme';

const architectureCards = [
  {
    title: 'Core',
    body: 'Tipos transversales, Result, Evidence, clock, ids y config preparados para las siguientes fases.',
  },
  {
    title: 'Repositorios',
    body: 'La UI consumira datos y estado mediante interfaces, sin leer JSON ni llamar servicios externos directamente.',
  },
  {
    title: 'Persistencia',
    body: 'La base local queda modelada para usuario, viaje activo, tracking, diario y ciclos del motor de decision.',
  },
  {
    title: 'Datos',
    body: 'El data pack local ya esta conectado mediante StaticCaminoDataRepository.',
  },
] as const;

type DataPackSummary = {
  routeCount: number;
  campaignCount: number;
  sarriaMatches: number;
};

export function ArchitectureStatusScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const persistence = useLocalPersistence();
  const [summary, setSummary] = useState<DataPackSummary>();

  useEffect(() => {
    let mounted = true;

    const loadDataPackSummary = async () => {
      const [routes, campaigns, searchResults] = await Promise.all([
        staticCaminoDataRepository.getRoutes(),
        staticCaminoDataRepository.getCampaignTemplates(),
        staticCaminoDataRepository.searchByText('Sarria'),
      ]);

      if (mounted) {
        setSummary({ routeCount: routes.length, campaignCount: campaigns.length, sarriaMatches: searchResults.length });
      }
    };

    void loadDataPackSummary();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <StatusPill label="FASE 2" />
          <Text style={styles.title}>{appConfig.appName}</Text>
          <Text style={styles.subtitle}>Data pack local conectado a repositorios estaticos.</Text>
        </View>

        <Surface style={styles.policyCard}>
          <Text style={styles.sectionTitle}>Regla de datos</Text>
          <Text style={styles.bodyText}>
            No hay datos falsos de negocio en runtime. El contenido de Camino vendra del data pack local; los eventos vendran de sensores,
            calculos, input de usuario o externos realtime permitidos.
          </Text>
        </Surface>

        <View style={styles.grid}>
          {architectureCards.map((card) => (
            <Surface key={card.title} style={styles.card}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardBody}>{card.body}</Text>
            </Surface>
          ))}
        </View>

        <Surface style={styles.dataCard}>
          <Text style={styles.sectionTitle}>Data pack local</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{summary?.routeCount ?? '-'}</Text>
              <Text style={styles.metricLabel}>Rutas</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{summary?.campaignCount ?? '-'}</Text>
              <Text style={styles.metricLabel}>Campanas</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{summary?.sarriaMatches ?? '-'}</Text>
              <Text style={styles.metricLabel}>Busqueda Sarria</Text>
            </View>
          </View>
          <Text style={styles.bodyText}>Las coordenadas quedan pendientes salvo que una fuente trazable las aporte.</Text>
        </Surface>

        <Surface style={styles.dataCard}>
          <Text style={styles.sectionTitle}>Persistencia local</Text>
          <Text style={styles.bodyText}>
            {persistence.ready
              ? `SQLite inicializado. Schema local v${persistence.schemaVersion ?? '-'} con repositorios de usuario, viaje, tracking, decisiones, diario, gastos y progresion.`
              : persistence.error
                ? `Error inicializando SQLite: ${persistence.error}`
                : 'Inicializando SQLite local...'}
          </Text>
        </Surface>

        <Surface style={styles.nextCard}>
          <Text style={styles.sectionTitle}>Siguiente fase</Text>
          <Text style={styles.bodyText}>Onboarding y planificador usando data pack, persistencia local y ranking determinista.</Text>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    bodyText: {
      color: theme.colors.textMuted,
      fontSize: theme.typography.body,
      lineHeight: 22,
    },
    card: {
      gap: theme.spacing.sm,
    },
    cardBody: {
      color: theme.colors.textMuted,
      fontSize: theme.typography.small,
      lineHeight: 20,
    },
    cardTitle: {
      color: theme.colors.text,
      fontSize: 17,
      fontWeight: '800',
    },
    content: {
      gap: theme.spacing.lg,
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl,
    },
    dataCard: {
      backgroundColor: theme.colors.surface,
    },
    grid: {
      gap: theme.spacing.md,
    },
    header: {
      gap: theme.spacing.md,
      paddingTop: theme.spacing.md,
    },
    metricBox: {
      backgroundColor: theme.colors.background,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      flex: 1,
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
    },
    metricLabel: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    metricsRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    metricValue: {
      color: theme.colors.gold,
      fontSize: 24,
      fontWeight: '900',
    },
    nextCard: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    policyCard: {
      backgroundColor: theme.colors.surface,
    },
    safeArea: {
      backgroundColor: theme.colors.background,
      flex: 1,
    },
    sectionTitle: {
      color: theme.colors.gold,
      fontSize: theme.typography.heading,
      fontWeight: '800',
      marginBottom: theme.spacing.sm,
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: theme.typography.body,
      lineHeight: 22,
    },
    title: {
      color: theme.colors.text,
      fontSize: theme.typography.title,
      fontWeight: '900',
    },
  });
