"use client";

import "@google/model-viewer";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type HTMLAttributes,
  type Ref,
} from "react";
import {
  getLegacyProductAssetUrl,
  getPreferredProductModelUrl,
} from "../lib/product-assets";

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
  const [activeModelUrl, setActiveModelUrl] = useState(() =>
    getPreferredProductModelUrl(modelUrl),
  );
  const [failedModelUrl, setFailedModelUrl] = useState<string | null>(null);
  const warnedModelUrls = useRef(new Set<string>());
  const viewerRef = useRef<ModelViewerElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const handleModelError = useCallback(() => {
    if (activeModelUrl === modelUrl) {
      const legacyUrl = getLegacyProductAssetUrl(modelUrl);

      if (legacyUrl) {
        setActiveModelUrl(legacyUrl);
        return;
      }
    }

    setFailedModelUrl(modelUrl);

    if (!warnedModelUrls.current.has(activeModelUrl)) {
      console.warn("Unable to load 3D model:", activeModelUrl);
      warnedModelUrls.current.add(activeModelUrl);
    }
  }, [activeModelUrl, modelUrl]);

  useEffect(() => {
    const viewer = viewerRef.current;

    if (!viewer) {
      return;
    }

    viewer.addEventListener("error", handleModelError);

    return () => {
      viewer.removeEventListener("error", handleModelError);
    };
  }, [handleModelError]);

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

  if (failedModelUrl === modelUrl) {
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
        src={activeModelUrl}
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
      />

      <div className="product-model-toolbar" role="group" aria-label="3D controls">
        <button type="button" onClick={() => zoom(0.7)} aria-label="Zoom in" title="Zoom in"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M10.5 7v7M7 10.5h7M16 16l5 5"/></svg></button>
        <button type="button" onClick={() => zoom(1.4)} aria-label="Zoom out" title="Zoom out"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M7 10.5h7M16 16l5 5"/></svg></button>
        <button type="button" onClick={reset} aria-label="Reset view" title="Reset view"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 11a8 8 0 1 1 2.3 5.7M4 4v7h7"/><path d="M12 7v5l3 2"/></svg></button>
        <button type="button" onClick={fullscreen} aria-label="Toggle full screen" title="Toggle full screen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg></button>
      </div>
      <p>Drag to rotate. Scroll or pinch to zoom.</p>
    </div>
  );
}
