import * as THREE from 'three';

// ─── Lava animated ShaderMaterial ──────────────────────────────────────────

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  // Value noise
  float hash(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i),           hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  // Fractal brownian motion — 5 octaves
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = p * 2.1 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv * 4.0;
    float t = uTime * 0.12;

    // Two layers of animated fbm for depth
    vec2 p = uv + vec2(t, t * 0.6);
    float f = fbm(p);
    f += 0.45 * fbm(p * 2.0 + vec2(-t * 0.4, t * 1.1));
    f = clamp(f / 1.45, 0.0, 1.0);

    // 4-stop lava colour ramp
    vec3 c1 = vec3(0.06, 0.00, 0.00); // crust — near black-red
    vec3 c2 = vec3(0.72, 0.05, 0.00); // magma — orange-red
    vec3 c3 = vec3(1.00, 0.42, 0.00); // bright — orange
    vec3 c4 = vec3(1.00, 0.92, 0.55); // hotspot — yellow-white

    vec3 col;
    if (f < 0.33) {
      col = mix(c1, c2, f * 3.030);
    } else if (f < 0.66) {
      col = mix(c2, c3, (f - 0.33) * 3.030);
    } else {
      col = mix(c3, c4, (f - 0.66) * 3.030);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createLavaMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    side: THREE.FrontSide,
  });
}

// ─── Cave skydome ShaderMaterial ───────────────────────────────────────────

const skyVertexShader = /* glsl */ `
  varying float vNormY;
  void main() {
    // Normalise y: -1 (bottom / lava level) → +1 (apex)
    vNormY = normalize(position).y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragmentShader = /* glsl */ `
  varying float vNormY;

  void main() {
    float t = clamp(vNormY * 0.5 + 0.5, 0.0, 1.0); // 0 = bottom, 1 = top
    float tSq = t * t;

    vec3 bottomGlow = vec3(0.30, 0.06, 0.00); // lava red near ground — brighter
    vec3 midCave    = vec3(0.10, 0.07, 0.14); // visible purple cave wall
    vec3 topCeiling = vec3(0.04, 0.03, 0.08); // dark-purple ceiling

    vec3 col = mix(bottomGlow, midCave, clamp(t * 2.0, 0.0, 1.0));
    col       = mix(col, topCeiling,   clamp((t - 0.5) * 2.0, 0.0, 1.0));

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createSkydomeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    side: THREE.BackSide, // render inside of sphere
  });
}
