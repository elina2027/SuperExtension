# Word Gap Highlighter Extension

## Features
- Enter `Word1`, `Gap`, and `Word2` in the popup.
- Highlights all occurrences on the page where `Word1` and `Word2` are separated by at most `Gap` words.
- Highlight spans from `Word1` to `Word2` in yellow.
- Core matching logic is implemented in C++ and compiled to WebAssembly (Wasm).

## Build Instructions

### 1. Prerequisites
- [Emscripten](https://emscripten.org/docs/getting_started/downloads.html) installed and activated.

### 2. Build the C++ Core to Wasm

```
# From the project root
mkdir -p cpp wasm
emcc cpp/matcher.cpp -O3 -s WASM=1 -s MODULARIZE=1 -s 'EXPORT_NAME="MatcherModule"' -o cpp/matcher.js -lembind
mv cpp/matcher.wasm wasm/matcher.wasm
```

### 3. Load the Extension
- Open Chrome > Extensions > Load unpacked > select this folder.

## Development Notes
- The highlighting logic walks the DOM and wraps matches in `<span class="word-gap-highlight">`.
- To rebuild after C++ changes, rerun the Emscripten build step above. 