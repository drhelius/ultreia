import { distance, lineString, toWgs84 } from '@turf/turf';

export function extractRouteLines(node, result = []) {
  if (node.geometry?.type === 'LineString') result.push(toWgs84(lineString(node.geometry.coordinates)));
  for (const key of ['main', 'ways', 'appendices']) for (const child of node[key] ?? []) extractRouteLines(child, result);
  return result;
}

export function findNetworkGaps(graph, maxGapKm = .08) {
  const components = new Map();
  let componentId = 0;
  for (const start of Object.keys(graph.vertices)) {
    if (components.has(start)) continue;
    const queue = [start]; components.set(start, componentId);
    for (let cursor = 0; cursor < queue.length; cursor++) for (const neighbor of Object.keys(graph.vertices[queue[cursor]])) {
      if (!components.has(neighbor)) { components.set(neighbor, componentId); queue.push(neighbor); }
    }
    componentId++;
  }
  const ends = Object.keys(graph.vertices).filter((key) => Object.keys(graph.vertices[key]).length === 1);
  const gaps = [];
  for (let leftIndex = 0; leftIndex < ends.length; leftIndex++) for (const right of ends.slice(leftIndex + 1)) {
    const left = ends[leftIndex];
    if (components.get(left) === components.get(right)) continue;
    const start = graph.sourceCoordinates[left]; const end = graph.sourceCoordinates[right];
    if (Math.abs(start[0] - end[0]) > maxGapKm / 70 || Math.abs(start[1] - end[1]) > maxGapKm / 110) continue;
    const gapKm = distance(start, end);
    if (gapKm <= maxGapKm) gaps.push({ start, end, gapKm });
  }
  return { componentCount: componentId, gaps: gaps.sort((left, right) => left.gapKm - right.gapKm) };
}