# Alpha Hub

Unofficial alphaXiv-powered CLI and library for research agents.

## Install

```bash
npm install -g @advaitpaliwal/alpha-hub
```

If you installed the old scoped package, migrate once:

```bash
npm uninstall -g @companion-ai/alpha-hub
npm install -g @advaitpaliwal/alpha-hub
```

The commands remain `alpha` and `alpha-mcp`. Library consumers should update their dependency and import scope to `@advaitpaliwal/alpha-hub`; export paths such as `/lib` and `/lib/auth` are unchanged.

## Quick Start

```bash
alpha login
alpha status
alpha search "attention mechanism"
alpha get 1706.03762
alpha ask 1706.03762 "What datasets were used for evaluation?"
alpha code https://github.com/openai/gpt-2 /
```

## Package Exports

This package exposes:

- `alpha` CLI
- `alpha-mcp` CLI
- library helpers from `@advaitpaliwal/alpha-hub/lib`

Repository:
https://github.com/advaitpaliwal/alpha-hub

## 0.1.4: personal package and paper-access repairs

- The package moves to `@advaitpaliwal/alpha-hub`; CLI names and library export paths remain compatible.
- Login uses alphaXiv's current OAuth issuer, requests OpenID scopes, and validates callback state.
- Existing search functions use `discover_papers` with array keywords and numeric difficulty instead of removed tools. Combined modes retain their result keys.
- Paper results support current discovery text, legacy text, and structured JSON; paper Q&A uses the maintained `paper`/`queries` payload.
