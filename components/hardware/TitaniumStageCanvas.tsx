'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  getHardwareMemoryBus,
  readIntSlot,
  SABFloatOffset,
  SABIntOffset,
  STUDIO_LIGHTING_CONFIG,
  TITANIUM_FINISHES,
  type TitaniumFinishSpec,
} from '@/lib/core/hardwareMemory';
import type { IPhoneModelId } from '@/lib/core/iosState';

// Pre-allocated zero-GC math scratchpads at module scope
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _targetQuat = new THREE.Quaternion();
const _currentQuat = new THREE.Quaternion();
const _mvpMatrix = new THREE.Matrix4();
const _viewProjMatrix = new THREE.Matrix4();
const _camTargetPos = new THREE.Vector3();

/**
 * Builds an explicit indexed BufferGeometry (Vertex, Normal, UV, Index)
 * for the precision machined studio plinth beneath the device.
 */
function createExplicitStudioPlinthGeometry(width: number, depth: number, yPos: number): THREE.BufferGeometry {
  const hw = width * 0.5;
  const hd = depth * 0.5;

  const vertices = new Float32Array([
    -hw, yPos, -hd,
     hw, yPos, -hd,
     hw, yPos,  hd,
    -hw, yPos,  hd,
  ]);

  const normals = new Float32Array([
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
  ]);

  const uvs = new Float32Array([
    0, 0,
    1, 0,
    1, 1,
    0, 1,
  ]);

  const indices = new Uint16Array([
    0, 2, 1,
    0, 3, 2,
  ]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeBoundingSphere();
  return geo;
}

function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -width * 0.5;
  const y = -height * 0.5;

  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 120);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface TitaniumStageProps {
  deviceModel: IPhoneModelId;
  finishId: TitaniumFinishSpec['id'];
  inspect3D: boolean;
  isLandscape: boolean;
  isCharging: boolean;
  flashlightOn: boolean;
  flashlightIntensity: number;
}

