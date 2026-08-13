/* ============================================================
   KD mark, extruded and rendered in 3D.

   Real geometry: the mark's two polygons are extruded along Z, the
   faces are projected through a perspective camera, back faces are
   culled, the rest are painter-sorted and flat-shaded against a fixed
   light. Output is SVG polygons — no WebGL context, no library.

   Thirteen faces at 30fps costs nothing. three.js would have been
   several times the weight of the entire app to draw one solid.
   ============================================================ */
(function (global) {
  'use strict';

  /* The two halves take their colour from the live theme rather than
     from constants, so the seal matches whichever accent and palette
     is in force. Flat shading needs real channel values, so the tokens
     are read once per build and parsed to an [r,g,b] triple. */
  function readToken(name, fallback){
    try{
      const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      if(!raw) return fallback;
      if(raw[0] === '#'){
        const h = raw.length === 4
          ? raw.slice(1).split('').map(c => c + c).join('')
          : raw.slice(1);
        const n = parseInt(h, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }
      const m = raw.match(/-?\d+(\.\d+)?/g);
      if(m && m.length >= 3) return m.slice(0, 3).map(v => Math.round(+v));
    }catch(e){ /* fall through */ }
    return fallback;
  }

  // The mark, in its own 18.62 x 11.73 space (see kd-design-system).
  function shapes(){
    return [
      { colour: readToken('--kd-accent', [0x03, 0x39, 0xf8]),
        pts: [[18.62,0],[12,0],[6,5.86],[12,11.73],[18.62,11.73],[12.62,5.86]] },
      { colour: readToken('--kd-text', [0xec, 0xee, 0xf2]),
        pts: [[0,0],[0,11.72],[6,5.86]] }
    ];
  }

  const CX = 9.31, CY = 5.865;   // centre of the mark
  const SCALE = 5.6;             // into viewBox units
  const DEPTH = 13;              // extrusion, post-scale
  // A long lens: barely any perspective distortion, so the mark keeps
  // its proportions instead of ballooning toward the camera.
  const FOCAL = 430;
  const CAM_Z = 360;
  /* Two lights, not one. A single key shades the face down to navy as
     the mark turns away from it, and losing the brand blue at half the
     angles is not acceptable for a logo. Key from the upper left, fill
     from the right, both fairly frontal — so the cap stays near full
     #0339F8 across the whole rock while the extruded sides still fall
     away and carry the depth. */
  const KEY = norm([-0.35, 0.45, 0.85]);
  const FILL = norm([0.6, -0.15, 0.75]);
  const AMBIENT = 0.42, KEY_I = 0.5, FILL_I = 0.28;

  function norm(v){
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0]/l, v[1]/l, v[2]/l];
  }
  function sub(a, b){ return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
  function cross(a, b){
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  }
  function dot(a, b){ return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }

  // Build the solid once: every face as a list of model-space vertices.
  function buildFaces(){
    const faces = [];
    shapes().forEach(shape => {
      // y is flipped — the mark is authored in SVG's y-down space.
      let front = shape.pts.map(([x, y]) =>
        [(x - CX) * SCALE, -(y - CY) * SCALE, DEPTH / 2]);

      // Winding has to be counter-clockwise or every outward normal comes
      // out inverted: the front cap gets culled, the back cap survives,
      // and the mark renders mirrored. The flip above reverses whatever
      // the source polygon used, so check rather than assume.
      let area = 0;
      for(let i = 0; i < front.length; i++){
        const a = front[i], b = front[(i + 1) % front.length];
        area += a[0] * b[1] - b[0] * a[1];
      }
      if(area < 0) front = front.slice().reverse();

      const back = front.map(p => [p[0], p[1], -DEPTH / 2]);
      const n = front.length;

      faces.push({ v: front, colour: shape.colour });
      faces.push({ v: back.slice().reverse(), colour: shape.colour });
      for(let i = 0; i < n; i++){
        const j = (i + 1) % n;
        faces.push({ v: [front[i], front[j], back[j], back[i]], colour: shape.colour });
      }
    });
    return faces;
  }

  function rotate(p, ax, ay){
    const cy = Math.cos(ay), sy = Math.sin(ay);
    let x = p[0] * cy + p[2] * sy;
    let z = -p[0] * sy + p[2] * cy;
    const cx = Math.cos(ax), sx = Math.sin(ax);
    let y = p[1] * cx - z * sx;
    z = p[1] * sx + z * cx;
    return [x, y, z];
  }

  function shade(colour, normal){
    const k = Math.max(0, dot(normal, KEY));
    const f = Math.max(0, dot(normal, FILL));
    const lambert = Math.min(1, AMBIENT + KEY_I * k + FILL_I * f);
    const spec = Math.pow(k, 16) * 70; // a little sheen so it reads as solid
    const c = colour.map(v => Math.min(255, Math.round(v * lambert + spec)));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  function create(svg){
    const faces = buildFaces();
    const nodes = faces.map(() => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      svg.appendChild(el);
      return el;
    });

    let ay = 0, ax = 0.26, t = 0;
    let raf = null, last = 0, running = false;

    function draw(){
      const drawn = faces.map((face, i) => {
        const v = face.v.map(p => rotate(p, ax, ay));
        const normal = norm(cross(sub(v[1], v[0]), sub(v[2], v[0])));

        // Back-face cull against the view direction at the face centre.
        const mid = v.reduce((a, p) => [a[0]+p[0], a[1]+p[1], a[2]+p[2]], [0,0,0])
                     .map(c => c / v.length);
        const view = norm([-mid[0], -mid[1], CAM_Z - mid[2]]);
        if(dot(normal, view) <= 0) return { i, hidden: true };

        let pts = '';
        for(const p of v){
          const s = FOCAL / Math.max(1, CAM_Z - p[2]);
          pts += `${(p[0] * s).toFixed(2)},${(-p[1] * s).toFixed(2)} `;
        }
        return { i, pts, z: mid[2], fill: shade(face.colour, normal) };
      });

      // Painter's algorithm — furthest first. Appending in sorted order
      // moves each node to the end, so the DOM ends up in exactly this
      // sequence; inserting by index instead would shift the positions
      // of the nodes still to be placed.
      drawn.sort((a, b) => (a.hidden ? -1e9 : a.z) - (b.hidden ? -1e9 : b.z));
      drawn.forEach(d => {
        const el = nodes[d.i];
        if(d.hidden) el.setAttribute('points', '');
        else {
          el.setAttribute('points', d.pts);
          el.setAttribute('fill', d.fill);
        }
        svg.appendChild(el);
      });
    }

    // It rocks rather than spins. A full rotation takes the mark
    // edge-on and through its own mirror image, where it stops being
    // the mark — this keeps it legible at every frame and reads as a
    // solid object catching the light.
    function applyPose(){
      ay = Math.sin(t) * 0.65;
      ax = 0.2 + Math.sin(t * 0.6) * 0.11;
    }

    function frame(now){
      if(!running) return;
      if(now - last > 33){ // ~30fps is plenty and halves the wake-ups
        t += 0.018;
        applyPose();
        draw();
        last = now;
      }
      raf = requestAnimationFrame(frame);
    }

    return {
      start(){
        if(running) return;
        running = true;
        raf = requestAnimationFrame(frame);
      },
      stop(){
        running = false;
        if(raf) cancelAnimationFrame(raf);
        raf = null;
      },
      // A single pose, for prefers-reduced-motion.
      still(){ t = 0.6; applyPose(); draw(); },
      // Test hook: render one deterministic angle.
      pose(nextT){ t = nextT; applyPose(); draw(); }
    };
  }

  global.KDMark3D = { create };
})(window);
