#!/bin/sh
export PATH="$HOME/.local/node/bin:$PATH"
cd "/Users/chloeenglish/Desktop/claude code/warmup-test-march-collapse" || exit 1
exec npm run dev -- --port 5175 --strictPort
