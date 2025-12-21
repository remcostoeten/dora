"use client"

import { useCallback, type RefObject } from "react"

export function useExport(canvasRef: RefObject<HTMLDivElement | null>) {
  const exportToPng = useCallback(async () => {
    if (!canvasRef.current) return

    // TODO: Tauri invoke - export_schema_to_png
    // For now, use html2canvas fallback (would need to be added as dependency)
    console.log("[Schema Visualizer] Exporting to PNG...")

    try {
      // Dynamic import for html2canvas when available
      const html2canvas = (await import("html2canvas")).default
      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: "#1a1a1e",
        scale: 2,
      })

      const link = document.createElement("a")
      link.download = `schema-${Date.now()}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    } catch (err) {
      // Fallback: alert user that export needs Tauri
      console.log("[Schema Visualizer] PNG export requires Tauri backend or html2canvas")
      alert("PNG export will be available in the Tauri desktop app")
    }
  }, [canvasRef])

  const exportToSvg = useCallback(async () => {
    if (!canvasRef.current) return

    // TODO: Tauri invoke - export_schema_to_svg
    console.log("[Schema Visualizer] Exporting to SVG...")

    try {
      // Create SVG from DOM structure
      const svgNs = "http://www.w3.org/2000/svg"
      const svg = document.createElementNS(svgNs, "svg")
      const bounds = canvasRef.current.getBoundingClientRect()

      svg.setAttribute("width", String(bounds.width))
      svg.setAttribute("height", String(bounds.height))
      svg.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`)

      // Add background
      const bg = document.createElementNS(svgNs, "rect")
      bg.setAttribute("width", "100%")
      bg.setAttribute("height", "100%")
      bg.setAttribute("fill", "#1a1a1e")
      svg.appendChild(bg)

      // Serialize to string
      const serializer = new XMLSerializer()
      const svgString = serializer.serializeToString(svg)
      const blob = new Blob([svgString], { type: "image/svg+xml" })
      const url = URL.createObjectURL(blob)

      const link = document.createElement("a")
      link.download = `schema-${Date.now()}.svg`
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.log("[Schema Visualizer] SVG export error:", err)
      alert("SVG export will be available in the Tauri desktop app")
    }
  }, [canvasRef])

  return { exportToPng, exportToSvg }
}
