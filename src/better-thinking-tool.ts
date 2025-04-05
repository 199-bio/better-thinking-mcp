import chalk from 'chalk';

// --- Helper Function ---

/**
 * Removes ANSI escape codes (used for terminal colors) from a string.
 * Useful for calculating the display width of text without color codes.
 * @param str The string potentially containing ANSI codes.
 * @returns The string with ANSI codes removed.
 */
function stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
    return str.replace(ansiRegex, '');
}

// --- Interfaces ---

/**
 * Represents an assessment of the model's internal knowledge about a specific entity.
 */
export interface KnowledgeAssessment {
    /** The specific entity being assessed (e.g., a person, place, concept). */
    entity: string;
    /** The assessed status of knowledge about the entity. */
    status: 'known' | 'unknown' | 'uncertain';
}

/**
 * Represents the data structure for a single step in the better thinking process.
 * Captures the core thought and associated metadata reflecting internal cognitive states.
 */
export interface ThoughtData {
    /** The core reasoning step, conclusion, or action for this point in the sequence. Enriched with details reflecting internal processing. */
    thought: string;
    /** Current step number (>= 1). */
    thoughtNumber: number;
    /** Current best estimate of the total steps needed (>= 1). Can be adjusted. */
    totalThoughts: number;
    /** Set to `true` if more steps are needed; `false` when the entire problem is solved. */
    nextThoughtNeeded: boolean;
    /** Explicit confidence (0.0-1.0) in the conclusion or inference presented in the `thought`. */
    confidence_score?: number;
    /** Proactive assessment of knowledge about key entities involved. */
    knowledge_assessment?: KnowledgeAssessment[];
    /** Set to `true` if this step represents an internal belief update or course correction. */
    isRevision?: boolean;
    /** If `isRevision` is true, specifies the `thoughtNumber` being updated. */
    revisesThought?: number;
    /** If explicitly exploring an alternative path, specifies the `thoughtNumber` where the divergence occurs. */
    branchFromThought?: number;
    /** A unique identifier for the alternative path initiated by `branchFromThought`. */
    branchId?: string;
    /** Deprecated flag, replaced by `nextThoughtNeeded`. */
    needsMoreThoughts?: boolean; // Kept for schema compatibility if needed, but logic uses nextThoughtNeeded
}

// --- Core Tool Logic Class ---

/**
 * Manages the state and processing logic for the `better_thinking` tool.
 * It validates input, maintains thought history (including branches),
 * formats output for display, and returns structured results or errors.
 */
export class BetterThinkingToolLogic {
    private thoughtHistory: ThoughtData[] = [];
    private branches: Record<string, ThoughtData[]> = {}; // Stores parallel reasoning branches

