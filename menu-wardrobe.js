// Mala de figurinos da vitrine: o acabamento e a inscrição recebem a luz da cena.
export function makeWardrobeCase(THREE, canvasTex) {
  const group = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({
    map: canvasTex(256, 256, (ctx) => {
      ctx.fillStyle = '#35513b'; ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#21352745'; ctx.lineWidth = 3;
      for (let i = 0; i < 22; i++) {
        const x = (i * 71) % 256, y = (i * 37) % 256;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 7, y + 2); ctx.lineTo(x + 16, y - 1); ctx.stroke();
      }
      ctx.fillStyle = '#b9b07920';
      for (let i = 0; i < 14; i++) ctx.fillRect((i * 53) % 256, (i * 79) % 256, 10 + i % 6, 2);
    }), roughness: .95,
  });
  const edging = new THREE.MeshStandardMaterial({ color: 0x63452c, roughness: .95 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb89b61, roughness: .75, metalness: .25 });
  const box = (w, h, d, x, y, z, mat, bevel = 0) => {
    let geometry;
    if (bevel) {
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2 + bevel, -h / 2 + bevel);
      shape.lineTo(w / 2 - bevel, -h / 2 + bevel);
      shape.lineTo(w / 2 - bevel, h / 2 - bevel);
      shape.lineTo(-w / 2 + bevel, h / 2 - bevel); shape.closePath();
      geometry = new THREE.ExtrudeGeometry(shape, { depth: d - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, steps: 1 });
      geometry.translate(0, 0, -d / 2 + bevel);
    } else geometry = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(x, y, z); group.add(mesh); return mesh;
  };
  // Interior oco e frente articulada na lateral, como uma mala de figurinos.
  const door = new THREE.Group(); door.position.set(-.34, .405, .10); group.add(door);
  const onDoor = (mesh) => { door.attach(mesh); return mesh; };
  box(.72, .77, .065, 0, .405, -.10, edging, .025);
  for (const x of [-.335, .335]) box(.05, .77, .22, x, .405, .015, edging);
  for (const y of [.045, .765]) box(.67, .05, .22, 0, y, .015, edging);
  box(.62, .67, .015, 0, .405, -.057, leather);
  onDoor(box(.67, .72, .095, 0, .405, .112, leather, .025));
  box(.67, .72, .07, 0, .405, -.12, leather, .025);
  for (const x of [-.265, .265]) {
    onDoor(box(.055, .70, .024, x, .405, .166, edging, .008));
    onDoor(box(.067, .075, .03, x, .706, .186, brass, .006));
    onDoor(box(.035, .037, .012, x, .71, .205, edging));
    for (const y of [.09, .72]) {
      onDoor(box(.11, .09, .09, x, y, .137, edging, .012));
      const rivet = new THREE.Mesh(new THREE.SphereGeometry(.009, 6, 4), brass);
      rivet.position.set(x, y, .188); group.add(rivet); onDoor(rivet);
    }
  }
  // Alça de mala, com vão visível e suporte dos dois lados.
  const handlePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.13, .79, 0), new THREE.Vector3(-.12, .88, 0),
    new THREE.Vector3(0, .91, 0), new THREE.Vector3(.12, .88, 0), new THREE.Vector3(.13, .79, 0),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(handlePath, 16, .023, 6, false), edging));
  for (const x of [-.13, .13]) box(.06, .035, .07, x, .79, 0, brass, .005);

  const paint = new THREE.MeshStandardMaterial({ color: 0xffedc5, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const inscription = new THREE.Mesh(new THREE.PlaneGeometry(.46, .44), paint);
  inscription.position.set(0, .415, .162); inscription.visible = false; group.add(inscription); onDoor(inscription);
  const image = new Image();
  image.onload = () => {
    paint.map = canvasTex(512, 512, (ctx) => {
      ctx.drawImage(image, 4, 213, 504, 259);
      const data = ctx.getImageData(0, 0, 512, 512);
      for (let i = 0; i < data.data.length; i += 4) {
        data.data[i + 3] *= Math.min(1, Math.max(0, (data.data[i + 1] - 95) / 65)) * .94;
        data.data[i] = data.data[i + 1] = data.data[i + 2] = 255;
      }
      ctx.putImageData(data, 0, 0);
      // Camiseta como marca pintada de uma mala de figurinos.
      ctx.fillStyle = '#fff'; ctx.beginPath();
      ctx.moveTo(225, 45); ctx.lineTo(190, 68); ctx.lineTo(208, 99); ctx.lineTo(225, 89);
      ctx.lineTo(225, 149); ctx.lineTo(287, 149); ctx.lineTo(287, 89); ctx.lineTo(304, 99);
      ctx.lineTo(322, 68); ctx.lineTo(287, 45); ctx.quadraticCurveTo(256, 72, 225, 45); ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#0007';
      for (let i = 0; i < 65; i++) ctx.fillRect((i * 113) % 512, (i * 71) % 512, 3 + i % 8, 1.5);
    });
    paint.needsUpdate = true; inscription.visible = true;
  };
  image.src = './assets/menu/lettering-trocar-visual-creme.webp';
  group.userData.door = door;
  return group;
}
