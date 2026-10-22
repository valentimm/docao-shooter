// A ilustração é projetada no cenário em duas profundidades. No enquadramento
// inicial ela permanece igual; no mergulho o assoalho e a paisagem têm paralaxe.
export function makeMenuBackdrop(THREE, scene, camera) {
  const texture = new THREE.TextureLoader().load('./assets/menu/fazendinha-entardecer.webp');
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const backdropMaterial = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, depthWrite: false, side: THREE.DoubleSide });
  const groundMaterial = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), backdropMaterial);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 8, 24), groundMaterial);
  backdrop.renderOrder = -20; ground.renderOrder = -10;
  backdrop.frustumCulled = ground.frustumCulled = false;
  scene.add(backdrop, ground);
  const previousWorld = new THREE.Matrix4(), previousProjection = new THREE.Matrix4();
  const ray = new THREE.Vector3(), forward = new THREE.Vector3();
  let previousFloor = NaN;
  function projectSurface(mesh, floorY, isGround) {
    const positions = mesh.geometry.attributes.position;
    const uvs = mesh.geometry.attributes.uv;
    for (let i = 0; i < positions.count; i++) {
      const u = uvs.getX(i), v = uvs.getY(i);
      // A margem fora da tela evita mostrar uma borda durante o movimento.
      const screenX = (u * 2 - 1) * 1.5;
      const screenY = isGround ? -.59 - (1 - v) * .95 : (v * 2 - 1) * 1.5;
      ray.set(screenX, screenY, .5).unproject(camera).sub(camera.position);
      const distance = isGround ? (floorY - camera.position.y) / ray.y : 9 / ray.dot(forward);
      ray.multiplyScalar(distance).add(camera.position);
      positions.setXYZ(i, ray.x, ray.y, ray.z);
    }
    positions.needsUpdate = true;
    mesh.geometry.computeBoundingSphere();
  }
  // As UVs guardam a projeção inicial. O cenário fica ancorado no mundo
  // durante a viagem, sem acompanhar o olhar da câmera.
  for (const mesh of [backdrop, ground]) {
    const uv = mesh.geometry.attributes.uv;
    const screenUV = uv.array.slice();
    mesh.userData.screenUV = screenUV;
  }
  return {
    fit(floorY) {
      if (previousFloor === floorY && previousWorld.equals(camera.matrixWorld) && previousProjection.equals(camera.projectionMatrix)) return;
      previousWorld.copy(camera.matrixWorld); previousProjection.copy(camera.projectionMatrix); previousFloor = floorY;
      camera.getWorldDirection(forward);
      for (const mesh of [backdrop, ground]) {
        // Reutilizar a grade original em cada ajuste de enquadramento.
        mesh.geometry.attributes.uv.array.set(mesh.userData.screenUV);
        projectSurface(mesh, floorY, mesh === ground);
        const uv = mesh.geometry.attributes.uv;
        for (let i = 0; i < uv.count; i++) {
          const u = uv.getX(i), v = uv.getY(i);
          uv.setXY(i, ((u * 2 - 1) * 1.5 + 1) / 2,
            mesh === ground ? (1 - .59 - (1 - v) * .95) / 2 : ((v * 2 - 1) * 1.5 + 1) / 2);
        }
        uv.needsUpdate = true;
      }
    },
  };
}
