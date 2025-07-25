"use client";

import dynamic from 'next/dynamic'

const LayoutCanvasClient = dynamic(
  () => import('@/components/layout-canvas-client').then((mod) => mod.LayoutCanvasClient),
  { ssr: false }
)

export default function Home() {
  return <LayoutCanvasClient />;
}
