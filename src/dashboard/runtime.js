import * as THREE_import from 'three';

// Live-binding lifecycle wrappers. Every dashboard module imports these instead
// of the real globals so listeners, frames, renderers and observers registered
// during a session are torn down when React unmounts the page.
export let signal;
export let document;
export let window;
export let requestAnimationFrame;
export let cancelAnimationFrame;
export let THREE;
export let MutationObserver;

let controller;
let activeAnimationFrames;
let activeRenderers;
let activeObservers;
let originalRequestAnimationFrame;
let originalCancelAnimationFrame;

export function initRuntime() {
  globalThis.window.THREE = THREE_import;

  controller = new AbortController();
  signal = controller.signal;

  activeAnimationFrames = new Set();
  originalRequestAnimationFrame = globalThis.requestAnimationFrame.bind(globalThis);
  originalCancelAnimationFrame = globalThis.cancelAnimationFrame.bind(globalThis);

  requestAnimationFrame = (callback) => {
    const id = originalRequestAnimationFrame((timestamp) => {
      activeAnimationFrames.delete(id);
      callback(timestamp);
    });
    activeAnimationFrames.add(id);
    return id;
  };

  cancelAnimationFrame = (id) => {
    activeAnimationFrames.delete(id);
    originalCancelAnimationFrame(id);
  };

  activeRenderers = new Set();
  THREE = {
    ...THREE_import,
    WebGLRenderer: class extends THREE_import.WebGLRenderer {
      constructor(...args) {
        super(...args);
        activeRenderers.add(this);
      }
      dispose() {
        activeRenderers.delete(this);
        super.dispose();
      }
    }
  };

  activeObservers = new Set();
  MutationObserver = class extends globalThis.MutationObserver {
    constructor(...args) {
      super(...args);
      activeObservers.add(this);
    }
    disconnect() {
      activeObservers.delete(this);
      super.disconnect();
    }
  };

  document = new Proxy(globalThis.document, {
    get(target, prop) {
      if (prop === 'addEventListener') {
        return (type, listener, options) => {
          if (type === 'DOMContentLoaded') {
            // Trigger immediately since DOM is already parsed/hydrated
            setTimeout(listener, 0);
            return;
          }
          const opts = typeof options === 'object' ? { signal, ...options } : { signal };
          target.addEventListener(type, listener, opts);
        };
      }
      const val = target[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    }
  });

  window = new Proxy(globalThis.window, {
    get(target, prop) {
      if (prop === 'addEventListener') {
        return (type, listener, options) => {
          const opts = typeof options === 'object' ? { signal, ...options } : { signal };
          target.addEventListener(type, listener, opts);
        };
      }
      const val = target[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    }
  });
}

export function disposeRuntime() {
  if (controller) controller.abort();

  if (activeAnimationFrames) {
    activeAnimationFrames.forEach(id => originalCancelAnimationFrame(id));
    activeAnimationFrames.clear();
  }

  if (activeRenderers) {
    activeRenderers.forEach(r => {
      try { r.dispose(); } catch (e) {}
    });
    activeRenderers.clear();
  }

  if (activeObservers) {
    activeObservers.forEach(obs => {
      try { obs.disconnect(); } catch (e) {}
    });
    activeObservers.clear();
  }
}
