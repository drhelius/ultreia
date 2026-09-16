import assets from '../../data/camino/mapAssets.json';
import type { Coordinates } from '../../core';
import type { CaminoService } from '../../domain';

export type MapItineraryStage = {
  stageSlug: string;
  number: number;
  startTown: string;
  endTown: string;
  distanceKm: number;
  coordinates: [number, number][];
  status: 'completed' | 'active' | 'future';
};

export type MapCanvasProps = {
  presentation?: 'live' | 'planning';
  stageSlug: string;
  coordinates: [number, number][];
  completed: [number, number][];
  position?: Coordinates;
  services: CaminoService[];
  itinerary: MapItineraryStage[];
  onSelectService: (id: string) => void;
};

export const mapDocument = `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${assets.css}
html,body,#map{height:100%;width:100%;margin:0;background:#132923} .leaflet-container{font-family:Helvetica,sans-serif;background:#132923}
.dark-map .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.88) contrast(.85)}
.leaflet-bar a{background:#102a36;color:#f4f0e8;border-color:#32515c;width:38px;height:38px;line-height:38px}
.leaflet-control-attribution{background:rgba(7,25,35,.9)!important;color:#c2cdca;font-size:9px}.leaflet-control-attribution a{color:#f4b321}
.leaflet-tooltip{background:#102a36;border:1px solid #32515c;color:#fff;box-shadow:none}.pin{border:2px solid white;border-radius:50%;box-shadow:0 1px 5px #0008;box-sizing:border-box}
.walker{width:18px;height:18px;background:#fff;border:5px solid #f4b321;border-radius:50%;box-shadow:0 0 0 8px #f4b32140,0 2px 8px #000}
.cluster{border:2px solid #f4b321;background:#102a36;color:#fff;border-radius:50%;text-align:center;font:bold 12px/30px Helvetica;box-sizing:border-box;box-shadow:0 2px 6px #0005}
.stage-marker{display:grid;place-items:center;background:transparent;border:0;box-shadow:none}
.stage-number{display:grid;place-items:center;width:30px;height:30px;box-sizing:border-box;border:2px solid #b7c7c6;border-radius:5px;background:#16313a;color:#f4f0e8;font:bold 14px Helvetica;box-shadow:0 2px 6px #0009}
.stage-marker.active .stage-number{background:#f4b321;border-color:#ffe09a;color:#071923}
.stage-marker.completed .stage-number{background:#235d47;border-color:#58c894;color:#ecfff5}
.stage-marker.planned .stage-number{background:#f4b321;border-color:#ffe09a;color:#071923}
.stage-marker:focus-visible .stage-number{outline:3px solid white;outline-offset:3px}
.stage-name{font-weight:700;font-size:11px;padding:4px 7px;width:max-content;max-width:140px;white-space:normal;line-height:16px;text-align:center}
.stage-group{display:grid;place-items:center;box-sizing:border-box;background:#16313a;border:2px solid #b7c7c6;border-radius:5px;color:#f4f0e8;font:bold 12px Helvetica;box-shadow:3px 3px 0 #071923,4px 4px 0 #b7c7c6}.stage-group.active{background:#f4b321;border-color:#ffe09a;color:#071923}.stage-group.completed{background:#235d47;border-color:#58c894}
.stage-group.planned{background:#f4b321;border-color:#ffe09a;color:#071923;box-shadow:3px 3px 0 #071923,4px 4px 0 #f4b321}
.leaflet-popup-content-wrapper,.leaflet-popup-tip{background:#102a36;color:#f4f0e8}.leaflet-popup-content{width:210px!important;max-width:calc(100vw - 100px);margin:14px;font-size:13px;line-height:1.5}.leaflet-popup-content strong{display:block;color:#f4b321;font-size:15px;margin-bottom:5px}.leaflet-popup-content button{width:100%;font-size:13px;margin-top:10px;font-weight:bold}
#legend{position:absolute;left:10px;bottom:24px;z-index:700;display:flex;gap:10px;background:#071923eb;border:1px solid #32515c;border-radius:5px;padding:6px 8px;color:#e8efeb;font:10px Helvetica;pointer-events:none}#legend span{display:flex;align-items:center;gap:4px}#legend i{width:8px;height:8px;border-radius:2px;display:inline-block}
.planning-map #legend,.planning-map #follow{display:none}
#tools{position:absolute;right:12px;top:12px;z-index:800;display:flex;gap:8px}button{background:#102a36;color:#f4f0e8;border:1px solid #47606a;border-radius:6px;width:42px;height:42px;font-size:22px;cursor:pointer}
#offline{position:absolute;bottom:62px;left:10px;right:10px;z-index:800;background:#102a36;color:#fff;padding:7px 10px;font:12px Helvetica;border-radius:4px;display:none}
</style></head><body><div id="map" aria-label="Mapa del Camino de Santiago"></div><div id="tools"><button id="campaign" title="Ver Camino completo" aria-label="Ver Camino completo">&#8756;</button><button id="fit" title="Ver etapa completa" aria-label="Ver etapa completa">&#9635;</button><button id="follow" title="Centrar peregrino" aria-label="Centrar peregrino">&#8982;</button><button id="theme" title="Cambiar mapa base" aria-label="Cambiar mapa base">&#9680;</button></div><div id="legend"><span><i style="background:#58c894"></i>Completada</span><span><i style="background:#f4b321"></i>Actual</span><span><i style="background:#b7c7c6"></i>Proxima</span></div><div id="offline">Mapa base sin conexion. Ruta y servicios disponibles.</div><script>${assets.javascript.replace(/<\/script/gi, '<\\/script')}</script><script>
const map=L.map('map',{zoomControl:true,attributionControl:true,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false}).setView([42.8,-7.8],10);
const backgrounds=['https://tile.openstreetmap.org/{z}/{x}/{y}.png','https://tile.openstreetmap.org/{z}/{x}/{y}.png','https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'];
let theme=0,stage='',following=false,viewMode='campaign',currentPosition,base,previewBounds,planningPreview=false;
function tileLayer(){document.body.classList.toggle('dark-map',theme===0);if(base)map.removeLayer(base);base=L.tileLayer(backgrounds[theme],{maxZoom:theme===2?17:19,attribution:'&copy; OpenStreetMap contributors'+(theme===2?' | OpenTopoMap (CC-BY-SA)':'')}).addTo(map);base.on('tileerror',()=>document.getElementById('offline').style.display='block');base.on('tileload',()=>document.getElementById('offline').style.display='none');}
tileLayer();
const outline=L.polyline([],{color:'#071923',weight:9,opacity:.9}).addTo(map);
const route=L.polyline([],{color:'#f4b321',weight:5,opacity:1}).addTo(map);
const walked=L.polyline([],{color:'#58c894',weight:6,opacity:1}).addTo(map);
const context=L.featureGroup().addTo(map);
const pins=L.markerClusterGroup({animate:false,maxClusterRadius:35,disableClusteringAtZoom:16,showCoverageOnHover:false,iconCreateFunction:cluster=>L.divIcon({className:'cluster',html:String(cluster.getChildCount()),iconSize:[34,34]})}).addTo(map);
const ends=L.markerClusterGroup({animate:false,maxClusterRadius:28,disableClusteringAtZoom:12,showCoverageOnHover:false,spiderfyOnMaxZoom:true,iconCreateFunction:cluster=>{const markers=cluster.getAllChildMarkers();const numbers=markers.map(marker=>marker.options.stageNumber).sort((left,right)=>left-right);const status=planningPreview?'planned':markers.some(marker=>marker.options.stageStatus==='active')?'active':markers.every(marker=>marker.options.stageStatus==='completed')?'completed':'future';return L.divIcon({className:'stage-group '+status,html:numbers[0]+'-'+numbers[numbers.length-1],iconSize:[44,34]});}}).addTo(map);
const originLayer=L.layerGroup().addTo(map);
const walker=L.marker([42.8,-7.8],{icon:L.divIcon({className:'',html:'<div class="walker"></div>',iconSize:[28,28],iconAnchor:[14,14]}),zIndexOffset:1000});
const colors={albergue:'#8562ac',fuente:'#288bcd',farmacia:'#38a46c',centro_salud:'#38a46c',restaurante:'#db7847',bar:'#db7847',monumento:'#c69b35',supermercado:'#458980'};
const stageStatus={completed:'Completada',active:'Etapa actual',future:'Proxima etapa'};
const send=payload=>{const text=JSON.stringify(payload);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(text);else window.parent.postMessage(payload,'*');};
function fit(){if(route.getLatLngs().length)map.fitBounds(route.getBounds(),{padding:[36,70],maxZoom:15,animate:false});}
function fitCampaign(){const bounds=L.latLngBounds(route.getLatLngs());if(context.getLayers().length)bounds.extend(context.getBounds());if(bounds.isValid())map.fitBounds(bounds,{paddingTopLeft:[44,75],paddingBottomRight:[44,65],maxZoom:15,animate:false});}
document.getElementById('fit').onclick=()=>{following=false;viewMode='stage';fit();};
document.getElementById('campaign').onclick=()=>{following=false;viewMode='campaign';fitCampaign();};
document.getElementById('follow').onclick=()=>{following=true;if(currentPosition)map.setView(currentPosition,15);};
document.getElementById('theme').onclick=()=>{theme=(theme+1)%backgrounds.length;tileLayer();};
map.on('dragstart',()=>{following=false;viewMode='free';});
let serviceKey='';
let itineraryKey='';
let destinationMarkers=[];
function updateDestinationNames(){
 const occupied=[];
 const ordered=planningPreview?destinationMarkers:[...destinationMarkers].sort((left,right)=>Number(right.item.status==='active')-Number(left.item.status==='active'));
 for(const entry of ordered){
  if(!map.hasLayer(entry.marker)){entry.marker.closeTooltip();continue;}
  const location=map.latLngToContainerPoint(entry.marker.getLatLng());
  const width=Math.min(144,entry.item.endTown.length*7+20);
  const rect={left:location.x-width/2,right:location.x+width/2,top:location.y+22,bottom:location.y+68};
  const inside=rect.left>8&&rect.right<map.getSize().x-8&&rect.top>64&&rect.bottom<map.getSize().y-52;
  const clear=!occupied.some(other=>rect.left<other.right+6&&rect.right>other.left-6&&rect.top<other.bottom+4&&rect.bottom>other.top-4);
  if(inside&&clear){entry.marker.openTooltip();occupied.push(rect);}else entry.marker.closeTooltip();
 }
}
map.on('zoomend moveend',updateDestinationNames);
function drawItinerary(items){
 context.clearLayers();ends.clearLayers();originLayer.clearLayers();destinationMarkers=[];
 for(const item of items){
  const points=item.coordinates.map(coordinate=>[coordinate[1],coordinate[0]]);
  if(!points.length)continue;
  if(item.stageSlug!==stage){
   if(planningPreview)L.polyline(points,{color:'#071923',weight:9,opacity:.9}).addTo(context);
   L.polyline(points,{color:planningPreview?'#f4b321':item.status==='completed'?'#58c894':'#94a9b1',weight:planningPreview?5:4,opacity:planningPreview?1:item.status==='completed'?.85:.7,dashArray:planningPreview||item.status==='completed'?undefined:'7 5'}).addTo(context);
  }
  const number=document.createElement('span');number.className='stage-number';number.textContent=String(item.number);
  const label='Etapa '+item.number+': '+item.endTown+(planningPreview?'':' · '+stageStatus[item.status]);
  const marker=L.marker(points[points.length-1],{icon:L.divIcon({className:'stage-marker '+(planningPreview?'planned':item.status),html:number,iconSize:[44,44],iconAnchor:[22,22]}),title:label,alt:label,stageNumber:item.number,stageStatus:item.status,zIndexOffset:!planningPreview&&item.status==='active'?1800:1400}).addTo(ends);
  marker.on('add',()=>marker.getElement()?.setAttribute('aria-label',label));
  marker.getElement()?.setAttribute('aria-label',label);
  const town=document.createElement('span');town.textContent=item.endTown;
  marker.bindTooltip(town,{direction:'bottom',offset:[0,19],permanent:true,className:'stage-name',opacity:1});
  const detail=document.createElement('div');const title=document.createElement('strong');title.textContent='Etapa '+item.number+' · '+item.endTown;detail.append(title);
  const section=document.createElement('div');section.textContent=item.startTown+' a '+item.endTown;detail.append(section);
  const meta=document.createElement('div');meta.textContent=item.distanceKm.toFixed(1)+' km'+(planningPreview?'':' · '+stageStatus[item.status]);detail.append(meta);
  const show=document.createElement('button');show.type='button';show.textContent='Ver esta etapa';show.onclick=()=>{following=false;viewMode='preview';previewBounds=L.latLngBounds(points);map.closePopup();map.fitBounds(previewBounds,{padding:[44,70],maxZoom:15,animate:false});};detail.append(show);
  marker.bindPopup(detail,{maxWidth:230,autoPanPadding:[35,70]});destinationMarkers.push({marker,item});
 }
 if(items.length&&items[0].coordinates.length){const start=items[0].coordinates[0];const origin=L.circleMarker([start[1],start[0]],{radius:6,color:planningPreview?'#f4b321':'#f4f0e8',weight:2,fillColor:'#102a36',fillOpacity:1}).addTo(originLayer);const label=document.createElement('span');label.textContent='Inicio · '+items[0].startTown;origin.bindTooltip(label);}
 outline.bringToFront();route.bringToFront();walked.bringToFront();updateDestinationNames();
}
window.updateCamino=function(data){
 if(!data||data.kind!=='camino-map')return;
 const changedPresentation=planningPreview!==(data.presentation==='planning');
 planningPreview=data.presentation==='planning';
 document.body.classList.toggle('planning-map',planningPreview);
 const latlngs=data.coordinates.map(coordinate=>[coordinate[1],coordinate[0]]);
 route.setLatLngs(latlngs);outline.setLatLngs(latlngs);walked.setLatLngs(planningPreview?[]:data.completed.map(coordinate=>[coordinate[1],coordinate[0]]));
 const changedStage=stage!==data.stageSlug;
 if(changedStage){stage=data.stageSlug;following=false;viewMode='campaign';}
 const nextItineraryKey=JSON.stringify(data.itinerary.map(item=>[item.stageSlug,item.number,item.status,item.endTown,item.distanceKm]));
 const changedItinerary=nextItineraryKey!==itineraryKey;
 if(changedStage||changedItinerary||changedPresentation){itineraryKey=nextItineraryKey;drawItinerary(data.itinerary);if(viewMode==='campaign')fitCampaign();}
 if(data.position&&!planningPreview){currentPosition=[data.position.latitude,data.position.longitude];walker.setLatLng(currentPosition).addTo(map);if(following)map.panTo(currentPosition,{animate:true});}else{map.removeLayer(walker);currentPosition=undefined;}
 const nextKey=data.services.map(service=>service.id).join('|');
 if(nextKey!==serviceKey){serviceKey=nextKey;pins.clearLayers();data.services.forEach(service=>{if(!service.coordinate)return;const label=document.createElement('span');label.textContent=service.title;L.marker([service.coordinate.latitude,service.coordinate.longitude],{icon:L.divIcon({className:'',html:'<div class="pin" style="width:14px;height:14px;background:'+(colors[service.type]||'#829a9c')+'"></div>',iconSize:[14,14],iconAnchor:[7,7]})}).bindTooltip(label).on('click',()=>send({kind:'select-service',id:service.id})).addTo(pins);});}
};
window.addEventListener('message',event=>{try{window.updateCamino(typeof event.data==='string'?JSON.parse(event.data):event.data);}catch{}});
new ResizeObserver(()=>{map.invalidateSize();if(!following){if(viewMode==='campaign')fitCampaign();else if(viewMode==='stage')fit();else if(viewMode==='preview'&&previewBounds)map.fitBounds(previewBounds,{padding:[44,70],maxZoom:15,animate:false});}updateDestinationNames();}).observe(document.getElementById('map'));
send({kind:'map-ready'});
</script></body></html>`;