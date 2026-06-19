import type { CaminoDataTable } from '../../../domain';
export type CampaignTemplateData = { id: string; title: string; routeSlug: string; stageSlugs: string[]; recommendedDays: number };

export const campaignTemplatesTable: CaminoDataTable<CampaignTemplateData> = {
  "schemaVersion": "1.0",
  "generatedAt": "2026-06-18T00:00:00.000Z",
  "dataPackVersion": "2026.06.18-phase2",
  "items": [
    {
      "id": "campaign:clasica-frances-sarria",
      "title": "Campana clasica: Sarria a Santiago",
      "routeSlug": "camino-frances",
      "stageSlugs": [
        "etapa-de-sarria-a-portomarin",
        "etapa-de-portomarin-a-palas-de-rei",
        "etapa-de-palas-de-rei-a-arzua",
        "etapa-de-arzua-a-pedrouzo",
        "etapa-de-pedrouzo-a-santiago-de-compostela"
      ],
      "recommendedDays": 5
    },
    {
      "id": "campaign:verde-portugues-tui",
      "title": "Campana verde: Camino Portugues desde Tui",
      "routeSlug": "camino-portugues",
      "stageSlugs": [
        "etapa-de-tui-a-o-porrino",
        "etapa-de-o-porrino-a-redondela",
        "etapa-de-redondela-a-pontevedra",
        "etapa-de-pontevedra-a-caldas-de-reis",
        "etapa-de-caldas-de-reis-a-padron",
        "etapa-de-padron-a-santiago-de-compostela"
      ],
      "recommendedDays": 6
    },
    {
      "id": "campaign:breve-ingles-ferrol",
      "title": "Campana breve: Camino Ingles desde Ferrol",
      "routeSlug": "camino-ingles",
      "stageSlugs": [
        "etapa-de-ferrol-a-neda",
        "etapa-de-neda-a-pontedeume",
        "etapa-de-pontedeume-a-betanzos",
        "etapa-de-betanzos-a-hospital-de-bruma",
        "etapa-de-hospital-de-bruma-a-sigueiro",
        "etapa-de-sigueiro-a-santiago-de-compostela"
      ],
      "recommendedDays": 6
    },
    {
      "id": "campaign:salvaje-primitivo",
      "title": "Campana salvaje: Camino Primitivo",
      "routeSlug": "camino-primitivo",
      "stageSlugs": [
        "etapa-de-oviedo-a-san-juan-de-villapanada",
        "etapa-de-san-juan-de-villapanada-a-salas",
        "etapa-de-salas-a-tineo",
        "etapa-de-tineo-a-pola-de-allande",
        "etapa-de-pola-de-allande-a-la-mesa",
        "etapa-de-la-mesa-a-grandas-de-salime",
        "etapa-de-grandas-de-salime-a-fonsagrada",
        "etapa-de-a-fonsagrada-padron-a-o-cadavo-baleira",
        "etapa-de-cadavo-baleira-a-lugo",
        "etapa-de-lugo-a-san-romao-da-retorta",
        "etapa-de-san-romao-da-retorta-a-melide",
        "etapa-de-melide-a-o-pedrouzo",
        "etapa-de-o-pedrouzo-a-santiago-de-compostela"
      ],
      "recommendedDays": 13
    },
    {
      "id": "campaign:final-fisterra-muxia",
      "title": "Campana final: Santiago a Fisterra/Muxia",
      "routeSlug": "epilogo-a-fisterra-y-muxia",
      "stageSlugs": [
        "etapa-de-santiago-de-compostela-a-negreira",
        "etapa-de-negreira-a-olveiroa",
        "etapa-de-olveiroa-a-fisterra",
        "etapa-de-olveiroa-a-muxia",
        "etapa-de-fisterra-muxia-a-muxia-fisterra"
      ],
      "recommendedDays": 5
    },
    {
      "id": "campaign:epica-frances-completo",
      "title": "Campana epica: Camino Frances completo",
      "routeSlug": "camino-frances",
      "stageSlugs": [
        "etapa-de-saint-jean-pied-de-port-a-roncesvalles",
        "etapa-de-roncesvalles-a-zubiri",
        "etapa-de-zubiri-a-pamplona-iruna",
        "etapa-de-pamplona-iruna-a-puente-la-reina-gares",
        "etapa-de-puente-la-reina-gares-a-estella-lizarra",
        "etapa-de-estella-lizarra-a-torres-del-rio",
        "etapa-de-torres-del-rio-a-logrono",
        "etapa-de-logrono-a-najera",
        "etapa-de-najera-a-sto-domingo-de-la-calzada",
        "etapa-de-sto-domingo-de-la-calzada-a-belorado",
        "etapa-de-belorado-a-ages",
        "etapa-de-ages-a-burgos",
        "etapa-de-burgos-a-hontanas",
        "etapa-de-hontanas-a-boadilla-del-camino",
        "etapa-de-boadilla-del-camino-a-carrion-de-los-condes",
        "etapa-de-carrion-de-los-condes-a-terradillos-de-los-templarios",
        "etapa-de-terradillos-de-los-templarios-a-el-burgo-ranero",
        "etapa-de-el-burgo-ranero-a-leon",
        "etapa-de-leon-a-san-martin-del-camino",
        "etapa-de-san-martin-del-camino-a-astorga",
        "etapa-de-astorga-a-foncebadon",
        "etapa-de-foncebadon-a-ponferrada",
        "etapa-de-ponferrada-a-villafranca-del-bierzo",
        "etapa-de-villafranca-del-bierzo-a-o-cebreiro",
        "etapa-de-o-cebreiro-a-triacastela",
        "etapa-de-triacastela-a-sarria",
        "etapa-de-sarria-a-portomarin",
        "etapa-de-portomarin-a-palas-de-rei",
        "etapa-de-palas-de-rei-a-arzua",
        "etapa-de-arzua-a-pedrouzo",
        "etapa-de-pedrouzo-a-santiago-de-compostela"
      ],
      "recommendedDays": 31
    }
  ]
};
