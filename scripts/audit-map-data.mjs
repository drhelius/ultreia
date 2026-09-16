import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { mapAuditPolicy } = require('/tmp/ultreia-data-validate/src/domain/tracking/mapAudit');
const { mapRepository } = require('/tmp/ultreia-data-validate/src/data/camino/mapRepository');
const { stagesTable, cyclingStagesTable, routesTable, campaignTemplatesTable } = require('/tmp/ultreia-data-validate/src/data/camino/tables');
const data = require('../src/data/camino/mapData.json');
const stages = [...stagesTable.items, ...cyclingStagesTable.items];
const audits = new Map(stages.map((stage) => [stage.slug, mapRepository.getStageAudit(stage.slug)]));
const getAudit = (slug) => mapRepository.getStageAudit(slug);
const report = {
  generatedAt: new Date().toISOString(), dataGeneratedAt: data.generatedAt, policy: mapAuditPolicy,
  summary: { total: stages.length, ...Object.fromEntries(['verified', 'review', 'missing'].map((status) => [status, [...audits.values()].filter((audit) => audit.status === status).length])) },
  routes: routesTable.items.map((route) => ({ routeSlug: route.slug, title: route.title, ...Object.fromEntries(['verified', 'review', 'missing'].map((status) => [status, stages.filter((stage) => stage.routeSlug === route.slug && getAudit(stage.slug).status === status).length])) })),
  campaigns: campaignTemplatesTable.items.map((campaign) => ({ id: campaign.id, title: campaign.title, ...mapRepository.getCampaignAudit(campaign.stageSlugs) })),
  stages: stages.map((stage) => ({ title: stage.title, routeSlug: stage.routeSlug, ...getAudit(stage.slug) })),
};
await writeFile('docs/specs/02-live/map-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ summary: report.summary, routes: report.routes, campaigns: report.campaigns.map(({ title, ready, verifiedCount, totalCount, issues }) => ({ title, ready, verifiedCount, totalCount, issues })) }, null, 2));
if (process.argv.includes('--strict') && (report.summary.missing || report.summary.review || report.campaigns.some((campaign) => !campaign.ready))) process.exitCode = 1;