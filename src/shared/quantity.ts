// Parsers and formatters for Kubernetes resource quantities. Shared because
// main sums per-container usage into a pod total while the renderer formats
// the same numbers — one parser keeps the two from disagreeing.

/**
 * Quantities as the API server writes them: `n`/`u`/`m` suffixes for CPU,
 * plain digits for whole cores. metrics-server reports nanocores (`n`),
 * `.status.allocatable` reports millicores or cores.
 */
export function parseCpuToNanocores(cpu: string): number {
  if (!cpu) return 0
  if (cpu.endsWith("n")) return parseFloat(cpu) || 0
  if (cpu.endsWith("u")) return Math.round((parseFloat(cpu) || 0) * 1e3)
  if (cpu.endsWith("m")) return Math.round((parseFloat(cpu) || 0) * 1e6)
  return Math.round((parseFloat(cpu) || 0) * 1e9)
}

const MEMORY_SUFFIXES: [string, number][] = [
  ["Ki", 1024],
  ["Mi", 1024 ** 2],
  ["Gi", 1024 ** 3],
  ["Ti", 1024 ** 4],
  ["Pi", 1024 ** 5],
  ["k", 1000],
  ["M", 1000 ** 2],
  ["G", 1000 ** 3],
  ["T", 1000 ** 4],
  ["P", 1000 ** 5],
]

export function parseMemoryToBytes(mem: string): number {
  if (!mem) return 0
  for (const [suffix, mult] of MEMORY_SUFFIXES) {
    if (mem.endsWith(suffix)) return (parseFloat(mem) || 0) * mult
  }
  return parseFloat(mem) || 0
}

const STORAGE_SUFFIXES: Record<string, number> = {
  Ki: 1024,
  Mi: 1024 ** 2,
  Gi: 1024 ** 3,
  Ti: 1024 ** 4,
  Pi: 1024 ** 5,
  Ei: 1024 ** 6,
  k: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
  P: 1e15,
  E: 1e18,
}

const STORAGE_QUANTITY_RE = /^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti|Pi|Ei|k|M|G|T|P|E)?$/

/**
 * Strict quantity parse: null for anything that is not a quantity, unlike
 * `parseMemoryToBytes`, which reads 0 out of junk because its callers are
 * rendering gauges. A value on its way to the API server — a PVC's new size —
 * has to tell "0" and "nonsense" apart, and comparing sizes as strings would
 * let `9Gi` look larger than `10Gi`.
 */
export function parseStorageQuantity(value: string): number | null {
  const match = STORAGE_QUANTITY_RE.exec(value.trim())
  if (!match) return null
  const [, digits, suffix] = match
  return Number(digits) * (suffix ? STORAGE_SUFFIXES[suffix] : 1)
}

/** Cores with enough precision to stay non-zero for idle pods. */
export function formatCores(nanocores: number): string {
  const cores = nanocores / 1e9
  if (cores >= 1) return cores.toFixed(2)
  if (cores >= 0.001) return cores.toFixed(3)
  return cores.toFixed(4)
}

export function formatMemory(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} Gi`
  return `${(bytes / 1024 ** 2).toFixed(0)} Mi`
}

/** Millicores, the unit `kubectl top` prints. */
export function formatMillicores(nanocores: number): string {
  return `${Math.round(nanocores / 1e6)}m`
}

/** The full quantity grammar the API server accepts: decimal SI (`n` … `E`),
 *  binary (`Ki` … `Ei`), or scientific notation. Wider than
 *  `parseStorageQuantity`, which only covers the byte-sized suffixes a volume
 *  can carry — an HPA target is just as often `100m` of CPU. */
const QUANTITY_RE =
  /^(\d+(?:\.\d+)?|\.\d+)(Ki|Mi|Gi|Ti|Pi|Ei|[numkMGTPE]|[eE][+-]?\d+)?$/

/**
 * Whether a string is a quantity the API server will take as a metric target.
 * Targets have to be above zero — an HPA dividing by a zero target is
 * rejected — so `0` and `0Mi` are refused along with junk.
 */
export function isPositiveQuantity(value: string): boolean {
  const match = QUANTITY_RE.exec(value.trim())
  if (!match) return false
  return Number(match[1]) > 0
}
