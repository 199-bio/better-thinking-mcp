# Better Thinking MCP Server

**Version:** 0.6.4
**Author:** Boris Djordjevic
**Date:** April 5, 2025
**Developed By:** [199 Longevity](https://199.bio)

An MCP server providing the `better_thinking` tool, designed for structured, multi-step reasoning inspired by research into the internal computational mechanisms of Large Language Models (Anthropic Circuits Research, 2025).

## Overview

This server facilitates a more transparent and nuanced reasoning process than simple sequential steps. It encourages articulating the *intermediate concepts*, *parallel considerations*, *planning steps*, *confidence levels*, and *knowledge self-assessments* that might occur during an LLM's internal processing.

The goal is to move beyond just the final output of a thought step and expose more of the underlying "circuitry" of the reasoning process, leading to potentially more robust, verifiable, and faithful results.

## Core Concepts & Philosophy

Inspired by findings from transformer circuit analysis, the `better_thinking` tool encourages modeling reasoning as:

*   **Activation of Intermediate Concepts:** Identifying and stating the key abstract ideas or "features" active at each step (e.g., deriving "State:Texas" before finding its capital).
*   **Parallel Hypothesis Consideration:** Acknowledging and tracking multiple possibilities or competing lines of thought simultaneously.
*   **Explicit Planning:** Articulating not just the goal but candidate steps or endpoints considered during planning (e.g., potential rhyming words).
*   **Knowledge Awareness:** Proactively assessing certainty about specific entities to mitigate hallucination, mimicking internal knowledge checks.
*   **Confidence Signaling:** Explicitly stating the level of certainty in an inference, reflecting internal signal strength or ambiguity.
*   **Reasoning Faithfulness:** Encouraging reflection on *how* a conclusion was reached (e.g., direct calculation vs. heuristic vs. working backward).

## Tool: `better_thinking`

Facilitates a granular, reflective, step-by-step reasoning process designed to simulate internal cognitive steps.

**Parameters:**

*   `thought` (string, required): The core reasoning step, conclusion, or action for this point in the sequence. *Crucially, enrich this with details reflecting internal processing (see guidance below).*
*   `nextThoughtNeeded` (boolean, required): Set to `true` if more steps are needed to reach the final solution. Set to `false` *only* when the entire problem is solved satisfactorily and the reasoning chain supports the conclusion.
*   `thoughtNumber` (integer, required): Current step number (>= 1).
*   `totalThoughts` (integer, required): Current best estimate of the total steps needed (>= 1). Can be adjusted up or down in subsequent calls if complexity changes.
*   `confidence_score` (number, 0.0-1.0, optional): Your explicit confidence in the conclusion or inference presented in the `thought`. Use low scores to signal ambiguity, weak internal signals, or reliance on uncertain heuristics.
*   `knowledge_assessment` (Array of objects `{"entity": string, "status": "known" | "unknown" | "uncertain"}`>, optional): Proactively assess and state your knowledge about key entities involved *before* making factual claims. Use 'unknown' or 'uncertain' to flag potential hallucination risks and override default guessing based on mere familiarity.
*   `isRevision` (boolean, optional): Set to `true` if this step represents an internal belief update, course correction, or refinement based on new information or inferences.
*   `revisesThought` (integer, optional): If `isRevision` is true, specify the `thoughtNumber` being updated.
*   `branchFromThought` (integer, optional): If explicitly exploring an alternative hypothesis or reasoning path discussed earlier, specify the `thoughtNumber` where the divergence occurs.
*   `branchId` (string, optional): A unique identifier for the alternative path initiated by `branchFromThought`.

**Using Parameters Effectively (Key Guidance):**

*   **Enrich the `thought` field:**
    *   **Name Intermediate Concepts:** State abstract concepts derived (e.g., "Intermediate Concept: State:Texas"). Specify relevant *facets* if applicable.
    *   **Acknowledge Parallel Paths:** Mention competing hypotheses or simpler "shortcut" paths considered internally, even if pursuing one primary path.
    *   **Indicate Planning:** Describe *candidate* actions/endpoints considered (e.g., "Plan: Rhyme with 'it'. Candidates: 'rabbit', 'habit'. Selecting 'rabbit' for now...").
    *   **State Calculation/Reasoning Method:** How was the result derived? (Direct calculation? Heuristic/Pattern match? Estimation? Retrieval? Working backward from goal/hint?). Be specific (e.g., "Method: Combined ones-digit heuristic (6+9->5) and magnitude estimate"). This promotes *faithfulness*.
    *   **Note Context Effects:** Mention if low-level factors like grammar, instruction following, or prompt structure heavily influence the step.
*   **Use `confidence_score`:** Reflect internal certainty based on signal strength, conflicts, or knowledge gaps.
*   **Use `knowledge_assessment` Proactively:** Model internal checks *before* asserting facts about entities. Flagging 'unknown'/'uncertain' is key to responsible reasoning.
*   **Use `isRevision` for Belief Updates:** Show how understanding evolves.
*   **Use `branchFromThought` for Parallel Exploration:** Explicitly track alternative lines of reasoning.

## When to Use `better_thinking`

*   Breaking down complex problems where intermediate steps are non-trivial.
*   Tasks requiring explicit planning, hypothesis generation, and testing.
*   Analysis involving uncertainty, multiple possibilities, or confidence assessment.
*   Situations demanding high reasoning transparency or faithfulness checks.
*   Problems where metacognitive awareness (knowing what you don't know) is crucial to avoid errors or hallucinations.
*   Maintaining context and state over extended, multi-step tasks.

## Configuration

### Usage with Claude Desktop (or similar)

Add this to your MCP server configuration (e.g., `claude_desktop_config.json`):

*(Note: Verify the correct NPM package name if published)*

**npx:**

```json
{
  "mcpServers": {
    "better-thinking": {
      "command": "npx",
      "args": [
        "better-thinking-mcp"
      ]
    }
  }
}
```

**Docker:**

```json
{
  "mcpServers": {
    "better-thinking": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "better-thinking-mcp"
      ]
    }
  }
}
```

## Building (Docker)

If building the Docker image locally:

```bash
# Navigate to the directory containing the Dockerfile
docker build -t better-thinking-mcp -f path/to/your/Dockerfile .
```
*(Adjust `-f` path if needed)*

## Development

(Add any relevant notes for contributors or local development setup here if applicable)

*   Install dependencies: `npm install`
*   Compile TypeScript: `npm run build`
*   Run locally: `node dist/server.js` (or via the compiled executable)
*   Lint/Format: `npm run lint`, `npm run format`
## Developed By

This tool was developed as part of the initiatives at **199 Longevity**, a group focused on extending the frontiers of human health and longevity.

Learn more about our work in biotechnology at [199.bio](https://199.bio).

Project contributor: Boris Djordjevic


## License

```
MIT License

Copyright (c) 2025 Boris Djordjevic

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```