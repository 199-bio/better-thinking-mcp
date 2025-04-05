#!/usr/bin/env node

/**
 * Main entry point for the Better Thinking MCP Server.
 * This file sets up the MCP server, defines the `better_thinking` tool,
 * and handles requests by delegating the core logic to BetterThinkingToolLogic.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import chalk from 'chalk';

// Import the core logic for the tool from the separate module.
// Note: '.js' extension is needed for NodeNext module resolution compatibility.
import { BetterThinkingToolLogic } from './src/better-thinking-tool.js';

// --- Tool Definition (Metadata and Schema) ---
// This defines how the tool appears to the MCP client (e.g., Claude).
// The detailed description guides the LLM on how to use the tool effectively.
// The schema defines the expected input parameters.
const BETTER_THINKING_TOOL_DEFINITION: Tool = {
  name: "better_thinking",
  description: `A tool for structured, multi-step reasoning that reflects internal cognitive processes observed in LLMs (Anthropic Circuits Research, 2025). Use this to articulate not just conclusions, but the intermediate concepts, parallel considerations, planning hints, confidence levels, knowledge checks, and **goal alignment** involved.

**Goal:** Enhance reasoning transparency, quality, and strategic alignment by using the provided fields to model a more realistic, goal-aware, circuit-inspired thought process.

**Refined Guidance on Using Existing Fields:**

*   **\`thought\` (string, required):** Articulate the core step clearly. Enhance richness by including:
    *   **Reasoning Cluster (Supernode Idea):** Group related internal factors contributing to this step. *(e.g., "Reasoning Cluster (Supports 'Texas'): {Concept: City:Dallas (strong), Concept: Mention of 'South' (medium), Heuristic: Geography (medium)}")*.
    *   **Goal Context:** Briefly state how this step connects to the immediate sub-goal (short-term outcome), contributes to the overall task objective (long-term/final outcome), and fits within the big picture context.
    *   **Progress Assessment:** Indicate if this step successfully achieves a sub-goal or represents clear progress towards the final outcome.
    *   **Calculation/Reasoning Method:** Specify how results were obtained (calculation, heuristic, retrieval, backward reasoning, etc.) for faithfulness. *(e.g., "Method: Parallel Heuristics (ones digit + magnitude estimate)")*.
    *   **Planning/Strategy Notes:** Mention candidate actions/endpoints considered. *(e.g., "Plan: Rhyme with 'it'. Candidates: 'rabbit', 'habit'. Choosing 'rabbit'.")*.
    *   **Considered Alternatives (Simplified):** Note competing hypotheses considered but not pursued in this step lightweightly. *(e.g., "Option A (Chosen): Direct calc. Option B (Considered): Estimation.")*. Reserve \`branchId\` for paths actually explored over multiple steps.
    *   **Intermediate Concepts:** Name key abstract concepts activated or used. *(e.g., "Intermediate Concept Activated: 'State:Texas'")*.
    *   **Context Effects:** Note if low-level factors (grammar, instructions) heavily influence the step.

*   **\`confidence_score\` (number, 0.0-1.0, optional):** Reflect internal certainty in the step's conclusion. Optionally, relate confidence to its perceived effectiveness in advancing towards desired short-term and long-term outcomes.

*   **\`knowledge_assessment\` (Array of {entity, status}, optional):** Proactively model internal knowledge checks *before* asserting facts. Flag entities as 'known', 'unknown', or 'uncertain' to mitigate hallucination. *(e.g., \`[{"entity": "Andrej Karpathy", "status": "uncertain"}]\`)*.

*   **\`isRevision\` / \`revisesThought\` (optional):** Model internal belief updates or course corrections based on new information or inferences.

*   **\`branchFromThought\` / \`branchId\` (optional):** Explicitly model the exploration of parallel, competing hypotheses or strategies *when pursued over subsequent steps*.

*   **\`thoughtNumber\`, \`totalThoughts\`, \`nextThoughtNeeded\` (required):** Manage sequence flow. \`totalThoughts\` estimates steps to the **final outcome**; adjust as needed. \`nextThoughtNeeded=false\` signifies achievement of the **final outcome**, supported by the reasoning chain.

**Overall:** Aim for a granular, reflective, and **goal-oriented** process. Articulate the 'why' (concepts, plans, goals) not just the 'what'. Use optional fields to expose uncertainty, knowledge limits, internal checks, and strategic alignment.`,
  inputSchema: {
    type: "object",
    properties: {
      thought: { type: "string", description: "Core reasoning step, enriched with intermediate concepts, hypotheses, plans, calculation methods, or reflections." },
      nextThoughtNeeded: { type: "boolean", description: "True if more steps needed, False when final answer reached and verified." },
      thoughtNumber: { type: "integer", description: "Current step number (>= 1).", minimum: 1 },
      totalThoughts: { type: "integer", description: "Current estimate of total thoughts needed (>= 1). Adjust as needed.", minimum: 1 },
      confidence_score: { type: "number", minimum: 0, maximum: 1, description: "Confidence (0.0-1.0) in this thought's conclusion, reflecting internal certainty (Optional)." },
      knowledge_assessment: {
        type: "array",
        items: {
          type: "object",
          properties: {
            entity: { type: "string", description: "The specific entity being assessed." },
            status: { type: "string", enum: ['known', 'unknown', 'uncertain'], description: "Internal check: 'known', 'unknown', or 'uncertain'." }
          },
          required: ["entity", "status"]
        },
        description: "Proactive assessment of knowledge about key entities to avoid hallucination (Optional)."
      },
      isRevision: { type: "boolean", description: "True if this represents an internal belief update or correction (Optional)." },
      revisesThought: { type: "integer", description: "If revising, the number of the thought being updated (Optional).", minimum: 1 },
      branchFromThought: { type: "integer", description: "If exploring alternatives, the thought number this diverges from (Optional).", minimum: 1 },
      branchId: { type: "string", description: "Identifier for the alternative exploration branch (Optional)." },
      needsMoreThoughts: { type: "boolean", description: "Deprecated. Use nextThoughtNeeded (Optional)." } // Keep schema for compatibility, logic ignores it
    },
    required: ["thought", "nextThoughtNeeded", "thoughtNumber", "totalThoughts"]
  }
};

// --- Server Setup ---

// Define server metadata
const serverInfo = {
  name: "better-thinking-server",
  version: "0.6.2", // Match package.json version
};

// Create the main MCP Server instance with metadata.
const server = new Server(serverInfo, {
    capabilities: {
      tools: {}, // Tools are dynamically listed via request handler
    },
  }
);

// Instantiate the class containing the actual tool logic.
const toolLogic = new BetterThinkingToolLogic();

// --- Request Handlers ---

// Handles requests from the client to list available tools.
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [BETTER_THINKING_TOOL_DEFINITION], // Return the defined tool
}));

// Handles requests from the client to execute a tool.
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Check if the requested tool name matches our tool.
  if (request.params.name === BETTER_THINKING_TOOL_DEFINITION.name) {
    // Delegate the actual processing to the dedicated logic class instance.
    return toolLogic.processThought(request.params.arguments);
  }

  // Handle calls for unknown tools.
  console.error(chalk.red(`Received call for unknown tool: ${request.params.name}`));
  return {
    content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
    isError: true
  };
});

// --- Run Server ---

/**
 * Initializes the server transport (Stdio) and starts listening for connections.
 */
async function runServer() {
  const transport = new StdioServerTransport(); // Use standard I/O for communication
  await server.connect(transport);
  console.error(chalk.bold.inverse(` Better Thinking MCP Server Running (v${serverInfo.version}) `)); // Log server start to stderr using the constant
}

// Start the server and handle potential fatal errors during startup.
runServer().catch((error) => {
  console.error(chalk.red("❌ Fatal error running server:"), error);
  process.exit(1); // Exit if server fails to start
});