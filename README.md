# Alpha Hub

Research agents hallucinate paper details and forget what they learn in a session. Alpha Hub gives them semantic paper search, AI-generated reports, and persistent annotations — so they get smarter with every task. Search and content powered by [alphaXiv](https://alphaxiv.org).

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

## Quick Start

```bash
npm install -g @alpha-hub/cli
alpha login                        # sign in with alphaXiv
alpha search "attention mechanism" # search papers
alpha get 1706.03762               # fetch paper report
```

## How It Works

Alpha is designed for your coding agent to use (not for you to use!). You can prompt your agent to use it (e.g., "Use the CLI command `alpha` to search for papers on LoRA. Run `alpha` to see how it works.")

**Most of the time, it's simple — search, read, use:**

```bash
alpha search "transformer attention"     # find relevant papers
alpha get 1706.03762                     # fetch AI-generated paper report
# Agent reads the report, understands the paper. Done.
```

**When the agent discovers something useful**, it can annotate locally for next time:

```bash
alpha annotate 1706.03762 "Superseded by Flash Attention for efficiency"

# Next session, the annotation appears automatically on alpha get.
```

**Need to go deeper?** Ask questions about any paper:

```bash
alpha ask 1706.03762 "What datasets were used for evaluation?"
```

## Commands

| Command | Purpose |
|---------|---------|
| `alpha search <query>` | Search papers (semantic, keyword, or agentic) |
| `alpha get <id\|url>` | Fetch paper report + local annotation |
| `alpha ask <id\|url> <question>` | Ask a question about a paper |
| `alpha annotate <id> <note>` | Attach a note to a paper |
| `alpha annotate <id> --clear` | Remove a note |
| `alpha annotate --list` | List all notes |
| `alpha login` | Sign in with alphaXiv |
| `alpha logout` | Sign out |

All commands accept `--json` for machine-readable output.

## Self-Improving Agents

Alpha Hub is designed for a loop where agents get better over time.

**Annotations** are local notes that agents attach to papers. They persist across sessions and appear automatically on future fetches — so agents learn from past experience.

```
  Without Alpha Hub                          With Alpha Hub
  ─────────────────                          ──────────────
  Search the web for papers                  Semantic search via alphaXiv
  Read raw PDFs                              AI-generated paper reports
  Miss context and gotchas                   Agent notes what it learns
  Knowledge forgotten                        ↗ Even smarter next session
  ↻ Repeat next session
```

## Key Features

### Semantic Search

Three search modes — semantic (embedding similarity), keyword (exact terms), and agentic (multi-turn retrieval) — so agents find the right papers regardless of how they phrase the query.

```bash
alpha search "methods for reducing hallucination in LLMs"  # semantic
alpha search "LoRA" --mode keyword                          # keyword
```

### Paper Q&A

Ask questions about any paper without reading the full PDF. The answer is grounded in the paper's actual content.

```bash
alpha ask 2106.09685 "What is the rank used for the low-rank matrices?"
```

### Annotations

Local notes that agents attach to papers — they persist across sessions and appear automatically on future fetches. See the annotation as a gap the agent discovered and recorded so it doesn't repeat the same mistake.

## License

[MIT](LICENSE)
