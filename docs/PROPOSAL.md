# ICViewer Proposal

## One-Line Pitch

ICViewer is an AI-native 3D IC layout review cockpit that combines geometry visualization, engineering metadata, explainable summaries, and review workflows in a deployable web application.

## Problem

Most browser-based geometry viewers stop at rendering. For chip design demos and engineering reviews, that is not enough. Users also need hierarchy context, layer usage, stats, compatibility with common EDA exports, and a faster way to explain what a layout contains.

## Target Users

- ECSE students learning physical design and layout concepts
- hackathon judges who need a clear demo story
- teammates reviewing OpenROAD or Virtuoso-exported artifacts
- educators who want a browser-accessible inspection tool

## Product Thesis

The product should not feel like a prettier file viewer. It should feel like a review cockpit:

- geometry in the center
- actionable engineering context around it
- AI used for explanation and command execution, not empty chat
- compatibility handled through canonical geometry plus sidecars

## Demo Story

1. Upload a design bundle.
2. Show the generated 3D layout.
3. Inspect layers, hierarchy, metrics, and bounding box.
4. Ask the AI to explain the design.
5. Ask the AI operator to focus or isolate important parts.
6. Export or share the review state.
