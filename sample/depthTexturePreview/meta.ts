export default {
  name: 'Depth Texture Preview',
  description: `
  This example shows how to render a depth texture.
  [Depth textures are unfilterable](https://www.w3.org/TR/webgpu/#depth-formats).
  Pipelines created with \`layout: 'auto'\` require filterable textures. To render
  with an unfilterable texture requires manually creating bind group layouts to
  mark the sampler binding entry as \`'non-filtered'\` and the texture binding
  entry as \`'unfiltered-float'\`.
  `,
  filename: __DIRNAME__,
  sources: [
    { path: 'main.ts' },
    { path: '../../shaders/basic.vert.wgsl' },
    { path: '../../shaders/vertexPositionColor.frag.wgsl' },
    { path: '../../meshes/cube.ts' },
  ],
};
