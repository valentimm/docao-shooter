// Wrapper de compatibilidade: a lógica genérica de mapas GLB agora vive em glb-maps.js.
import { getMap } from './maps.js';
import { BREEZE_ID } from './breeze-data.js';
import { prepareGlbMap, glbMapReady, buildGlbWorld, glbThumbs } from './glb-maps.js';

glbThumbs();
export const breezeMap = getMap(BREEZE_ID);
export const prepareBreezeMap = () => prepareGlbMap(BREEZE_ID);
export const breezeMapReady = () => glbMapReady(BREEZE_ID);
export const buildBreezeWorld = () => buildGlbWorld(BREEZE_ID);
