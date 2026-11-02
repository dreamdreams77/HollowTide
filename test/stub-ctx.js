// A recording stub of CanvasRenderingContext2D for render smoke tests (Node has no canvas).
// Tracks save/restore depth and globalAlpha so tests can assert the renderer leaves the context clean.

export function stubCtx() {
  const calls = { fillText: [], total: 0 };
  const state = { globalAlpha: 1 };
  const grad = () => ({ addColorStop() {} });
  const t = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const target = {
    createLinearGradient: grad,
    createRadialGradient: grad,
    createPattern: () => ({}),
    measureText: (s) => ({ width: String(s).length * 8 }),
    getTransform: () => t,
    fillText: (s) => calls.fillText.push(String(s)),
    save() {
      stack.push(state.globalAlpha);
    },
    restore() {
      state.globalAlpha = stack.pop() ?? 1;
    },
  };
  const stack = [];
  const ctx = new Proxy(target, {
    get(o, k) {
      if (k === 'calls') return calls;
      if (k === 'stackDepth') return stack.length;
      if (k in o) return o[k];
      if (k === 'globalAlpha') return state.globalAlpha;
      if (k in state) return state[k];
      return (...a) => {
        calls.total++;
        void a;
      };
    },
    set(o, k, v) {
      if (k === 'globalAlpha') state.globalAlpha = v;
      else state[k] = v;
      return true;
    },
  });
  return ctx;
}
