import { dump, DumpOptions } from "js-yaml"

// Matches `kubectl get -o yaml`: alphabetical keys, no folded scalars.
export const YAML_DUMP_OPTS: DumpOptions = {
  lineWidth: -1,
  sortKeys: true,
  noRefs: true,
  indent: 2,
}

export function dumpYaml(obj: unknown): string {
  return dump(obj, YAML_DUMP_OPTS)
}
