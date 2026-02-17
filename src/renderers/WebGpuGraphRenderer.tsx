import { useCallback, useEffect, useRef, useState } from "react";
import { worldPointToBoard } from "../graph/coordinates";
import { createNodeMap, cubicBezierPoint, getEdgeCurve } from "../graph/geometry";
import type { ViewportType } from "../types/common";
import type { EdgeType } from "../types/edge";
import type { NodeType } from "../types/node";
import styles from "../App.module.css";

const BYTES_PER_FLOAT = 4;
const EDGE_FLOATS_PER_VERTEX = 5;
const EDGE_STRIDE_BYTES = EDGE_FLOATS_PER_VERTEX * BYTES_PER_FLOAT;
const NODE_FLOATS_PER_VERTEX = 8;
const NODE_STRIDE_BYTES = NODE_FLOATS_PER_VERTEX * BYTES_PER_FLOAT;
const EDGE_SEGMENTS = 28;
const EDGE_WIDTH = 2.4;
const EDGE_GLOW = 6.5;
const NODE_RADIUS = 12;
const NODE_BORDER_WIDTH = 1;
const NODE_SHADOW_PAD = 18;

const GPU_BUFFER_USAGE_COPY_DST = 0x0008;
const GPU_BUFFER_USAGE_VERTEX = 0x0020;
const GPU_BUFFER_USAGE_UNIFORM = 0x0040;
const GPU_SHADER_STAGE_VERTEX = 0x1;
const GPU_COLOR_WRITE_ALL = 0xf;

const EDGE_SHADER = `
struct Uniforms {
  resolution: vec2f,
  _pad: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) signedDistance: f32,
  @location(2) coreHalfWidth: f32,
  @location(3) glowSize: f32,
}

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) signedDistance: f32,
  @location(1) coreHalfWidth: f32,
  @location(2) glowSize: f32,
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let clipX = (input.position.x / uniforms.resolution.x) * 2.0 - 1.0;
  let clipY = 1.0 - (input.position.y / uniforms.resolution.y) * 2.0;
  output.clipPosition = vec4f(clipX, clipY, 0.0, 1.0);
  output.signedDistance = input.signedDistance;
  output.coreHalfWidth = input.coreHalfWidth;
  output.glowSize = input.glowSize;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let absDistance = abs(input.signedDistance);
  let aa = max(fwidth(absDistance), 0.75);
  let core = 1.0 - smoothstep(input.coreHalfWidth - aa, input.coreHalfWidth + aa, absDistance);
  let glow = 1.0 - smoothstep(input.coreHalfWidth, input.coreHalfWidth + input.glowSize, absDistance);
  let glowCurve = pow(glow, 1.5);

  let coreColor = vec3f(0.329, 0.89, 0.84);
  let glowColor = vec3f(0.46, 0.93, 0.9);

  let alpha = max(core * 0.95, glowCurve * 0.36);
  let color = coreColor * (core * 0.92) + glowColor * (glowCurve * 0.42);

  return vec4f(color, alpha);
}
`;

const NODE_SHADER = `
struct Uniforms {
  resolution: vec2f,
  _pad: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

fn sdRoundedRect(point: vec2f, halfSize: vec2f, radius: f32) -> f32 {
  let q = abs(point) - (halfSize - vec2f(radius, radius));
  return length(max(q, vec2f(0.0, 0.0))) + min(max(q.x, q.y), 0.0) - radius;
}

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) localPoint: vec2f,
  @location(2) halfSize: vec2f,
  @location(3) radius: f32,
  @location(4) borderWidth: f32,
}

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) localPoint: vec2f,
  @location(1) halfSize: vec2f,
  @location(2) radius: f32,
  @location(3) borderWidth: f32,
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let clipX = (input.position.x / uniforms.resolution.x) * 2.0 - 1.0;
  let clipY = 1.0 - (input.position.y / uniforms.resolution.y) * 2.0;
  output.clipPosition = vec4f(clipX, clipY, 0.0, 1.0);
  output.localPoint = input.localPoint;
  output.halfSize = input.halfSize;
  output.radius = input.radius;
  output.borderWidth = input.borderWidth;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let distance = sdRoundedRect(input.localPoint, input.halfSize, input.radius);
  let aa = max(fwidth(distance), 0.8);
  let fill = 1.0 - smoothstep(-aa, aa, distance);
  let inner = 1.0 - smoothstep(-aa, aa, distance + input.borderWidth);
  let border = clamp(fill - inner, 0.0, 1.0);

  let yScale = input.localPoint.y / max(input.halfSize.y, 1.0);
  let gradientT = clamp(yScale * 0.5 + 0.5, 0.0, 1.0);

  let topColor = vec3f(0.141, 0.208, 0.31);
  let bottomColor = vec3f(0.082, 0.129, 0.196);
  var base = mix(topColor, bottomColor, gradientT);

  let sheen = clamp((1.0 - gradientT) * 1.15, 0.0, 1.0) * inner * 0.14;
  base += vec3f(0.13, 0.17, 0.21) * sheen;

  let borderColor = vec3f(0.59, 0.7, 0.88);
  let shadowDistance = max(distance, 0.0);
  let shadow = exp(-shadowDistance / max(input.radius * 0.95, 1.0)) * (1.0 - fill) * 0.34;
  let shadowColor = vec3f(0.01, 0.03, 0.07);

  let color = shadowColor * shadow + base * inner + borderColor * (border * 0.46);
  let alpha = clamp(shadow + fill, 0.0, 1.0);

  return vec4f(color, alpha);
}
`;

