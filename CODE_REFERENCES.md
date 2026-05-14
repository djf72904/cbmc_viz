## Appendix B — Code Links

The complete project is hosted at [github.com/djf72904/cbmc_viz](https://github.com/djf72904/cbmc_viz) and was tested at commit [`3f26fa7`](https://github.com/djf72904/cbmc_viz/tree/3f26fa737e0c42f950a1ec41f65a3ad7ac18ef57). All links below are pinned to that commit.

Files I personally authored:

- **Frontend** — the entire [`frontend/src/`](https://github.com/djf72904/cbmc_viz/tree/3f26fa737e0c42f950a1ec41f65a3ad7ac18ef57/frontend/src) tree, in particular:
  - [`parser.js`](https://github.com/djf72904/cbmc_viz/blob/3f26fa737e0c42f950a1ec41f65a3ad7ac18ef57/frontend/src/parser.js) (254 lines) — CBMC trace parser
  - [`canvas/CFGCanvas.jsx`](https://github.com/djf72904/cbmc_viz/blob/3f26fa737e0c42f950a1ec41f65a3ad7ac18ef57/frontend/src/canvas/CFGCanvas.jsx) (532 lines) — control-flow graph
  - [`canvas/MemoryCanvas.jsx`](https://github.com/djf72904/cbmc_viz/blob/3f26fa737e0c42f950a1ec41f65a3ad7ac18ef57/frontend/src/canvas/MemoryCanvas.jsx) (651 lines) — memory canvas
  - [`App.jsx`](https://github.com/djf72904/cbmc_viz/blob/3f26fa737e0c42f950a1ec41f65a3ad7ac18ef57/frontend/src/App.jsx) (487 lines) — top-level state machine and view orchestration
  - [`components/`](https://github.com/djf72904/cbmc_viz/tree/3f26fa737e0c42f950a1ec41f65a3ad7ac18ef57/frontend/src/components) — step list, source view, side panels, app header, samples menu, source sheet, trace controls, empty state, checks bar, history dropdown
  - [`lib/`](https://github.com/djf72904/cbmc_viz/tree/3f26fa737e0c42f950a1ec41f65a3ad7ac18ef57/frontend/src/lib) — `api.js`, `history.js`, `highlight.js`, `utils.js`
- **API specification** — [`backend/API.md`](https://github.com/djf72904/cbmc_viz/blob/3f26fa737e0c42f950a1ec41f65a3ad7ac18ef57/backend/API.md) (220 lines)
- **API test suite** — [`tests/run_api_tests.sh`](https://github.com/djf72904/cbmc_viz/blob/3f26fa737e0c42f950a1ec41f65a3ad7ac18ef57/tests/run_api_tests.sh) (350 lines, 40 cases)
- **Node reference backend (development aid)** — [`server/index.js`](https://github.com/djf72904/cbmc_viz/blob/3f26fa737e0c42f950a1ec41f65a3ad7ac18ef57/server/index.js) (402 lines), superseded by Dylan's [`backend/`](https://github.com/djf72904/cbmc_viz/tree/3f26fa737e0c42f950a1ec41f65a3ad7ac18ef57/backend) Spring Boot implementation

**Final team deliverable.** The full repository at [github.com/djf72904/cbmc_viz](https://github.com/djf72904/cbmc_viz).
