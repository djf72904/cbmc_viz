export const CHECK_FLAGS = [
  {
    key: "bounds",
    label: "array out of bounds",
    cbmc: "--bounds-check",
    match: (p) => /array_bounds|bounds/i.test(p),
  },
  {
    key: "useFree",
    label: "use freed array",
    cbmc: "--pointer-check",
    match: (p) => /freed|use_after_free|deallocated/i.test(p),
  },
  {
    key: "memLeak",
    label: "memory-leak-check",
    cbmc: "--memory-leak-check",
    match: (p) => /memory[-_ ]leak/i.test(p),
  },
  {
    key: "divZero",
    label: "divide by zero",
    cbmc: "--div-by-zero-check",
    match: (p) => /division[-_ ]by[-_ ]zero|div[-_ ]by[-_ ]zero/i.test(p),
  },
  {
    key: "signOver",
    label: "signed overflow",
    cbmc: "--signed-overflow-check",
    match: (p) => /signed[-_ ]overflow|overflow/i.test(p),
  },
];

export const DEFAULT_CHECKS = CHECK_FLAGS.reduce(
  (acc, f) => ({ ...acc, [f.key]: true }),
  {}
);