type GpuBufferLike = {
  destroy?: () => void;
};

type GpuQueueLike = {
  submit: (commands: unknown[]) => void;
  writeBuffer: (
    buffer: GpuBufferLike,
    bufferOffset: number,
    data: BufferSource,
    dataOffset?: number,
    size?: number,
  ) => void;
};

type GpuRenderPassLike = {
  draw: (vertexCount: number) => void;
  end: () => void;
  setBindGroup: (index: number, bindGroup: unknown) => void;
  setPipeline: (pipeline: unknown) => void;
  setVertexBuffer: (slot: number, buffer: GpuBufferLike) => void;
};

type GpuCommandEncoderLike = {
  beginRenderPass: (descriptor: {
    colorAttachments: Array<{
      clearValue: { r: number; g: number; b: number; a: number };
      loadOp: "clear";
      storeOp: "store";
      view: unknown;
    }>;
  }) => GpuRenderPassLike;
  finish: () => unknown;
};

type GpuDeviceLike = {
  createBindGroup: (descriptor: {
    layout: unknown;
    entries: Array<{ binding: number; resource: { buffer: GpuBufferLike } }>;
  }) => unknown;
  createBindGroupLayout: (descriptor: {
    entries: Array<{ binding: number; visibility: number; buffer: { type: "uniform" } }>;
  }) => unknown;
  createBuffer: (descriptor: { size: number; usage: number }) => GpuBufferLike;
  createCommandEncoder: () => GpuCommandEncoderLike;
  createPipelineLayout: (descriptor: { bindGroupLayouts: unknown[] }) => unknown;
  createRenderPipeline: (descriptor: unknown) => unknown;
  createShaderModule: (descriptor: { code: string }) => unknown;
  destroy?: () => void;
  queue: GpuQueueLike;
};

type GpuCanvasContextLike = {
  configure: (options: { device: GpuDeviceLike; format: string; alphaMode: "premultiplied" }) => void;
  getCurrentTexture: () => { createView: () => unknown };
};

type GpuAdapterLike = {
  requestDevice: () => Promise<GpuDeviceLike>;
};

type GpuNavigatorLike = {
  getPreferredCanvasFormat: () => string;
  requestAdapter: () => Promise<GpuAdapterLike | null>;
};

type Runtime = {
  bindGroup: unknown;
  context: GpuCanvasContextLike;
  device: GpuDeviceLike;
  edgePipeline: unknown;
  nodePipeline: unknown;
  uniformBuffer: GpuBufferLike;
};

type DynamicVertexBuffer = {
  buffer: GpuBufferLike | null;
  capacityBytes: number;
  vertexCount: number;
};

type Props = {
  edges: EdgeType[];
  nodes: NodeType[];
  viewport: ViewportType;
};

type SceneSnapshot = {
  edges: EdgeType[];
  nodes: NodeType[];
  viewport: ViewportType;
};

type Point = {
  x: number;
  y: number;
};

const appendEdgeVertex = (
  vertices: number[],
  x: number,
  y: number,
  signedDistance: number,
  coreHalfWidth: number,
  glowSize: number,
) => {
  vertices.push(x, y, signedDistance, coreHalfWidth, glowSize);
};

