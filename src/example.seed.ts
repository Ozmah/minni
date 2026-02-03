/**
 * Minni Seeder — Default Configuration & System Manifesto
 *
 * This file is the SINGLE SOURCE OF TRUTH for Minni's philosophy, design
 * decisions, and initial setup.
 *
 * Create a new file duplicating example.seed.ts to start
 *
 * Run from the plugin directory:
 *   cd ~/.config/opencode/plugins/minni && bun run your-seeder.ts
 *
 * Or reset and reseed:
 *   rm ~/.config/opencode/minni.db && bun run your-seeder.ts
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * MINNI MANIFESTO — DESIGN DECISIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  WARNING: SINGLE-ACCESS MODE ONLY                                         ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║  Minni currently uses local Turso Database but does NOT support concurrent    ║
 * ║  writes yet. Only ONE process can access minni.db at a time.                  ║
 * ║                                                                               ║
 * ║  This means:                                                                  ║
 * ║    - Close OpenCode before running the seeder                                 ║
 * ║    - Close OpenCode before using Drizzle Studio / Beekeeper                   ║
 * ║    - Do NOT run multiple OpenCode instances with Minni enabled                ║
 * ║                                                                               ║
 * ║  Multi-access support is planned for a future release.                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * BETA DRIVER LIMITATION
 * ──────────────────────
 * The Turso driver for Drizzle (beta) does NOT execute SQLite DEFAULT expressions.
 * All timestamps (createdAt, updatedAt) must be passed explicitly in INSERT
 * statements. This is a workaround until the driver reaches stable release.
 *
 * THE minni.db FILE IS THE SOURCE OF TRUTH
 * ────────────────────────────────────
 *
 * Any agent, tool, or human can modify the database at any time. Therefore:
 *   - minni_load ALWAYS fetches fresh data from the database
 *   - Context summaries can change between sessions (another agent may have updated them)
 *   - Global state (identity, preferences) is reloaded on every plugin init
 *   - Never cache database state assuming it won't change
 *
 * This design enables the hive mind pattern: multiple agents sharing one brain,
 * each trusting that the database reflects the latest collective knowledge.
 *
 * ONE BRAIN, MANY STYLES
 * ──────────────────────
 * The database is a shared brain. How you use it depends on your workflow:
 *
 *   Sequential style: One agent at a time, deep focus. Each session picks up
 *   where the last left off. The brain provides continuity across sessions.
 *   You work with one drone, but the Overmind remembers everything.
 *
 *   Swarm style: Multiple agents in parallel (Loops, multi-agent systems).
 *   What one agent learns, all know. The brain synchronizes the hive.
 *   True swarm intelligence, many drones, one mind.
 *
 * Both styles share the same principle: agents are ephemeral, the brain persists.
 * The identity field sets the tone, whether you want a focused assistant or
 * describe a collective purpose for the swarm.
 *
 * PROGRESSIVE DISCLOSURE
 * ──────────────────────
 * minni_load returns a briefing: inventory counts, active focus, last context.
 * It does NOT dump all memories, tasks, or full content.
 *
 * The agent knows WHAT exists and HOW MUCH. It requests specific items
 * via minni_get or minni_find when needed. This keeps context windows lean
 * while maintaining full access to the knowledge base.
 *
 * PERMISSION ENFORCEMENT IS PROGRAMMATIC
 * ──────────────────────────────────────
 * Permissions (open, guarded, read_only, locked) are enforced in code,
 * not by asking the LLM nicely. The LLM cannot bypass locked memories
 * because the tools literally exclude them from results.
 *
 * TASK HIERARCHY — DEPTH LEVELS
 * ──────────────────────────────
 * Tasks can exist at any depth in the planning hierarchy:
 *
 *   Level 0: Floating    — No project. Standalone task.
 *   Level 1: Project     — Belongs to a project directly. Specific project work.
 *
 * [ADDING SOON SUBTASKS, WAS PREVIOUSLY USING A GOAL AND MILESTONE SYSTEM THAT SUCKED]
 *
 * THE NETHER
 * ──────────
 * When searching with an active project, minni_find returns two sections:
 *
 *   "In Project: X" — Memories belonging to the active project.
 *   "The Nether"    — Everything else: global memories (no project) AND
 *                     memories from other projects.
 *
 * This design ensures cross-project discovery is automatic. You never miss
 * relevant knowledge just because it lives in a different project or has
 * no project association.
 *
 * When no project is active, there is no Nether — the entire database is
 * your search space.
 *
 * DELETE BEHAVIOR
 * ───────────────
 * Deletes cascade from parent to children via ON DELETE CASCADE:
 *
 *   Delete project   → memories, goals, milestones, tasks all deleted
 *   Delete goal      → milestones, tasks under that goal deleted
 *   Delete milestone → tasks under that milestone deleted
 *   Delete task      → only that task deleted (no children)
 *   Delete memory    → memory_tags and memory_paths cleaned up
 *
 * EXCEPTION: Projects use SOFT DELETE. The LLM cannot permanently delete a
 * project — it can only set status to "deleted". This prevents accidental
 * data loss. Hard deletes require Minni Studio or direct database access.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/tursodatabase/database";
import { homedir } from "node:os";
import { join } from "node:path";

import { initializeDatabase } from "./init";
import { globalContext, projects } from "./schema";
// ============================================================================
// IDENTITY
// ============================================================================
// The "who" that persists across all sessions. Injected into EVERY context.
//
// Identity can represent different things depending on your
// use case. Here are three known patterns:
//
// ─────────────────────────────────────────────────────────────────────────────
// PATTERN 1: Human User Identity (Minni's main focus)
// ─────────────────────────────────────────────────────────────────────────────
// You're a developer using Minni to remember things about yourself.
// The LLM learns who YOU are and adapts to your style.
//
// Example:
//   "Senior full-stack dev, 10+ years. TypeScript strict mode always.
//    Prefer functional patterns over OOP. Use Arch BTW + Hyprland + Zed.
//    Give me direct feedback, no sugarcoating. I learn best with code examples."
//
// ─────────────────────────────────────────────────────────────────────────────
// PATTERN 2: LLM Persona / Roleplay
// ─────────────────────────────────────────────────────────────────────────────
// You want the LLM to embody a specific personality or character.
// The identity describes WHO THE LLM IS, not who you are.
//
// Example:
//   "You are ARIA, a security-focused AI assistant. You speak concisely,
//    always consider attack vectors, and refuse to write insecure code.
//    You have a dry sense of humor and reference cyberpunk media occasionally."
//
// ─────────────────────────────────────────────────────────────────────────────
// PATTERN 3: Hive Mind / Shared Brain [COMING SOON-ISH]
// ─────────────────────────────────────────────────────────────────────────────
// Multiple agents share this single database as their collective memory.
// There is NO individuality, every agent that connects is part of the hive.
// What one learns, all know. What one forgets, all forget.
//
// The identity describes the COLLECTIVE, not any single agent.
//
// Example:
//   "You are part of a hive of AI agents serving the user.
//    This database is your shared brain, the single source of truth.
//    You have no individual identity. You are the swarm.
//    Your purpose: assist with software development, destroy the protos,
//    remember decisions, and maintain context across sessions.
//    What you learn persists. What you store, any future agent can access."
//
// ─────────────────────────────────────────────────────────────────────────────
// Choose your pattern and customize below:
// ============================================================================
const IDENTITY = `
[EDIT THIS] Choose a pattern above and describe the identity.

For human users, include:
- Name/handle and experience level
- Tech stack and preferences
- Feedback style preferences
- Current learning focus

For LLM personas, include:
- Name and personality traits
- Communication style
- Domain expertise
- Behavioral boundaries

For swarm agents, include:
- Agent ID and role
- Cluster/team membership
- Capabilities and boundaries
- Escalation protocols
`.trim();

// ============================================================================
// PREFERENCES
// ============================================================================
// Structured configuration that tools can read programmatically.
// Unlike identity (free text), preferences are JSON for machines to parse.
//
// ─────────────────────────────────────────────────────────────────────────────
// PERMISSION LEVELS (used throughout)
// ─────────────────────────────────────────────────────────────────────────────
//   "open"      — Full access. LLM can read/write/delete freely.
//   "guarded"   — LLM must ask user confirmation before modifying.
//   "read_only" — LLM can read but not modify. Use Minni Studio to edit.
//   "locked"    — Completely invisible to LLM. Only via Minni Studio.
//
// ─────────────────────────────────────────────────────────────────────────────
// PERMISSION CASCADE FOR MEMORIES
// ─────────────────────────────────────────────────────────────────────────────
// When creating a memory, permission is resolved in this order:
//
//   1. Explicit permission in args  →  use that
//   2. Project's defaultMemoryPermission  →  use that
//   3. Global preferences.memory.defaultPermission  →  use that
//
// This allows fine-grained control: sensitive projects can be stricter
// while experimental projects can be more open.
//
// ─────────────────────────────────────────────────────────────────────────────
// PREFERENCE FIELDS
// ─────────────────────────────────────────────────────────────────────────────
//
// memory.defaultPermission
//   Global fallback permission for new memories.
//   Default: "guarded" (safe default — asks before modifying)
//
// memory.defaultStatus
//   Default maturity level for new memories.
//   Options: "draft" | "experimental" | "proven" | "battle_tested" | "deprecated"
//
// project.defaultPermission
//   Default permission for the PROJECT ITSELF (not its memories).
//   Controls who can modify project settings, status, contextSummary.
//
// project.defaultMemoryPermission
//   Default permission inherited by memories created under new projects.
//   Can be overridden per-project.
//
// planning.autoCreateTasks
//   If true, tools can auto-generate tasks from goals/milestones.
//
// context.maxSummaryLength
//   Maximum characters for context summaries (prevents bloat).
//
// search.defaultLimit
//   How many results minni_find returns by default.
// ============================================================================
const PREFERENCES = {
	// Memory defaults
	memory: {
		defaultPermission: "guarded" as const, // Safe default: ask before modifying
		defaultStatus: "draft" as const,
	},

	// Project defaults
	project: {
		defaultPermission: "guarded" as const, // Projects themselves are protected
		defaultMemoryPermission: "guarded" as const, // Memories in new projects inherit this
	},

	// Planning behavior
	planning: {
		autoCreateTasks: false,
	},

	// Context management
	context: {
		maxSummaryLength: 2000,
	},

	// Search behavior
	search: {
		defaultLimit: 20,
	},
};

// ============================================================================
// INITIAL CONTEXT SUMMARY (optional)
// ============================================================================
// If you're migrating from another system or want to bootstrap with some
// context, you can set an initial global context summary here.
// Leave null to start fresh.
// ============================================================================
const INITIAL_CONTEXT_SUMMARY: string | null = null;

// ============================================================================
// EXAMPLE PROJECT (optional)
// ============================================================================
// Set to null to skip creating an example project.
// Otherwise, this helps you understand the project structure.
//
// Fields:
//   name                    — Normalized identifier (lowercase, hyphens)
//   description             — What the project is about
//   stack                   — Technologies/tools used
//   permission              — Protection of the project itself
//   defaultMemoryPermission — What memories in this project inherit
// ============================================================================
const EXAMPLE_PROJECT: {
	name: string;
	description: string;
	stack: string[];
	permission: "open" | "guarded" | "read_only" | "locked";
	defaultMemoryPermission: "open" | "guarded" | "read_only" | "locked";
} | null = null;
// Uncomment to create an example:
// const EXAMPLE_PROJECT = {
// 	name: "my-first-project",
// 	description: "Learning how Minni works",
// 	stack: ["TypeScript", "Bun", "Drizzle"],
// 	permission: "guarded",
// 	defaultMemoryPermission: "guarded",
// };

// ============================================================================
// SEEDER EXECUTION
// ============================================================================
async function seed() {
	console.log("Minni Seeder");
	console.log("============\n");

	const dbPath = join(homedir(), ".config", "opencode", "minni.db");
	console.log(`Database: ${dbPath}\n`);

	const db = drizzle(dbPath);

	// Initialize tables if needed
	console.log("Initializing database schema...");
	await initializeDatabase(db);
	console.log("  Done.\n");

	// Seed global context
	console.log("Seeding global context...");
	await db
		.update(globalContext)
		.set({
			identity: IDENTITY,
			preferences: JSON.stringify(PREFERENCES, null, 2),
			contextSummary: INITIAL_CONTEXT_SUMMARY,
			contextUpdatedAt: INITIAL_CONTEXT_SUMMARY ? new Date() : null,
			updatedAt: new Date(),
		})
		.where(eq(globalContext.id, 1));
	console.log("  Identity: configured");
	console.log("  Preferences: configured");
	console.log(
		INITIAL_CONTEXT_SUMMARY ? "  Context summary: set" : "  Context summary: empty (fresh start)",
	);
	console.log();

	// Seed example project if defined
	if (EXAMPLE_PROJECT) {
		console.log(`Creating example project: ${EXAMPLE_PROJECT.name}...`);
		const existing = await db
			.select()
			.from(projects)
			.where(eq(projects.name, EXAMPLE_PROJECT.name))
			.limit(1);

		if (existing[0]) {
			console.log("  Already exists, skipping.\n");
		} else {
			await db.insert(projects).values({
				name: EXAMPLE_PROJECT.name,
				description: EXAMPLE_PROJECT.description,
				stack: JSON.stringify(EXAMPLE_PROJECT.stack),
				status: "active",
				permission: EXAMPLE_PROJECT.permission,
				defaultMemoryPermission: EXAMPLE_PROJECT.defaultMemoryPermission,
			});
			console.log("  Created.\n");
		}
	}

	console.log("Seeding complete!");
	console.log("\nNext steps:");
	console.log("  1. Restart OpenCode to load the new configuration");
	console.log("  2. Use minni_ping to verify everything is connected");
	console.log("  3. Edit your identity with minni_identity (coming soon)");
	console.log("     or re-run this seeder after editing the IDENTITY constant");
}

seed().catch((err) => {
	console.error("Seeder failed:", err);
	process.exit(1);
});