    /**
     * Validates the raw input object against the expected ThoughtData structure.
     * Throws an error if validation fails.
     * @param input Raw input object from the tool call arguments.
     * @returns A validated ThoughtData object.
     * @throws {Error} If any required fields are missing or invalid.
     */
    private validateThoughtData(input: unknown): ThoughtData {
        const data = input as Record<string, unknown>;

        // --- Validation Checks (Required Fields) ---
        if (!data.thought || typeof data.thought !== 'string') {
            throw new Error('Invalid input: `thought` is required and must be a non-empty string.');
        }
        if (typeof data.thoughtNumber !== 'number' || !Number.isInteger(data.thoughtNumber) || data.thoughtNumber < 1) {
            throw new Error('Invalid input: `thoughtNumber` is required and must be a positive integer.');
        }
        if (typeof data.totalThoughts !== 'number' || !Number.isInteger(data.totalThoughts) || data.totalThoughts < 1) {
            throw new Error('Invalid input: `totalThoughts` is required and must be a positive integer.');
        }
        if (typeof data.nextThoughtNeeded !== 'boolean') {
            throw new Error('Invalid input: `nextThoughtNeeded` is required and must be a boolean.');
        }

        // --- Validation Checks (Optional Fields) ---
        let confidence_score: number | undefined = undefined;
        if (data.confidence_score !== undefined) {
            if (typeof data.confidence_score !== 'number' || data.confidence_score < 0 || data.confidence_score > 1) {
                throw new Error('Invalid input: `confidence_score` must be a number between 0.0 and 1.0.');
            }
            confidence_score = data.confidence_score;
        }

        let knowledge_assessment: KnowledgeAssessment[] | undefined = undefined;
        if (data.knowledge_assessment !== undefined) {
            if (!Array.isArray(data.knowledge_assessment)) {
                throw new Error('Invalid input: `knowledge_assessment` must be an array.');
            }
            knowledge_assessment = (data.knowledge_assessment as any[]).map((item, index) => {
                if (typeof item !== 'object' || item === null) {
                    throw new Error(`Invalid item in knowledge_assessment at index ${index}: must be an object.`);
                }
                if (typeof item.entity !== 'string' || !item.entity) {
                    throw new Error(`Invalid item in knowledge_assessment at index ${index}: missing or invalid 'entity' string.`);
                }
                if (!['known', 'unknown', 'uncertain'].includes(item.status)) {
                    throw new Error(`Invalid item in knowledge_assessment at index ${index}: 'status' must be 'known', 'unknown', or 'uncertain'.`);
                }
                return { entity: item.entity, status: item.status as KnowledgeAssessment['status'] };
            });
        }

        const isRevision = typeof data.isRevision === 'boolean' ? data.isRevision : undefined;
        const revisesThought = typeof data.revisesThought === 'number' && Number.isInteger(data.revisesThought) && data.revisesThought >= 1 ? data.revisesThought : undefined;
        const branchFromThought = typeof data.branchFromThought === 'number' && Number.isInteger(data.branchFromThought) && data.branchFromThought >= 1 ? data.branchFromThought : undefined;
        const branchId = typeof data.branchId === 'string' ? data.branchId : undefined;
        const needsMoreThoughts = typeof data.needsMoreThoughts === 'boolean' ? data.needsMoreThoughts : undefined; // Deprecated

        // --- Warnings for potential inconsistencies ---
        if (isRevision && revisesThought === undefined) {
            console.warn(chalk.yellow("Warning: `isRevision` is true but `revisesThought` is missing. Revision context might be unclear."));
        }
        if (branchFromThought && branchId === undefined) {
            console.warn(chalk.yellow("Warning: `branchFromThought` is set but `branchId` is missing. Branch cannot be tracked properly."));
        }
        if (needsMoreThoughts !== undefined) {
             console.warn(chalk.yellow("Warning: `needsMoreThoughts` is deprecated. Use `nextThoughtNeeded` for flow control."));
        }

        // --- Return validated data ---
        return {
            thought: data.thought,
            thoughtNumber: data.thoughtNumber,
            totalThoughts: data.totalThoughts,
            nextThoughtNeeded: data.nextThoughtNeeded,
            confidence_score,
            knowledge_assessment,
            isRevision,
            revisesThought,
            branchFromThought,
            branchId,
            // needsMoreThoughts is intentionally omitted from the returned object
            // as it's deprecated and its logic is handled by nextThoughtNeeded
        };
    }