const appendEdgeQuadSegment = (
  vertices: number[],
  start: Point,
  end: Point,
  coreHalfWidth: number,
  glowSize: number,
) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return;

  const nx = -dy / length;
  const ny = dx / length;
  const outerHalf = coreHalfWidth + glowSize;

  const ox = nx * outerHalf;
  const oy = ny * outerHalf;

  const left0 = { x: start.x - ox, y: start.y - oy };
  const right0 = { x: start.x + ox, y: start.y + oy };
  const left1 = { x: end.x - ox, y: end.y - oy };
  const right1 = { x: end.x + ox, y: end.y + oy };

  appendEdgeVertex(vertices, left0.x, left0.y, -outerHalf, coreHalfWidth, glowSize);
  appendEdgeVertex(vertices, right0.x, right0.y, outerHalf, coreHalfWidth, glowSize);
  appendEdgeVertex(vertices, left1.x, left1.y, -outerHalf, coreHalfWidth, glowSize);

  appendEdgeVertex(vertices, right0.x, right0.y, outerHalf, coreHalfWidth, glowSize);
  appendEdgeVertex(vertices, right1.x, right1.y, outerHalf, coreHalfWidth, glowSize);
  appendEdgeVertex(vertices, left1.x, left1.y, -outerHalf, coreHalfWidth, glowSize);
};

const appendNodeVertex = (
  vertices: number[],
  x: number,
  y: number,
  localX: number,
  localY: number,
  halfWidth: number,
  halfHeight: number,
  radius: number,
  borderWidth: number,
) => {
  vertices.push(x, y, localX, localY, halfWidth, halfHeight, radius, borderWidth);
};

const appendNodeQuad = (
  vertices: number[],
  x: number,
  y: number,
  width: number,
  height: number,
  shadowPadding: number,
  radius: number,
  borderWidth: number,
) => {
  const left = x - shadowPadding;
  const top = y - shadowPadding;
  const right = x + width + shadowPadding;
  const bottom = y + height + shadowPadding;

  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const localLeft = -halfWidth - shadowPadding;
  const localTop = -halfHeight - shadowPadding;
  const localRight = halfWidth + shadowPadding;
  const localBottom = halfHeight + shadowPadding;

  appendNodeVertex(vertices, left, top, localLeft, localTop, halfWidth, halfHeight, radius, borderWidth);
  appendNodeVertex(vertices, right, top, localRight, localTop, halfWidth, halfHeight, radius, borderWidth);
  appendNodeVertex(vertices, left, bottom, localLeft, localBottom, halfWidth, halfHeight, radius, borderWidth);

  appendNodeVertex(vertices, right, top, localRight, localTop, halfWidth, halfHeight, radius, borderWidth);
  appendNodeVertex(vertices, right, bottom, localRight, localBottom, halfWidth, halfHeight, radius, borderWidth);
  appendNodeVertex(vertices, left, bottom, localLeft, localBottom, halfWidth, halfHeight, radius, borderWidth);
};

const ensureVertexBuffer = (device: GpuDeviceLike, state: DynamicVertexBuffer, requiredBytes: number) => {
  if (state.buffer && state.capacityBytes >= requiredBytes) return;

  state.buffer?.destroy?.();
  state.capacityBytes = Math.max(4096, Math.max(requiredBytes, state.capacityBytes * 2));
  state.buffer = device.createBuffer({
    size: state.capacityBytes,
    usage: GPU_BUFFER_USAGE_VERTEX | GPU_BUFFER_USAGE_COPY_DST,
  });
};

const uploadVertices = (device: GpuDeviceLike, state: DynamicVertexBuffer, data: number[], floatsPerVertex: number) => {
  state.vertexCount = data.length / floatsPerVertex;
  if (data.length === 0) return;

  const floatData = new Float32Array(data);
  ensureVertexBuffer(device, state, floatData.byteLength);
  if (!state.buffer) return;

  device.queue.writeBuffer(state.buffer, 0, floatData, 0, floatData.length);
};

const resolveGpuNavigator = (): GpuNavigatorLike | null => {
  const nav = navigator as Navigator & { gpu?: unknown };
  const gpu = nav.gpu as GpuNavigatorLike | undefined;
  return gpu ?? null;
};

