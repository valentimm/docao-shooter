// Helper compartilhado (sem Three.js) para popular `map.boxes` de mapas GLB a partir do JSON de colisão.
export function setGlbBoxes(map, raw) {
  if (!map || !Array.isArray(raw) || (map.boxes && map.boxes.length)) return map;
  map.boxes = raw.map((b) => ({ b }));
  return map;
}
