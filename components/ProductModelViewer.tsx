"use client";

import "@google/model-viewer";
import { useState, type ComponentType, type CSSProperties, type HTMLAttributes } from "react";

type ModelViewerProps = HTMLAttributes<HTMLElement> & {
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
};

const ModelViewer = "model-viewer" as unknown as ComponentType<ModelViewerProps>;

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

  if (failed) {
    return (
      <div className="product-model-fallback" role="status">
        This 3D model could not be loaded. Please use the product images instead.
      </div>
    );
  }

  return (
    <div className="product-model-viewer-wrap">
      <ModelViewer
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
        className="product-model-viewer"
        onError={() => setFailed(true)}
      />
      <p>Drag to rotate. Scroll or pinch to zoom.</p>
    </div>
  );
}
