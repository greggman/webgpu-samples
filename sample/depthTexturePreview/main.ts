import { mat4, vec3 } from 'wgpu-matrix';

import {
  cubeVertexArray,
  cubeVertexSize,
  cubeUVOffset,
  cubePositionOffset,
  cubeVertexCount,
} from '../../meshes/cube';

import basicVertWGSL from '../../shaders/basic.vert.wgsl';
import vertexPositionColorWGSL from '../../shaders/vertexPositionColor.frag.wgsl';
import textureUnitQuadWGSL from './texturedUnitQuad.wgsl';

const canvas = document.querySelector('canvas') as HTMLCanvasElement;
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

const context = canvas.getContext('webgpu') as GPUCanvasContext;

const devicePixelRatio = window.devicePixelRatio;
canvas.width = canvas.clientWidth * devicePixelRatio;
canvas.height = canvas.clientHeight * devicePixelRatio;
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

context.configure({
  device,
  format: presentationFormat,
  alphaMode: 'premultiplied',
});

// Create a vertex buffer from the cube data.
const verticesBuffer = device.createBuffer({
  size: cubeVertexArray.byteLength,
  usage: GPUBufferUsage.VERTEX,
  mappedAtCreation: true,
});
new Float32Array(verticesBuffer.getMappedRange()).set(cubeVertexArray);
verticesBuffer.unmap();

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module: device.createShaderModule({
      code: basicVertWGSL,
    }),
    buffers: [
      {
        arrayStride: cubeVertexSize,
        attributes: [
          {
            // position
            shaderLocation: 0,
            offset: cubePositionOffset,
            format: 'float32x4',
          },
          {
            // uv
            shaderLocation: 1,
            offset: cubeUVOffset,
            format: 'float32x2',
          },
        ],
      },
    ],
  },
  fragment: {
    module: device.createShaderModule({
      code: vertexPositionColorWGSL,
    }),
    targets: [
      {
        format: presentationFormat,
      },
    ],
  },
  primitive: {
    topology: 'triangle-list',

    // Backface culling since the cube is solid piece of geometry.
    // Faces pointing away from the camera will be occluded by faces
    // pointing toward the camera.
    cullMode: 'back',
  },

  // Enable depth testing so that the fragment closest to the camera
  // is rendered in front.
  depthStencil: {
    depthWriteEnabled: true,
    depthCompare: 'less',
    format: 'depth24plus',
  },
});

const depthTexture = device.createTexture({
  size: [canvas.width, canvas.height],
  format: 'depth24plus',
  usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
});

const depthSampler = device.createSampler({});

const uniformBufferSize = 4 * 16; // 4x4 matrix
const uniformBuffer = device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
const planeMatrix = new Float32Array(16);

const uniformBindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    {
      binding: 0,
      resource: {
        buffer: uniformBuffer,
      },
    },
  ],
});

const depthPreviewBindGroupLayout = device.createBindGroupLayout({
  label: 'unfilterable-bindGroupLayout',
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: {
        minBindingSize: 4 * 4 * 4,
      },
    },
    {
      binding: 1,
      visibility: GPUShaderStage.FRAGMENT,
      sampler: {
        type: 'non-filtering', // <---------
      },
    },
    {
      binding: 2,
      visibility: GPUShaderStage.FRAGMENT,
      texture: {
        sampleType: 'unfilterable-float', // <---------
      },
    },
  ],
});

const depthPreviewPipelineLayout = device.createPipelineLayout({
  bindGroupLayouts: [depthPreviewBindGroupLayout],
});

const planeUniformBufferSize = 4 * 16; // 4x4 matrix
const planeUniformBuffer = device.createBuffer({
  size: planeUniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const depthPreviewUniformBindGroup = device.createBindGroup({
  layout: depthPreviewBindGroupLayout,
  entries: [
    {
      binding: 0,
      resource: {
        buffer: planeUniformBuffer,
      },
    },
    {
      binding: 1,
      resource: depthSampler,
    },
    {
      binding: 2,
      resource: depthTexture.createView(),
    },
  ],
});

const depthPreviewModule = device.createShaderModule({
  code: textureUnitQuadWGSL,
});
const depthPreviewPipeline = device.createRenderPipeline({
  label: 'depth preview pipeline',
  layout: depthPreviewPipelineLayout,
  vertex: {
    module: depthPreviewModule,
  },
  fragment: {
    module: depthPreviewModule,
    targets: [
      {
        format: presentationFormat,
      },
    ],
  },
  primitive: {
    topology: 'triangle-strip',
  },
});

const renderPassDescriptor: GPURenderPassDescriptor = {
  colorAttachments: [
    {
      view: undefined, // Assigned later

      clearValue: [0.5, 0.5, 0.5, 1.0],
      loadOp: 'clear',
      storeOp: 'store',
    },
  ],
  depthStencilAttachment: {
    view: depthTexture.createView(),

    depthClearValue: 1.0,
    depthLoadOp: 'clear',
    depthStoreOp: 'store',
  },
};

const depthPreviewRenderPassDescriptor: GPURenderPassDescriptor = {
  colorAttachments: [
    {
      view: undefined, // Assigned later
      loadOp: 'load',
      storeOp: 'store',
    },
  ],
};

const aspect = canvas.width / canvas.height;
const projectionMatrix = mat4.perspective((2 * Math.PI) / 5, aspect, 1, 100.0);
const modelViewProjectionMatrix = mat4.create();

function getTransformationMatrix() {
  const viewMatrix = mat4.identity();
  mat4.translate(viewMatrix, vec3.fromValues(0, 0, -4), viewMatrix);
  const now = Date.now() / 1000;
  mat4.rotate(
    viewMatrix,
    vec3.fromValues(Math.sin(now), Math.cos(now), 0),
    1,
    viewMatrix
  );

  mat4.multiply(projectionMatrix, viewMatrix, modelViewProjectionMatrix);

  return modelViewProjectionMatrix;
}

function frame() {
  const transformationMatrix = getTransformationMatrix();
  device.queue.writeBuffer(uniformBuffer, 0, transformationMatrix);

  const canvasTexture = context.getCurrentTexture();

  const { width, height } = canvasTexture;
  mat4.ortho(0, width, height, 0, -1, 1, planeMatrix);
  mat4.scale(planeMatrix, [width / 4, height / 4, 1], planeMatrix);
  device.queue.writeBuffer(planeUniformBuffer, 0, planeMatrix);

  const view = canvasTexture.createView();
  renderPassDescriptor.colorAttachments[0].view = view;
  depthPreviewRenderPassDescriptor.colorAttachments[0].view = view;

  const commandEncoder = device.createCommandEncoder();
  {
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.setVertexBuffer(0, verticesBuffer);
    passEncoder.draw(cubeVertexCount);
    passEncoder.end();
  }
  {
    const passEncoder = commandEncoder.beginRenderPass(
      depthPreviewRenderPassDescriptor
    );
    passEncoder.setPipeline(depthPreviewPipeline);
    passEncoder.setBindGroup(0, depthPreviewUniformBindGroup);
    passEncoder.draw(4);
    passEncoder.end();
  }
  device.queue.submit([commandEncoder.finish()]);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