    /**
     * Formats a ThoughtData object into a human-readable string with borders and colors for console display.
     * @param thoughtData The validated thought data to format.
     * @returns A formatted string representation of the thought.
     */
    private formatThought(thoughtData: ThoughtData): string {
        const { thoughtNumber, totalThoughts, thought, confidence_score, knowledge_assessment, isRevision, revisesThought, branchFromThought, branchId } = thoughtData;

        // Determine prefix and context based on thought type (normal, revision, branch)
        let prefix = chalk.blue('💭 Thought');
        let context = '';
        if (isRevision && revisesThought) {
            prefix = chalk.yellow('🔄 Revision');
            context = ` (revising thought ${revisesThought})`;
        } else if (branchFromThought && branchId) {
            prefix = chalk.green('🌿 Branch');
            context = ` (from thought ${branchFromThought}, ID: ${branchId})`;
        }

        const header = `${prefix} ${thoughtNumber}/${totalThoughts}${context}`;

        // Format optional lines
        const confidenceLine = confidence_score !== undefined
            ? `Confidence: ${chalk.cyan(confidence_score.toFixed(2))}`
            : '';
        const knowledgeLines = knowledge_assessment?.length
            ? 'Knowledge Assessment:\n' + knowledge_assessment.map(ka => `  - ${chalk.yellow(ka.entity)}: ${chalk.magenta(ka.status)}`).join('\n')
            : '';

        // Combine core content lines, filtering out empty ones
        const coreContentLines = [thought, confidenceLine, knowledgeLines].filter(Boolean);

        // Calculate max width for border, considering multi-line content
        const allLinesForWidth = [header, ...coreContentLines.flatMap(line => line.split('\n'))];
        const maxWidth = Math.max(0, ...allLinesForWidth.map(l => stripAnsi(l).length)); // Ensure maxWidth >= 0
        const border = '─'.repeat(maxWidth + 2); // Top/bottom border
        const separator = `├${'·'.repeat(maxWidth + 2)}┤`; // Separator between sections

        // Build the formatted string with borders
        let formatted = `\n┌${border}┐\n│ ${header.padEnd(maxWidth)} │`; // Top border and header

        if (coreContentLines.length > 0) {
             formatted += `\n├${border}┤`; // Separator before main content
             coreContentLines.forEach((line, index) => {
                // Add separator between optional sections (confidence, knowledge)
                if (index > 0 && line !== '' && coreContentLines[index-1] !== '') {
                    formatted += `\n${separator}`;
                }
                // Add each line (or sub-line if it contains newlines) padded within borders
                line.split('\n').forEach(subLine => {
                    formatted += `\n│ ${subLine.padEnd(maxWidth)} │`;
                });
            });
        }

        formatted += `\n└${border}┘`; // Bottom border
        return formatted;
    }

    /**
     * Processes a single thought step.
     * Validates the input, updates history/branches, formats the thought for logging,
     * and returns a structured response for the MCP client.
     * @param input Raw input object from the tool call arguments.
     * @returns An object containing the response content (JSON string) and an optional error flag.
     */
    public processThought(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
        try {
            // 1. Validate the input data
            const validatedInput = this.validateThoughtData(input);

            // 2. Adjust totalThoughts if thoughtNumber exceeds it (flexible total)
            if (validatedInput.thoughtNumber > validatedInput.totalThoughts) {
                console.warn(chalk.yellow(`Warning: thoughtNumber (${validatedInput.thoughtNumber}) exceeds totalThoughts (${validatedInput.totalThoughts}). Adjusting totalThoughts.`));
                validatedInput.totalThoughts = validatedInput.thoughtNumber; // Auto-adjust total
            }

            // 3. Add to main history
            this.thoughtHistory.push(validatedInput);

            // 4. Handle branching logic
            if (validatedInput.branchFromThought && validatedInput.branchId) {
                if (!this.branches[validatedInput.branchId]) {
                    this.branches[validatedInput.branchId] = [];
                    console.error(chalk.green(`🌱 Starting new branch: ${validatedInput.branchId} from thought ${validatedInput.branchFromThought}`));
                }
                this.branches[validatedInput.branchId].push(validatedInput);
            }

            // 5. Format and log the thought to the server console
            const formattedThought = this.formatThought(validatedInput);
            console.error(formattedThought); // Log to stderr to separate from MCP stdout communication

            // 6. Prepare successful response for the client
            const responsePayload = {
                status: 'success',
                thought_number_processed: validatedInput.thoughtNumber,
                current_total_thoughts: validatedInput.totalThoughts,
                next_thought_needed: validatedInput.nextThoughtNeeded,
                active_branches: Object.keys(this.branches),
                total_history_length: this.thoughtHistory.length
            };

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(responsePayload, null, 2) // Pretty-print JSON response
                }]
            };

        } catch (error) {
            // 7. Handle errors during validation or processing
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(chalk.red(`❌ Error processing thought: ${errorMessage}`));

            // 8. Prepare error response for the client
            const errorPayload = {
                status: 'failed',
                error: errorMessage
            };

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(errorPayload, null, 2)
                }],
                isError: true
            };
        }
    }
}