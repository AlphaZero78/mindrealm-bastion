import * as THREE from '../../assets/third_party/three/three.bundle.js';

const validPoint = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

/** Keep authored actuators connected after animation interpolation and blending. */
export class MechanicalConnections {
  constructor(root) {
    this.root = root;
    this.groups = [];
    root.traverse(owner => {
      const definitions = owner.userData?.mechanicalLinks;
      if (!Array.isArray(definitions) || !definitions.length) return;
      const links = definitions.map(definition => {
        const { from, to, sleeveLength, overlap, radius } = definition;
        if (!validPoint(from?.point) || !validPoint(to?.point)
          || ![sleeveLength, overlap, radius].every(Number.isFinite)
          || !(radius > 0 && overlap > 0 && sleeveLength > overlap)) {
          throw new Error(`无效机械连接参数：${definition.key || owner.name}`);
        }
        const nodes = Object.fromEntries([
          ['from', from.node], ['to', to.node], ['sleeve', definition.sleeve],
          ['rod', definition.rod], ['shaft', definition.shaft],
        ].map(([key, name]) => [key, owner.getObjectByName(name)]));
        if (Object.values(nodes).some(node => !node) || nodes.shaft.parent !== nodes.rod) {
          throw new Error(`机械连接缺少已绑定关节：${definition.key || owner.name}`);
        }
        return { ...nodes, key: definition.key, a: new THREE.Vector3(...from.point),
          b: new THREE.Vector3(...to.point), sleeveLength, overlap, radius };
      });
      this.groups.push({ owner, links, inverse: new THREE.Matrix4() });
    });
    this.a = new THREE.Vector3(); this.b = new THREE.Vector3(); this.direction = new THREE.Vector3();
    this.localDirection = new THREE.Vector3(); this.scaledDirection = new THREE.Vector3();
    this.rotationAxis = new THREE.Vector3();
    this.parentMatrix = new THREE.Matrix4(); this.parentInverse = new THREE.Matrix4();
    this.parentLinear = new THREE.Matrix3();
  }

  align(node, anchor, direction, ownerInverse) {
    this.parentMatrix.multiplyMatrices(ownerInverse, node.parent.matrixWorld);
    this.parentInverse.copy(this.parentMatrix).invert();
    node.position.copy(anchor).applyMatrix4(this.parentInverse);
    this.localDirection.copy(direction).transformDirection(this.parentInverse);
    const radial = Math.hypot(this.localDirection.x, this.localDirection.z);
    if (radial > 1e-15) {
      this.rotationAxis.set(this.localDirection.z / radial, 0, -this.localDirection.x / radial);
      node.quaternion.setFromAxisAngle(this.rotationAxis, Math.atan2(radial, this.localDirection.y));
    } else if (this.localDirection.y < 0) node.quaternion.set(1, 0, 0, 0);
    else node.quaternion.identity();
    // The shell/rod dimensions are authored in owner-space model units. Undo
    // only the parent's scale along the new shaft direction, including when
    // the animated parent has different scales on its three axes.
    const axisScale = this.scaledDirection.copy(this.localDirection)
      .applyMatrix3(this.parentLinear.setFromMatrix4(this.parentMatrix)).length();
    if (!(axisScale > 1e-9)) throw new Error('机械连接父节点的轴向比例无效');
    node.scale.set(1, 1 / axisScale, 1);
    node.updateMatrix();
  }

  apply() {
    if (!this.root || !this.groups.length) return;
    this.root.updateMatrixWorld(true);
    for (const { owner, links, inverse } of this.groups) {
      inverse.copy(owner.matrixWorld).invert();
      for (const link of links) {
        this.a.copy(link.a).applyMatrix4(link.from.matrixWorld).applyMatrix4(inverse);
        this.b.copy(link.b).applyMatrix4(link.to.matrixWorld).applyMatrix4(inverse);
        const length = this.direction.subVectors(this.b, this.a).length();
        if (!(length >= link.sleeveLength + link.radius - 1e-6)) {
          throw new Error(`机械连接行程短于固定套筒：${link.key}`);
        }
        this.direction.multiplyScalar(1 / length);
        this.align(link.sleeve, this.a, this.direction, inverse);
        this.direction.negate();
        this.align(link.rod, this.b, this.direction, inverse);
        link.shaft.position.set(0, 0, 0);
        link.shaft.quaternion.identity();
        link.shaft.scale.set(1, length - link.sleeveLength + link.overlap, 1);
        link.shaft.updateMatrix();
        link.sleeve.updateMatrixWorld(true); link.rod.updateMatrixWorld(true);
      }
    }
  }

  dispose() { this.groups.length = 0; this.root = null; }
}
