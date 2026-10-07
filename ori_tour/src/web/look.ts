// How a figure looks in the real world on a phone: lit like the scene around
// it, casting a shadow on the real ground, and hidden behind real things that
// stand in front of it.
//
//   Light      WebXR light estimation ("light-estimation", Chrome on ARCore):
//              the main light's direction and strength, ambient light as
//              spherical harmonics, and a reflection cube map of the
//              surroundings. Before an estimate arrives (or where there is
//              none) a neutral sky light, a high sun and a room environment.
//   Shadow     a real shadow map from the (estimated) sun onto an invisible
//              ground disc under each figure (a shadow catcher), plus a soft
//              contact shadow where it touches the ground.
//   Colour     tone mapping so a bright sun does not blow the model out.
//   Occlusion  WebXR depth sensing ("depth-sensing", CPU depth on ARCore
//              phones that have it): a figure's pixels behind a real surface
//              (a parked car, a person walking past) are not drawn.
//
// Each is optional and degrades on its own. `status()` says which are live,
// for the readout. URL switches: ?shadows=off, ?occlusion=off, ?estimate=off.

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { XREstimatedLight } from "three/addons/webxr/XREstimatedLight.js";

export interface LookOptions {
  shadows: boolean;
  occlusion: boolean;
  estimate: boolean;
}

export const lookOptions = (params: URLSearchParams): LookOptions => ({
  shadows: params.get("shadows") !== "off",
  occlusion: params.get("occlusion") !== "off",
  estimate: params.get("estimate") !== "off",
});

/** Renderer settings every figure scene uses. */
export function setUpRenderer(renderer: THREE.WebGLRenderer, o: LookOptions): void {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = o.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
}

/** The (estimated or default) sun, ambient light and environment of one scene. */
export class SceneLight {
  readonly sun = new THREE.DirectionalLight(0xffffff, 2.2);
  private readonly sky = new THREE.HemisphereLight(0xfff4e0, 0x3a3328, 1.2);
  private readonly room: THREE.Texture;
  private readonly estimated: XREstimatedLight | null;
  private estimating = false;
  private readonly dir = new THREE.Vector3(0.35, 1, 0.25).normalize();
  private readonly scene: THREE.Scene;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, o: LookOptions) {
    this.scene = scene;
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.room = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = this.room;
    scene.environmentIntensity = 0.6;
    scene.add(this.sky);
    this.sun.castShadow = o.shadows;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    scene.add(this.sun, this.sun.target);

    this.estimated = o.estimate ? new XREstimatedLight(renderer, true) : null;
    if (this.estimated) {
      // its own directional light is replaced by our shadow-casting sun
      this.estimated.directionalLight.visible = false;
      this.estimated.addEventListener("estimationstart", () => {
        this.estimating = true;
        this.sky.visible = false;
        if (this.estimated?.environment) {
          scene.environment = this.estimated.environment;
          scene.environmentIntensity = 1;
        }
      });
      this.estimated.addEventListener("estimationend", () => this.useDefault());
      scene.add(this.estimated);
    }
  }

  private useDefault(): void {
    this.estimating = false;
    this.sky.visible = true;
    this.scene.environment = this.room;
    this.scene.environmentIntensity = 0.6;
    this.sun.intensity = 2.2;
    this.dir.set(0.35, 1, 0.25).normalize();
  }

  /** Aim the sun's shadow at a figure (the nearest one) of the given size. Call every frame. */
  follow(target: THREE.Vector3, sizeM: number): void {
    const est = this.estimated?.directionalLight;
    if (this.estimating && est) {
      if (est.position.lengthSq() > 1e-6) this.dir.copy(est.position).normalize();
      // a sun below the horizon casts no useful shadow: keep it at least 15 degrees up
      if (this.dir.y < 0.26) this.dir.setY(0.26).normalize();
      this.sun.color.copy(est.color);
      this.sun.intensity = Math.max(est.intensity, 0.2);
    }
    const reach = sizeM * 2 + 2;
    this.sun.position.copy(target).addScaledVector(this.dir, reach * 2);
    this.sun.target.position.copy(target);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -reach;
    cam.right = cam.top = reach;
    cam.near = 0.1;
    cam.far = reach * 4;
    cam.updateProjectionMatrix();
  }

  status(): string {
    return this.estimating ? "estimated from the camera" : this.estimated ? "default (no estimate yet)" : "default";
  }
}

