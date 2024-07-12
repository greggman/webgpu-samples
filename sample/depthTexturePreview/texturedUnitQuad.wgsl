struct Uniforms {
  matrix: mat4x4f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(1) texcoord: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) vNdx: u32) -> VSOutput {
  let points = array(
    vec2f(0, 0),
    vec2f(0, 1),
    vec2f(1, 0),
    vec2f(1, 1),
  );
  var vsOut: VSOutput;
  let p = points[vNdx];
  vsOut.position = uni.matrix * vec4f(p, 0, 1);
  vsOut.texcoord = p;
  return vsOut;
}

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var smp: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;

@fragment
fn fs(v: VSOutput) -> @location(0) vec4f {
  return textureSample(tex, smp, v.texcoord);
}