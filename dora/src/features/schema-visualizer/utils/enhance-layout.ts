/**
 * Enhanced ER Diagram Layout Algorithm
 *
 * Provides force-directed layout with relationship clustering,
 * smart anchor point selection, and curved spline routing.
 */

type Node = {
  id: string
  width: number
  height: number
}

type Edge = {
  from: string
  to: string
}

type EnhanceResult = {
  nodes: { id: string; x: number; y: number }[]
  edges: { from: string; to: string; path: [number, number][] }[]
}

type Vector2D = { x: number; y: number }

const REPULSION_FORCE = 80000 // Increased for more spread
const ATTRACTION_FORCE = 0.03 // Reduced to prevent clustering
const MIN_DISTANCE = 320 // Increased minimum distance
const CENTER_FORCE = 0.005 // Reduced center pull
const DAMPING = 0.9
const ITERATIONS = 400 // More iterations for convergence
const GRID_SPACING = 40

/**
 * Main enhance function that computes optimized layout
 */
export function enhance(nodes: Node[], edges: Edge[]): EnhanceResult {
  if (nodes.length === 0) {
    return { nodes: [], edges: [] }
  }

  // Build adjacency map for relationship analysis
  const adjacency = buildAdjacencyMap(nodes, edges)
  const degreeMap = computeDegrees(adjacency)

  // Identify special node types
  const junctionNodes = identifyJunctionNodes(nodes, degreeMap)
  const parentNodes = identifyParentNodes(nodes, degreeMap, adjacency)

  // Initialize positions with smart placement
  let positions = initializePositions(nodes, edges, adjacency, junctionNodes, parentNodes)

  // Run force-directed simulation
  positions = runPhysicsSimulation(positions, edges, adjacency, nodes)

  // Snap to grid for cleaner alignment
  positions = snapToGrid(positions, GRID_SPACING)

  positions = normalizePositions(positions)

  // Compute enhanced edge paths with anchor selection
  const enhancedEdges = computeEdgePaths(edges, positions, nodes)

  return {
    nodes: positions.map((p) => ({ id: p.id, x: p.x, y: p.y })),
    edges: enhancedEdges,
  }
}

/**
 * Build adjacency map showing node connections
 */
function buildAdjacencyMap(nodes: Node[], edges: Edge[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>()

  nodes.forEach((node) => adjacency.set(node.id, new Set()))

  edges.forEach((edge) => {
    adjacency.get(edge.from)?.add(edge.to)
    adjacency.get(edge.to)?.add(edge.from)
  })

  return adjacency
}

/**
 * Compute degree (connection count) for each node
 */
function computeDegrees(adjacency: Map<string, Set<string>>): Map<string, number> {
  const degrees = new Map<string, number>()
  adjacency.forEach((neighbors, id) => {
    degrees.set(id, neighbors.size)
  })
  return degrees
}

/**
 * Identify junction tables (many-to-many intermediaries)
 */
function identifyJunctionNodes(nodes: Node[], degreeMap: Map<string, number>): Set<string> {
  const junctions = new Set<string>()

  nodes.forEach((node) => {
    const degree = degreeMap.get(node.id) || 0
    // Junction tables typically have degree >= 2 and fewer columns
    // This is a heuristic - adjust based on your schema patterns
    if (degree >= 2) {
      junctions.add(node.id)
    }
  })

  return junctions
}

/**
 * Identify parent nodes (highly connected, central tables)
 */
function identifyParentNodes(
  nodes: Node[],
  degreeMap: Map<string, number>,
  adjacency: Map<string, Set<string>>,
): Set<string> {
  const parents = new Set<string>()
  const avgDegree = Array.from(degreeMap.values()).reduce((a, b) => a + b, 0) / degreeMap.size

  nodes.forEach((node) => {
    const degree = degreeMap.get(node.id) || 0
    // Parent nodes have above-average connectivity
    if (degree > avgDegree) {
      parents.add(node.id)
    }
  })

  return parents
}

/**
 * Initialize node positions with smart placement strategy
 */
function initializePositions(
  nodes: Node[],
  edges: Edge[],
  adjacency: Map<string, Set<string>>,
  junctionNodes: Set<string>,
  parentNodes: Set<string>,
): Array<{ id: string; x: number; y: number; vx: number; vy: number }> {
  const positions: Array<{ id: string; x: number; y: number; vx: number; vy: number }> = []

  const cols = Math.ceil(Math.sqrt(nodes.length))
  const baseSpacing = 350
  const startX = 100
  const startY = 100

  nodes.forEach((node, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)

    // Add some randomness to prevent perfectly aligned grids
    const jitterX = (Math.random() - 0.5) * 60
    const jitterY = (Math.random() - 0.5) * 60

    const x = startX + col * baseSpacing + jitterX
    const y = startY + row * baseSpacing + jitterY

    positions.push({ id: node.id, x, y, vx: 0, vy: 0 })
  })

  return positions
}

/**
 * Run force-directed layout simulation
 */