/** An invisible disc that only shows the shadows falling on it: the real ground's shadow. */
export function shadowCatcher(radiusM: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(radiusM, 48),
    new THREE.ShadowMaterial({ opacity: 0.38, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.004;
  m.receiveShadow = true;
  m.renderOrder = -1;
  return m;
}

// ---------------------------------------------------------------- occlusion

const OCCLUDE_PARS = /* glsl */ `
uniform sampler2D uOcclDepth;
uniform mat4 uOcclUv;
uniform vec2 uOcclViewport;
uniform float uOcclOn;
`;
const OCCLUDE_MAIN = /* glsl */ `
  if (uOcclOn > 0.5) {
    // normalized view coordinates: origin top left
    vec2 nv = vec2(gl_FragCoord.x / uOcclViewport.x, 1.0 - gl_FragCoord.y / uOcclViewport.y);
    vec2 duv = (uOcclUv * vec4(nv, 0.0, 1.0)).xy;
    float real = texture2D(uOcclDepth, duv).r;
    // 10 cm of slack so the ground the figure stands on never cuts its feet
    if (real > 0.0 && real < vViewPosition.z - 0.1) discard;
  }
`;

/**
 * Real-world occlusion from the phone's depth map. update() each XR frame;
 * patch() each material of a figure once.
 */
export class DepthOcclusion {
  readonly enabled: boolean;
  private texture: THREE.DataTexture | null = null;
  private live = false;
  private readonly uniforms = {
    uOcclDepth: { value: null as THREE.Texture | null },
    uOcclUv: { value: new THREE.Matrix4() },
    uOcclViewport: { value: new THREE.Vector2(1, 1) },
    uOcclOn: { value: 0 },
  };

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  /** Read this frame's CPU depth map, if the session has one. */
  update(frame: XRFrame, ref: XRReferenceSpace): void {
    if (!this.enabled) return;
    const session = frame.session;
    if (session.depthUsage !== "cpu-optimized") return this.off();
    const view = frame.getViewerPose(ref)?.views[0];
    const depth = view ? frame.getDepthInformation(view) : null;
    if (!depth) return this.off();
    const n = depth.width * depth.height;
    if (!this.texture || this.texture.image.width !== depth.width || this.texture.image.height !== depth.height) {
      this.texture?.dispose();
      this.texture = new THREE.DataTexture(
        new Float32Array(n),
        depth.width,
        depth.height,
        THREE.RedFormat,
        THREE.FloatType,
      );
      this.texture.magFilter = this.texture.minFilter = THREE.LinearFilter;
      this.uniforms.uOcclDepth.value = this.texture;
    }
    const out = this.texture.image.data as Float32Array;
    const raw = session.depthDataFormat === "float32" ? new Float32Array(depth.data) : new Uint16Array(depth.data);
    const k = depth.rawValueToMeters;
    for (let i = 0; i < n; i++) out[i] = raw[i]! * k;
    this.texture.needsUpdate = true;
    this.uniforms.uOcclUv.value.fromArray(depth.normDepthBufferFromNormView.matrix);
    const layer = session.renderState.baseLayer;
    if (layer) this.uniforms.uOcclViewport.value.set(layer.framebufferWidth, layer.framebufferHeight);
    this.uniforms.uOcclOn.value = 1;
    this.live = true;
  }

  private off(): void {
    this.uniforms.uOcclOn.value = 0;
    this.live = false;
  }

  /** Make a figure's material respect the depth map. */
  patch(material: THREE.Material): void {
    if (!this.enabled || !(material instanceof THREE.MeshStandardMaterial)) return;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.fragmentShader = shader.fragmentShader.replace(
        "void main() {",
        `${OCCLUDE_PARS}\nvoid main() {\n${OCCLUDE_MAIN}`,
      );
    };
    material.customProgramCacheKey = () => "ori-occlusion";
    material.needsUpdate = true;
  }

  status(): string {
    return !this.enabled ? "off" : this.live ? "on (phone depth)" : "not on this phone";
  }
}
