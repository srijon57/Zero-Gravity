import * as THREE from "three";

// Creates the exhaust flames for ONE car and returns a small controller.
export function createNitroFlames(car) {
  const flameGeometry = new THREE.ConeGeometry(0.25, 1.5, 16);
  flameGeometry.rotateX(-Math.PI / 2);

  const flameMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0033,
    transparent: true,
    opacity: 0.9,
  });

  const flames = [];

  for (let i = 0; i < 2; i++) {
    const flame = new THREE.Mesh(flameGeometry.clone(), flameMaterial.clone());
    flame.position.set(i === 0 ? -0.3 : 0.3, 0.3, -1.8);
    flame.visible = false;
    car.add(flame);
    flames.push(flame);
  }

  return {
    update(active) {
      for (const flame of flames) {
        flame.visible = active;
        if (active) flame.scale.y = 0.8 + Math.random() * 0.5;
      }
    },
  };
}
