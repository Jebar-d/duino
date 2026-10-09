"use client";

import "@google/model-viewer";
import {
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type HTMLAttributes,
  type Ref,
} from "react";

type ModelViewerElement = HTMLElement & {
  cameraOrbit: string;
  getCameraOrbit: () => { theta: number; phi: number; radius: number };
};

type ModelViewerProps = HTMLAttributes<HTMLElement> & {
  ref?: Ref<ModelViewerElement>;
  src: string;
  alt: string;
  cameraControls?: boolean;
  autoRotate?: boolean;
  shadowIntensity?: string;
  exposure?: string;
  interactionPrompt?: string;
  loading?: string;
  reveal?: string;
  poster?: string;
  style?: CSSProperties;
  // model-viewer attributes (kebab-case, passed straight to the element)
  "camera-orbit"?: string;
  "min-camera-orbit"?: string;
  "max-camera-orbit"?: string;
  "field-of-view"?: string;
  "zoom-sensitivity"?: string;
};

const ModelViewer = "model-viewer" as unknown as ComponentType<ModelViewerProps>;

// Start closer than model-viewer's default framing (100% = whole model just
// fits) and allow zooming much further in and a bit further out.
const START_ORBIT = "auto auto 70%";

export default function ProductModelViewer({
  modelUrl,
  productName,
  poster,
}: {
  modelUrl: string;
  productName: string;
  poster: string;
}) {
  const [failed, setFailed] = useState(false);
  const viewerRef = useRef<ModelViewerElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  function zoom(factor: number) {
    const viewer = viewerRef.current;

    if (!viewer) {
      return;
    }

    const { theta, phi, radius } = viewer.getCameraOrbit();
    viewer.cameraOrbit = `${theta}rad ${phi}rad ${radius * factor}m`;
  }

  function reset() {
    if (viewerRef.current) {
      viewerRef.current.cameraOrbit = START_ORBIT;
    }
  }

  function fullscreen() {
    const wrap = wrapRef.current;

    if (!wrap) {
      return;
    }

    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void wrap.requestFullscreen?.();
    }
  }

  if (failed) {
    return (
      <div className="product-model-fallback" role="status">
        This 3D model could not be loaded. Please use the product images instead.
      </div>
    );
  }

  return (
    <div className="product-model-viewer-wrap" ref={wrapRef}>
      <ModelViewer
        ref={viewerRef}
        src={modelUrl}
        alt={`Interactive 3D model of ${productName}`}
        cameraControls
        autoRotate
        shadowIntensity="1"
        exposure="1"
        interactionPrompt="auto"
        loading="eager"
        reveal="auto"
        poster={poster}
        camera-orbit={START_ORBIT}
        min-camera-orbit="auto auto 15%"
        max-camera-orbit="auto auto 250%"
        field-of-view="auto"
        zoom-sensitivity="1.6"
        className="product-model-viewer"
        onError={() => setFailed(true)}
      />

      <div className="product-model-toolbar" role="group" aria-label="3D controls">
        <button type="button" onClick={() => zoom(0.7)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => zoom(1.4)} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={reset} aria-label="Reset view">
          ⟲
        </button>
        <button type="button" onClick={fullscreen} aria-label="Toggle full screen">
          ⛶
        </button>
      </div>

      <p>Drag to rotate. Scroll or pinch to zoom.</p>
    </div>
  );
}