export const WebGpuGraphRenderer = ({ edges, nodes, viewport }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const dprRef = useRef(1);
  const sceneRef = useRef<SceneSnapshot>({ edges, nodes, viewport });
  const edgeBufferRef = useRef<DynamicVertexBuffer>({ buffer: null, capacityBytes: 0, vertexCount: 0 });
  const nodeBufferRef = useRef<DynamicVertexBuffer>({ buffer: null, capacityBytes: 0, vertexCount: 0 });
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const syncCanvasSize = useCallback(() => {
    const runtime = runtimeRef.current;
    const canvas = canvasRef.current;
    if (!runtime || !canvas) return;

    const host = canvas.parentElement ?? canvas;
    const rect = host.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    dprRef.current = dpr;
    runtime.device.queue.writeBuffer(runtime.uniformBuffer, 0, new Float32Array([width, height, 0, 0]), 0, 4);
  }, []);

  const draw = useCallback(() => {
    const runtime = runtimeRef.current;
    const canvas = canvasRef.current;
    if (!runtime || !canvas || canvas.width === 0 || canvas.height === 0) return;

    const dpr = dprRef.current;
    const { edges: sceneEdges, nodes: sceneNodes, viewport: sceneViewport } = sceneRef.current;
    const nodeMap = createNodeMap(sceneNodes);

    const edgeVertices: number[] = [];
    const nodeVertices: number[] = [];
    const edgeScale = sceneViewport.zoom * dpr;
    const edgeCoreHalf = (EDGE_WIDTH * edgeScale) / 2;
    const edgeGlow = Math.max(1.1 * dpr, EDGE_GLOW * edgeScale);

    const nodeScale = sceneViewport.zoom * dpr;
    const nodeRadiusBase = Math.max(2 * dpr, NODE_RADIUS * nodeScale);
    const nodeBorder = Math.max(0.9 * dpr, NODE_BORDER_WIDTH * nodeScale);
    const nodeShadowPad = Math.max(7 * dpr, NODE_SHADOW_PAD * nodeScale);

    sceneEdges.forEach((edge) => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      if (!sourceNode || !targetNode) return;

      const curve = getEdgeCurve(sourceNode, targetNode);
      let previous = cubicBezierPoint(0, curve);

      for (let i = 1; i <= EDGE_SEGMENTS; i += 1) {
        const t = i / EDGE_SEGMENTS;
        const next = cubicBezierPoint(t, curve);

        const p0 = worldPointToBoard(previous, sceneViewport);
        const p1 = worldPointToBoard(next, sceneViewport);

        appendEdgeQuadSegment(
          edgeVertices,
          { x: p0.x * dpr, y: p0.y * dpr },
          { x: p1.x * dpr, y: p1.y * dpr },
          edgeCoreHalf,
          edgeGlow,
        );

        previous = next;
      }
    });

    sceneNodes.forEach((node) => {
      const topLeft = worldPointToBoard(node.position, sceneViewport);
      const x = topLeft.x * dpr;
      const y = topLeft.y * dpr;
      const width = node.width * sceneViewport.zoom * dpr;
      const height = node.height * sceneViewport.zoom * dpr;
      const radius = Math.min(nodeRadiusBase, Math.max(1, Math.min(width, height) * 0.5 - 1));

      appendNodeQuad(nodeVertices, x, y, width, height, nodeShadowPad, radius, nodeBorder);
    });

    uploadVertices(runtime.device, edgeBufferRef.current, edgeVertices, EDGE_FLOATS_PER_VERTEX);
    uploadVertices(runtime.device, nodeBufferRef.current, nodeVertices, NODE_FLOATS_PER_VERTEX);

    const encoder = runtime.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: runtime.context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    pass.setBindGroup(0, runtime.bindGroup);

    if (edgeBufferRef.current.vertexCount > 0 && edgeBufferRef.current.buffer) {
      pass.setPipeline(runtime.edgePipeline);
      pass.setVertexBuffer(0, edgeBufferRef.current.buffer);
      pass.draw(edgeBufferRef.current.vertexCount);
    }

    if (nodeBufferRef.current.vertexCount > 0 && nodeBufferRef.current.buffer) {
      pass.setPipeline(runtime.nodePipeline);
      pass.setVertexBuffer(0, nodeBufferRef.current.buffer);
      pass.draw(nodeBufferRef.current.vertexCount);
    }

    pass.end();
    runtime.device.queue.submit([encoder.finish()]);
  }, []);

  useEffect(() => {
    sceneRef.current = { edges, nodes, viewport };
    draw();
  }, [draw, edges, nodes, viewport]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gpu = resolveGpuNavigator();
    if (!gpu) return;

    let disposed = false;

    const initialize = async () => {
      try {
        const adapter = await gpu.requestAdapter();
        if (!adapter) {
          if (!disposed) setRuntimeError("WebGPU adapter is unavailable.");
          return;
        }

        const device = await adapter.requestDevice();
        if (disposed) return;

        const context = canvas.getContext("webgpu") as GpuCanvasContextLike | null;
        if (!context) {
          if (!disposed) setRuntimeError("Failed to acquire WebGPU context.");
          return;
        }

        const format = gpu.getPreferredCanvasFormat();
        context.configure({
          device,
          format,
          alphaMode: "premultiplied",
        });

        const edgeShaderModule = device.createShaderModule({ code: EDGE_SHADER });
        const nodeShaderModule = device.createShaderModule({ code: NODE_SHADER });

        const bindGroupLayout = device.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              visibility: GPU_SHADER_STAGE_VERTEX,
              buffer: { type: "uniform" },
            },
          ],
        });

        const pipelineLayout = device.createPipelineLayout({
          bindGroupLayouts: [bindGroupLayout],
        });

        const blendState = {
          color: {
            operation: "add",
            srcFactor: "src-alpha",
            dstFactor: "one-minus-src-alpha",
          },
          alpha: {
            operation: "add",
            srcFactor: "one",
            dstFactor: "one-minus-src-alpha",
          },
        };

        const edgePipeline = device.createRenderPipeline({
          layout: pipelineLayout,
          vertex: {
            module: edgeShaderModule,
            entryPoint: "vs_main",
            buffers: [
              {
                arrayStride: EDGE_STRIDE_BYTES,
                attributes: [
                  { shaderLocation: 0, offset: 0, format: "float32x2" },
                  { shaderLocation: 1, offset: 2 * BYTES_PER_FLOAT, format: "float32" },
                  { shaderLocation: 2, offset: 3 * BYTES_PER_FLOAT, format: "float32" },
                  { shaderLocation: 3, offset: 4 * BYTES_PER_FLOAT, format: "float32" },
                ],
              },
            ],
          },
          fragment: {
            module: edgeShaderModule,
            entryPoint: "fs_main",
            targets: [{ format, writeMask: GPU_COLOR_WRITE_ALL, blend: blendState }],
          },
          primitive: { topology: "triangle-list", cullMode: "none" },
        });

        const nodePipeline = device.createRenderPipeline({
          layout: pipelineLayout,
          vertex: {
            module: nodeShaderModule,
            entryPoint: "vs_main",
            buffers: [
              {
                arrayStride: NODE_STRIDE_BYTES,
                attributes: [
                  { shaderLocation: 0, offset: 0, format: "float32x2" },
                  { shaderLocation: 1, offset: 2 * BYTES_PER_FLOAT, format: "float32x2" },
                  { shaderLocation: 2, offset: 4 * BYTES_PER_FLOAT, format: "float32x2" },
                  { shaderLocation: 3, offset: 6 * BYTES_PER_FLOAT, format: "float32" },
                  { shaderLocation: 4, offset: 7 * BYTES_PER_FLOAT, format: "float32" },
                ],
              },
            ],
          },
          fragment: {
            module: nodeShaderModule,
            entryPoint: "fs_main",
            targets: [{ format, writeMask: GPU_COLOR_WRITE_ALL, blend: blendState }],
          },
          primitive: { topology: "triangle-list", cullMode: "none" },
        });

        const uniformBuffer = device.createBuffer({
          size: 16,
          usage: GPU_BUFFER_USAGE_UNIFORM | GPU_BUFFER_USAGE_COPY_DST,
        });

        const bindGroup = device.createBindGroup({
          layout: bindGroupLayout,
          entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
        });

        runtimeRef.current = {
          bindGroup,
          context,
          device,
          edgePipeline,
          nodePipeline,
          uniformBuffer,
        };

        if (!disposed) {
          setRuntimeError(null);
          syncCanvasSize();
          draw();
        }
      } catch {
        if (!disposed) {
          setRuntimeError("Failed to initialize WebGPU device.");
        }
      }
    };

    void initialize();

    return () => {
      disposed = true;

      edgeBufferRef.current.buffer?.destroy?.();
      nodeBufferRef.current.buffer?.destroy?.();
      runtimeRef.current?.uniformBuffer?.destroy?.();
      runtimeRef.current?.device?.destroy?.();

      edgeBufferRef.current = { buffer: null, capacityBytes: 0, vertexCount: 0 };
      nodeBufferRef.current = { buffer: null, capacityBytes: 0, vertexCount: 0 };
      runtimeRef.current = null;
    };
  }, [draw, syncCanvasSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      syncCanvasSize();
      draw();
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(canvas.parentElement ?? canvas);
    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [draw, syncCanvasSize]);

  const browserHasWebGpu = typeof navigator !== "undefined" && "gpu" in navigator;
  const statusText = !browserHasWebGpu ? "WebGPU is unavailable in this browser." : runtimeError;

  return (
    <div className={styles.webGpuLayer}>
      <canvas ref={canvasRef} className={styles.webGpuCanvas} />
      {statusText ? <p className={styles.webGpuFallback}>{statusText}</p> : null}
    </div>
  );
};
