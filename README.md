# Propagation Viewer

A browser-based HF propagation playground for radio amateurs — a place to *see* what the ionosphere is doing to a signal (skip zones, hop distance, greyline, band-by-band reach) instead of guessing from a solar-flux number and a CQ call that goes unanswered.

**Status: pre-alpha.** This repository is currently just the project's planning scaffolding — there is no application here yet. This README is a placeholder and will be rewritten to describe the shipped product as the build progresses.

## Background

Propagation Viewer is a ground-up rewrite of an RF/HF propagation visualiser feature ("mk1") that shipped inside [Codeplug Studio](https://github.com/pskillen/codeplug-studio), a separate amateur-radio codeplug tool. mk1 proved the idea was worth having but modelled propagation incorrectly; rather than patch it in place, it's being rebuilt as its own product with a physics engine designed against an explicit fidelity spec and a validation harness, and shipped as its own app, independent of Codeplug Studio.

## Planned stack

React + Vite + TypeScript, deployed to Cloudflare Pages — matching Codeplug Studio's stack and look and feel, but as a separate codebase (no shared package).

## Status

No application code yet. Delivery is being planned — repository scaffolding (agent guide, skills, docs layout) is being added incrementally as that planning work starts.