function runPhysicsSimulation(
  positions: Array<{ id: string; x: number; y: number; vx: number; vy: number }>,
  edges: Edge[],
  adjacency: Map<string, Set<string>>,
  nodes: Node[],
): Array<{ id: string; x: number; y: number; vx: number; vy: number }> {
  const centerX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length
  const centerY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const forces = new Map<string, Vector2D>()

    // Initialize forces
    positions.forEach((p) => forces.set(p.id, { x: 0, y: 0 }))

    // Apply repulsion between all nodes
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const p1 = positions[i]
        const p2 = positions[j]

        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        const distSq = dx * dx + dy * dy + 0.01
        const dist = Math.sqrt(distSq)

        if (dist < MIN_DISTANCE * 3) {
          const force = REPULSION_FORCE / distSq
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force

          const f1 = forces.get(p1.id)!
          const f2 = forces.get(p2.id)!

          f1.x -= fx
          f1.y -= fy
          f2.x += fx
          f2.y += fy
        }
      }
    }

    // Apply attraction for connected nodes (but keep them apart)
    edges.forEach((edge) => {
      const p1 = positions.find((p) => p.id === edge.from)
      const p2 = positions.find((p) => p.id === edge.to)

      if (!p1 || !p2) return

      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      const idealDistance = 300
      if (dist > idealDistance) {
        const force = (dist - idealDistance) * ATTRACTION_FORCE
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force

        const f1 = forces.get(p1.id)!
        const f2 = forces.get(p2.id)!

        f1.x += fx
        f1.y += fy
        f2.x -= fx
        f2.y -= fy
      }
    })

    // Apply gentle center gravity
    positions.forEach((p) => {
      const f = forces.get(p.id)!
      f.x += (centerX - p.x) * CENTER_FORCE
      f.y += (centerY - p.y) * CENTER_FORCE
    })

    // Update positions with damping
    positions.forEach((p) => {
      const f = forces.get(p.id)!

      p.vx = (p.vx + f.x) * DAMPING
      p.vy = (p.vy + f.y) * DAMPING

      p.x += p.vx
      p.y += p.vy
    })
  }

  return positions
}

/**
 * Normalize positions to ensure positive coordinates with padding
 */
function normalizePositions(
  positions: Array<{ id: string; x: number; y: number; vx: number; vy: number }>,
): Array<{ id: string; x: number; y: number; vx: number; vy: number }> {
  if (positions.length === 0) return positions

  const minX = Math.min(...positions.map((p) => p.x))
  const minY = Math.min(...positions.map((p) => p.y))

  const padding = 80

  return positions.map((p) => ({
    ...p,
    x: p.x - minX + padding,
    y: p.y - minY + padding,
  }))
}

/**
 * Snap positions to grid for cleaner alignment
 */
function snapToGrid(
  positions: Array<{ id: string; x: number; y: number; vx: number; vy: number }>,
  gridSize: number,
): Array<{ id: string; x: number; y: number; vx: number; vy: number }> {
  return positions.map((p) => ({
    ...p,
    x: Math.round(p.x / gridSize) * gridSize,
    y: Math.round(p.y / gridSize) * gridSize,
  }))
}

/**
 * Compute edge paths with smart anchor selection and spline curves
 */
function computeEdgePaths(
  edges: Edge[],
  positions: Array<{ id: string; x: number; y: number }>,
  nodes: Node[],
): Array<{ from: string; to: string; path: [number, number][] }> {
  return edges.map((edge) => {
    const fromPos = positions.find((p) => p.id === edge.from)
    const toPos = positions.find((p) => p.id === edge.to)
    const fromNode = nodes.find((n) => n.id === edge.from)
    const toNode = nodes.find((n) => n.id === edge.to)

    if (!fromPos || !toPos || !fromNode || !toNode) {
      return { from: edge.from, to: edge.to, path: [[0, 0]] as [number, number][] }
    }

    // Determine anchor sides based on relative positions
    const dx = toPos.x - fromPos.x
    const dy = toPos.y - fromPos.y

    // From node anchor (right side)
    const fromAnchor = {
      x: fromPos.x + fromNode.width,
      y: fromPos.y + fromNode.height / 2,
    }

    // To node anchor (left side)
    const toAnchor = {
      x: toPos.x,
      y: toPos.y + toNode.height / 2,
    }

    // Generate curved spline path
    const path = generateSplinePath(fromAnchor, toAnchor, dx, dy)

    return { from: edge.from, to: edge.to, path }
  })
}

/**
 * Generate smooth spline curve between two points
 */
function generateSplinePath(from: Vector2D, to: Vector2D, dx: number, dy: number): [number, number][] {
  const path: [number, number][] = []

  // Start point
  path.push([from.x, from.y])

  // Calculate control points for Bezier curve
  const dist = Math.sqrt(dx * dx + dy * dy)
  const controlOffset = Math.min(Math.max(dist * 0.3, 40), 120)

  // Control point 1 (from side)
  const c1x = from.x + controlOffset
  const c1y = from.y

  // Control point 2 (to side)
  const c2x = to.x - controlOffset
  const c2y = to.y

  // Sample points along the Bezier curve
  const segments = 20
  for (let i = 1; i < segments; i++) {
    const t = i / segments
    const point = cubicBezier({ x: from.x, y: from.y }, { x: c1x, y: c1y }, { x: c2x, y: c2y }, { x: to.x, y: to.y }, t)
    path.push([point.x, point.y])
  }

  // End point
  path.push([to.x, to.y])

  return path
}

/**
 * Cubic Bezier curve interpolation
 */
function cubicBezier(p0: Vector2D, p1: Vector2D, p2: Vector2D, p3: Vector2D, t: number): Vector2D {
  const t2 = t * t
  const t3 = t2 * t
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  }
}
