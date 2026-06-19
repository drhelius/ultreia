import { cyclingStagesTable, hostelsTable, monumentsTable, routesTable, servicesTable, stagePointsTable, stageSectionsTable, stagesTable, townsTable } from './tables';

export type CaminoDataValidationIssue = {
  table: string;
  id?: string;
  message: string;
};

const findDuplicates = (values: string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }

    seen.add(value);
  }

  return [...duplicates];
};

const addDuplicateIssues = (issues: CaminoDataValidationIssue[], table: string, field: string, values: string[]) => {
  for (const duplicate of findDuplicates(values)) {
    issues.push({ table, id: duplicate, message: `Duplicate ${field}` });
  }
};

export const validateCaminoDataPack = (): CaminoDataValidationIssue[] => {
  const issues: CaminoDataValidationIssue[] = [];
  const routeSlugs = new Set(routesTable.items.map((route) => route.slug));
  const walkingStageSlugs = new Set(stagesTable.items.map((stage) => stage.slug));
  const allStageSlugs = new Set([...stagesTable.items, ...cyclingStagesTable.items].map((stage) => stage.slug));

  addDuplicateIssues(issues, 'routes', 'slug', routesTable.items.map((route) => route.slug));
  addDuplicateIssues(issues, 'stages', 'slug', stagesTable.items.map((stage) => stage.slug));
  addDuplicateIssues(issues, 'cyclingStages', 'slug', cyclingStagesTable.items.map((stage) => stage.slug));
  addDuplicateIssues(issues, 'hostels', 'id', hostelsTable.items.map((hostel) => hostel.id));
  addDuplicateIssues(issues, 'monuments', 'id', monumentsTable.items.map((monument) => monument.id));
  addDuplicateIssues(issues, 'services', 'id', servicesTable.items.map((service) => service.id));
  addDuplicateIssues(issues, 'towns', 'slug', townsTable.items.map((town) => town.slug));

  for (const stage of [...stagesTable.items, ...cyclingStagesTable.items]) {
    if (!routeSlugs.has(stage.routeSlug)) {
      issues.push({ table: 'stages', id: stage.id, message: `Unknown routeSlug ${stage.routeSlug}` });
    }
    if (stage.distanceKm < 0 || Number.isNaN(stage.distanceKm)) {
      issues.push({ table: 'stages', id: stage.id, message: 'Invalid distanceKm' });
    }
    if (!stage.contentStatus) {
      issues.push({ table: 'stages', id: stage.id, message: 'Missing contentStatus' });
    }
  }

  for (const sections of stageSectionsTable.items) {
    if (!walkingStageSlugs.has(sections.stageSlug)) {
      issues.push({ table: 'stageSections', id: sections.stageSlug, message: 'Unknown stageSlug' });
    }
  }

  for (const town of townsTable.items) {
    for (const routeSlug of town.routeSlugs) {
      if (!routeSlugs.has(routeSlug)) {
        issues.push({ table: 'towns', id: town.id, message: `Unknown routeSlug ${routeSlug}` });
      }
    }
    for (const stageSlug of town.stageSlugs) {
      if (!allStageSlugs.has(stageSlug)) {
        issues.push({ table: 'towns', id: town.id, message: `Unknown stageSlug ${stageSlug}` });
      }
    }
    if (town.coordinate && (town.coordinateStatus !== 'verified' || !town.geocoding)) {
      issues.push({ table: 'towns', id: town.id, message: 'Coordinates require verified coordinateStatus' });
    }
  }

  for (const point of stagePointsTable.items) {
    if (!walkingStageSlugs.has(point.stageSlug)) {
      issues.push({ table: 'stagePoints', id: point.id, message: 'Unknown stageSlug' });
    }
    if (point.coordinate && (point.coordinateStatus !== 'verified' || !point.geocoding)) {
      issues.push({ table: 'stagePoints', id: point.id, message: 'Coordinates require verified coordinateStatus' });
    }
  }

  for (const hostel of hostelsTable.items) {
    if (!routeSlugs.has(hostel.routeSlug)) {
      issues.push({ table: 'hostels', id: hostel.id, message: 'Unknown routeSlug' });
    }
    if (hostel.stageSlug && !allStageSlugs.has(hostel.stageSlug)) {
      issues.push({ table: 'hostels', id: hostel.id, message: 'Unknown stageSlug' });
    }
    if (hostel.coordinate && (hostel.coordinateStatus !== 'verified' || !hostel.geocoding)) {
      issues.push({ table: 'hostels', id: hostel.id, message: 'Coordinates require verified coordinateStatus' });
    }
  }

  for (const monument of monumentsTable.items) {
    if (!routeSlugs.has(monument.routeSlug)) {
      issues.push({ table: 'monuments', id: monument.id, message: 'Unknown routeSlug' });
    }
    if (monument.stageSlug && !allStageSlugs.has(monument.stageSlug)) {
      issues.push({ table: 'monuments', id: monument.id, message: 'Unknown stageSlug' });
    }
    if (monument.coordinate && (monument.coordinateStatus !== 'verified' || !monument.geocoding)) {
      issues.push({ table: 'monuments', id: monument.id, message: 'Coordinates require verified coordinateStatus' });
    }
  }

  for (const service of servicesTable.items) {
    if (service.routeSlug && !routeSlugs.has(service.routeSlug)) {
      issues.push({ table: 'services', id: service.id, message: 'Unknown routeSlug' });
    }
    if (service.stageSlug && !allStageSlugs.has(service.stageSlug)) {
      issues.push({ table: 'services', id: service.id, message: 'Unknown stageSlug' });
    }
    if (service.coordinate && (service.coordinateStatus !== 'verified' || !service.geocoding)) {
      issues.push({ table: 'services', id: service.id, message: 'Coordinates require verified coordinateStatus' });
    }
  }

  return issues;
};