export default function TitaniumStageCanvas({
  deviceModel,
  finishId,
  inspect3D,
  isLandscape,
  isCharging,
  flashlightOn,
  flashlightIntensity,
}: TitaniumStageProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({
    deviceModel,
    finishId,
    inspect3D,
    isLandscape,
    isCharging,
    flashlightOn,
    flashlightIntensity,
  });

  useEffect(() => {
    propsRef.current = {
      deviceModel,
      finishId,
      inspect3D,
      isLandscape,
      isCharging,
      flashlightOn,
      flashlightIntensity,
    };
  }, [deviceModel, finishId, inspect3D, isLandscape, isCharging, flashlightOn, flashlightIntensity]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const bus = getHardwareMemoryBus();

    // 1. Software WebGL detection from GPU renderer string
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initW = container.clientWidth || window.innerWidth;
    const initH = container.clientHeight || window.innerHeight;
    renderer.setSize(initW, initH);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(STUDIO_LIGHTING_CONFIG.fogColor);
    scene.fog = new THREE.FogExp2(
      STUDIO_LIGHTING_CONFIG.fogColor,
      STUDIO_LIGHTING_CONFIG.fogDensity,
    );

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(38, initW / initH, 0.1, 80);
    camera.position.set(0, 0.2, 6.6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = 3.2;
    controls.maxDistance = 10.5;
    controls.enabled = propsRef.current.inspect3D;

    // 2. Balanced 3-Point Warm/Cool Studio Rig
    const hemiLight = new THREE.HemisphereLight(
      STUDIO_LIGHTING_CONFIG.hemiSkyColor,
      STUDIO_LIGHTING_CONFIG.hemiGroundColor,
      STUDIO_LIGHTING_CONFIG.hemiIntensity,
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(
      STUDIO_LIGHTING_CONFIG.keyLightColor,
      STUDIO_LIGHTING_CONFIG.keyLightIntensity,
    );
    keyLight.position.set(3.8, 5.2, 4.4);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    keyLight.shadow.camera.left = -4;
    keyLight.shadow.camera.right = 4;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -4;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(
      STUDIO_LIGHTING_CONFIG.rimLightColor,
      STUDIO_LIGHTING_CONFIG.rimLightIntensity,
    );
    rimLight.position.set(-4.2, 2.6, -4.5);
    scene.add(rimLight);

    // 3. Explicit BufferGeometry Plinth & Grounding Contact Shadow
    const plinthGeo = createExplicitStudioPlinthGeometry(28, 28, -2.35);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x0e1116,
      roughness: 0.72,
      metalness: 0.25,
    });
    const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
    plinthMesh.receiveShadow = true;
    scene.add(plinthMesh);

    const shadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(3.8, 2.2);
    shadowGeo.rotateX(-Math.PI * 0.5);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.52,
    });
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.position.set(0, -2.32, 0);
    scene.add(contactShadow);

    // 4. Composite 10-Part Procedural iPhone 16 Pro Grade-5 Titanium Assembly
    const initialSpec = TITANIUM_FINISHES[propsRef.current.finishId];
    const phoneGroup = new THREE.Group();
    scene.add(phoneGroup);

    const titaniumBandMat = new THREE.MeshPhysicalMaterial({
      color: initialSpec.bandHex,
      metalness: initialSpec.metalness,
      roughness: initialSpec.roughness,
      anisotropy: initialSpec.anisotropy,
      clearcoat: 0.2,
    });

    const frostedBackMat = new THREE.MeshPhysicalMaterial({
      color: initialSpec.backGlassHex,
      metalness: 0.18,
      roughness: 0.54,
      clearcoat: 0.35,
      clearcoatRoughness: 0.4,
    });

    const glossyPlateauMat = new THREE.MeshPhysicalMaterial({
      color: initialSpec.plateauHex,
      metalness: 0.3,
      roughness: 0.14,
      clearcoat: 0.95,
      clearcoatRoughness: 0.08,
    });

    const oledFrontMat = new THREE.MeshPhysicalMaterial({
      color: 0x050608,
      metalness: 0.1,
      roughness: 0.06,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    });

    const sapphireLensMat = new THREE.MeshPhysicalMaterial({
      color: 0x091022,
      metalness: 0.25,
      roughness: 0.05,
      clearcoat: 1.0,
      transmission: isSoftwareGl ? 0 : 0.45,
      transparent: true,
      opacity: isSoftwareGl ? 0.92 : 1.0,
      ior: 1.77,
    });

    // Part 1: Main Titanium Chassis Band (1.49 x 3.12 x 0.17 units ~ 71.5 x 149.6 x 8.25 mm)
    const bodyShape = createRoundedRectShape(1.49, 3.12, 0.24);
    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
      depth: 0.15,
      bevelEnabled: true,
      bevelThickness: 0.022,
      bevelSize: 0.022,
      bevelSegments: 4,
    });
    bodyGeo.center();
    const bodyMesh = new THREE.Mesh(bodyGeo, titaniumBandMat);
    bodyMesh.castShadow = !isSoftwareGl;
    phoneGroup.add(bodyMesh);

    // Part 2: Ceramic Shield OLED Front Glass
    const screenShape = createRoundedRectShape(1.42, 3.05, 0.21);
    const screenGeo = new THREE.ShapeGeometry(screenShape, 12);
    const screenMesh = new THREE.Mesh(screenGeo, oledFrontMat);
    screenMesh.position.set(0, 0, 0.098);
    phoneGroup.add(screenMesh);

    // Part 3: Dynamic Island Front Cutout Detail
    const islandShape = createRoundedRectShape(0.42, 0.11, 0.055);
    const islandGeo = new THREE.ShapeGeometry(islandShape, 8);
    const islandMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const islandMesh = new THREE.Mesh(islandGeo, islandMat);
    islandMesh.position.set(0, 1.36, 0.101);
    phoneGroup.add(islandMesh);

    // Part 4: Frosted Matte Rear Glass Panel
    const rearGlassGeo = new THREE.ShapeGeometry(screenShape, 12);
    rearGlassGeo.rotateY(Math.PI);
    const rearGlassMesh = new THREE.Mesh(rearGlassGeo, frostedBackMat);
    rearGlassMesh.position.set(0, 0, -0.098);
    phoneGroup.add(rearGlassMesh);

    // Part 5: Sculpted Rear Camera Plateau
    const plateauShape = createRoundedRectShape(0.68, 0.72, 0.16);
    const plateauGeo = new THREE.ExtrudeGeometry(plateauShape, {
      depth: 0.045,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 3,
    });
    plateauGeo.center();
    const plateauMesh = new THREE.Mesh(plateauGeo, glossyPlateauMat);
    plateauMesh.position.set(0.32, 1.08, -0.115);
    phoneGroup.add(plateauMesh);

    // Part 6: Triple Sapphire Camera Lenses (Fusion 48MP, Ultra Wide 48MP, 5x Tetraprism)
    const lensCoords: Array<[number, number]> = [
      [0.48, 1.25],
      [0.48, 0.91],
      [0.16, 1.08],
    ];
    const ringGeo = new THREE.CylinderGeometry(0.135, 0.142, 0.045, 28);
    ringGeo.rotateX(Math.PI * 0.5);
    const glassGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.048, 24);
    glassGeo.rotateX(Math.PI * 0.5);

    for (let i = 0; i < lensCoords.length; i++) {
      const [lx, ly] = lensCoords[i];
      const ring = new THREE.Mesh(ringGeo, titaniumBandMat);
      ring.position.set(lx, ly, -0.152);
      phoneGroup.add(ring);

      const lens = new THREE.Mesh(glassGeo, sapphireLensMat);
      lens.position.set(lx, ly, -0.155);
      phoneGroup.add(lens);
    }

    // Part 7: Adaptive True Tone Flash & LiDAR Scanner + Live 3D Flashlight Cone
    const flashGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.02, 20);
    flashGeo.rotateX(Math.PI * 0.5);
    const flashMat = new THREE.MeshStandardMaterial({
      color: 0xfff4d6,
      emissive: 0xffefc2,
      emissiveIntensity: 0,
      roughness: 0.2,
    });
    const flashMesh = new THREE.Mesh(flashGeo, flashMat);
    flashMesh.position.set(0.16, 1.28, -0.142);
    phoneGroup.add(flashMesh);

    const lidarMat = new THREE.MeshStandardMaterial({
      color: 0x1a1c22,
      metalness: 0.6,
      roughness: 0.25,
    });
    const lidarMesh = new THREE.Mesh(flashGeo, lidarMat);
    lidarMesh.position.set(0.16, 0.88, -0.142);
    phoneGroup.add(lidarMesh);

    // Volumetric Flashlight Beam Cone (visible when flashlightOn is active!)
    const beamGeo = new THREE.ConeGeometry(0.85, 2.8, 28, 1, true);
    beamGeo.translate(0, -1.4, 0);
    beamGeo.rotateX(Math.PI * 0.5);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfff8e7,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    beamMesh.position.set(0.16, 1.28, -0.16);
    phoneGroup.add(beamMesh);

    // Part 8: Physical Rail Buttons (Action, Vol Up, Vol Down, Side Power, Sapphire Camera Control)
    const actionBtnGeo = new THREE.BoxGeometry(0.03, 0.14, 0.045);
    const volBtnGeo = new THREE.BoxGeometry(0.03, 0.24, 0.045);
    const powerBtnGeo = new THREE.BoxGeometry(0.03, 0.34, 0.045);
    const camCtrlGeo = new THREE.BoxGeometry(0.022, 0.26, 0.05);

    const actionMesh = new THREE.Mesh(actionBtnGeo, titaniumBandMat);
    actionMesh.position.set(-0.765, 0.88, 0);
    phoneGroup.add(actionMesh);

    const volUpMesh = new THREE.Mesh(volBtnGeo, titaniumBandMat);
    volUpMesh.position.set(-0.765, 0.56, 0);
    phoneGroup.add(volUpMesh);

    const volDownMesh = new THREE.Mesh(volBtnGeo, titaniumBandMat);
    volDownMesh.position.set(-0.765, 0.24, 0);
    phoneGroup.add(volDownMesh);

    const powerMesh = new THREE.Mesh(powerBtnGeo, titaniumBandMat);
    powerMesh.position.set(0.765, 0.48, 0);
    phoneGroup.add(powerMesh);

    const camCtrlMesh = new THREE.Mesh(camCtrlGeo, sapphireLensMat);
    camCtrlMesh.position.set(0.76, -0.52, 0);
    phoneGroup.add(camCtrlMesh);

    // Part 9: Bottom USB-C Port Recessed Cavity
    const usbcGeo = new THREE.BoxGeometry(0.19, 0.03, 0.055);
    const usbcMat = new THREE.MeshStandardMaterial({
      color: 0x111215,
      metalness: 0.8,
      roughness: 0.4,
    });
    const usbcMesh = new THREE.Mesh(usbcGeo, usbcMat);
    usbcMesh.position.set(0, -1.575, 0);
    phoneGroup.add(usbcMesh);

    // Part 10: MagSafe Inductive Charger Puck (glides onto back glass when charging)
    const magSafeGroup = new THREE.Group();
    const puckGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.048, 36);
    puckGeo.rotateX(Math.PI * 0.5);
    const puckRimMat = new THREE.MeshStandardMaterial({
      color: 0xd8dce3,
      metalness: 0.85,
      roughness: 0.22,
    });
    const puckPadGeo = new THREE.CylinderGeometry(0.47, 0.47, 0.052, 36);
    puckPadGeo.rotateX(Math.PI * 0.5);
    const puckPadMat = new THREE.MeshStandardMaterial({
      color: 0xf4f5f7,
      metalness: 0.05,
      roughness: 0.65,
    });
    magSafeGroup.add(new THREE.Mesh(puckGeo, puckRimMat));
    magSafeGroup.add(new THREE.Mesh(puckPadGeo, puckPadMat));
    magSafeGroup.position.set(0, -0.12, -1.2);
    phoneGroup.add(magSafeGroup);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Context loss resilience
    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Zero-allocation animation loop with software WebGL fenceSync pacing
    const clock = new THREE.Clock();
    let frameId = 0;
    let frameCounter = 0;
    let lastFinishId = propsRef.current.finishId;
    let wasInspect3D = propsRef.current.inspect3D;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      frameCounter = (frameCounter + 1) | 0;

      const cur = propsRef.current;

      // Update PBR finish dynamically if user switched Titanium swatch
      if (cur.finishId !== lastFinishId) {
        const spec = TITANIUM_FINISHES[cur.finishId];
        titaniumBandMat.color.setHex(spec.bandHex);
        titaniumBandMat.metalness = spec.metalness;
        titaniumBandMat.roughness = spec.roughness;
        frostedBackMat.color.setHex(spec.backGlassHex);
        glossyPlateauMat.color.setHex(spec.plateauHex);
        lastFinishId = cur.finishId;
      }

      // Toggle OrbitControls & smoothly glide 3D chassis between rear-showcase flank & center 360° stage
      if (cur.inspect3D !== wasInspect3D) {
        controls.enabled = cur.inspect3D;
        if (cur.inspect3D) {
          camera.position.set(1.9, 0.55, 5.2);
          controls.target.set(0, 0, 0);
        }
        wasInspect3D = cur.inspect3D;
      }

      // Read zero-allocation Taptic impulse & pointer tilt from SharedArrayBuffer
      const tapticImpulse = bus.f32[SABFloatOffset.TAPTIC_IMPULSE];
      if (tapticImpulse > 0.001) {
        bus.f32[SABFloatOffset.TAPTIC_IMPULSE] = THREE.MathUtils.damp(tapticImpulse, 0, 22, dt);
      } else {
        bus.f32[SABFloatOffset.TAPTIC_IMPULSE] = 0;
      }

      // Update FPS telemetry in SAB
      if (dt > 0.0001) {
        const instFps = 1.0 / dt;
        bus.f32[SABFloatOffset.MEASURED_FPS] = THREE.MathUtils.damp(
          bus.f32[SABFloatOffset.MEASURED_FPS],
          instFps,
          6,
          dt,
        );
        bus.f32[SABFloatOffset.FRAME_TIME_MS] = dt * 1000;
      }

      const targetXPos = cur.inspect3D ? 0 : 2.55;
      const baseScale = cur.inspect3D ? 1.16 : 0.86;
      const modelScaleX =
        cur.deviceModel === 'iphone-14-pro-max'
          ? 1.09
          : cur.deviceModel === 'iphone-se'
            ? 0.94
            : 1.0;
      const modelScaleY =
        cur.deviceModel === 'iphone-14-pro-max'
          ? 1.09
          : cur.deviceModel === 'iphone-se'
            ? 0.87
            : cur.deviceModel === 'iphone-13'
              ? 0.99
              : 1.0;

      camCtrlMesh.visible = cur.deviceModel === 'iphone-16-pro';

      phoneGroup.position.x = THREE.MathUtils.damp(phoneGroup.position.x, targetXPos, 6.5, dt);
      phoneGroup.position.y =
        THREE.MathUtils.damp(phoneGroup.position.y, Math.sin(elapsed * 1.1) * 0.04, 4, dt) +
        tapticImpulse * 0.025;
      phoneGroup.scale.x = THREE.MathUtils.damp(phoneGroup.scale.x, baseScale * modelScaleX, 6.5, dt);
      phoneGroup.scale.y = THREE.MathUtils.damp(phoneGroup.scale.y, baseScale * modelScaleY, 6.5, dt);
      phoneGroup.scale.z = THREE.MathUtils.damp(phoneGroup.scale.z, baseScale, 6.5, dt);

      // Quaternion spring orientation: show sculpted rear titanium & camera plateau on flank, or interactive tilt
      const tiltX = bus.f32[SABFloatOffset.TARGET_TILT_X];
      const tiltY = bus.f32[SABFloatOffset.TARGET_TILT_Y];
      const rotZ = cur.isLandscape ? -Math.PI * 0.5 : 0;

      if (cur.inspect3D) {
        _euler.set(tiltX * 0.25, Math.PI + Math.sin(elapsed * 0.45) * 0.35 + tiltY * 0.35, rotZ);
      } else {
        _euler.set(0.08 + tiltX * 0.4, Math.PI - 0.48 + tiltY * 0.45, rotZ);
      }
      _targetQuat.setFromEuler(_euler);
      _currentQuat.copy(phoneGroup.quaternion).slerp(_targetQuat, 1 - Math.exp(-7.5 * dt));
      phoneGroup.quaternion.copy(_currentQuat);

      // Write Quaternion & explicit 4x4 MVP Matrix into SharedArrayBuffer
      bus.f32[SABFloatOffset.QUAT_X] = _currentQuat.x;
      bus.f32[SABFloatOffset.QUAT_Y] = _currentQuat.y;
      bus.f32[SABFloatOffset.QUAT_Z] = _currentQuat.z;
      bus.f32[SABFloatOffset.QUAT_W] = _currentQuat.w;

      if (!cur.inspect3D) {
        _camTargetPos.set(0, 0.15, 6.6);
        camera.position.lerp(_camTargetPos, 1 - Math.exp(-5 * dt));
        camera.lookAt(0, 0, 0);
      } else {
        controls.update();
      }

      phoneGroup.updateMatrixWorld();
      _viewProjMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      _mvpMatrix.multiplyMatrices(_viewProjMatrix, phoneGroup.matrixWorld);
      for (let m = 0; m < 16; m++) {
        bus.f32[SABFloatOffset.MVP_MAT_START + m] = _mvpMatrix.elements[m];
      }

      // MagSafe Charger magnetic dock animation
      const targetPuckZ = cur.isCharging ? -0.128 : -1.55;
      magSafeGroup.position.z = THREE.MathUtils.damp(magSafeGroup.position.z, targetPuckZ, 9, dt);
      magSafeGroup.visible = magSafeGroup.position.z > -1.45;

      // 3D True Tone Flashlight volumetric beam
      const targetBeamOpacity = cur.flashlightOn ? 0.12 + cur.flashlightIntensity * 0.07 : 0;
      beamMat.opacity = THREE.MathUtils.damp(beamMat.opacity, targetBeamOpacity, 12, dt);
      beamMesh.visible = beamMat.opacity > 0.005;
      flashMat.emissiveIntensity = cur.flashlightOn ? cur.flashlightIntensity * 1.4 : 0;

      // Respect SAB Frame-Skipping Throttle (e.g. Low Power Mode / 60Hz cap)
      const skipModulo = Math.max(1, readIntSlot(bus.i32, SABIntOffset.FRAME_SKIP_MODULO, bus.isAtomicCapable));
      if (frameCounter % skipModulo === 0) {
        renderer.render(scene, camera);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = window.requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      controls.dispose();
      plinthGeo.dispose();
      plinthMat.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      shadowTex.dispose();
      bodyGeo.dispose();
      screenGeo.dispose();
      islandGeo.dispose();
      rearGlassGeo.dispose();
      plateauGeo.dispose();
      ringGeo.dispose();
      glassGeo.dispose();
      flashGeo.dispose();
      beamGeo.dispose();
      actionBtnGeo.dispose();
      volBtnGeo.dispose();
      powerBtnGeo.dispose();
      camCtrlGeo.dispose();
      usbcGeo.dispose();
      puckGeo.dispose();
      puckPadGeo.dispose();
      titaniumBandMat.dispose();
      frostedBackMat.dispose();
      glossyPlateauMat.dispose();
      oledFrontMat.dispose();
      sapphireLensMat.dispose();
      flashMat.dispose();
      lidarMat.dispose();
      beamMat.dispose();
      usbcMat.dispose();
      puckRimMat.dispose();
      puckPadMat.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 w-full h-full overflow-hidden"
      aria-label="3D Grade-5 Titanium Hardware Stage"
    />
  );
}
