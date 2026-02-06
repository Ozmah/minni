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
 * MINNI v2 MANIFESTO — DESIGN DECISIONS
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
 * COMPOSABLE CONTEXT — THE v2 MODEL
 * ──────────────────────────────────
 * v2 replaces monolithic context loading with composable, on-demand injection.
 * 6 tools instead of 12. The agent assembles only what it needs per task.
 *
 *   minni_hud     — State snapshot. Cheap, call often. No side effects.
 *   minni_equip   — Load specific knowledge into working memory.
 *   minni_memory  — CRUD knowledge. Find to discover, equip to read.
 *   minni_project — CRUD projects + load (switch project context).
 *   minni_task    — CRUD work items. Equip to read details.
 *   minni_canvas  — Markdown viewer for rich output.
 *
 * EVERYTHING IS A MEMORY
 * ──────────────────────
 * Identity, context summaries, and scratchpads are memory types — not special
 * columns on global_context. This means they follow the same permission system,
 * tagging, and search as any other knowledge.
 *
 *   type: "identity"   — Who the user/agent/swarm is. Activated via pointer.
 *   type: "context"    — Session continuity. One per project (upsert).
 *   type: "scratchpad" — Ephemeral workspace. Forced open permission.
 *
 * SETTINGS ARE CODE-ENFORCED
 * ──────────────────────────
 * Configuration lives in the settings table as key-value pairs. The LLM has
 * ZERO access to read or modify settings. They are read at init time and
 * applied programmatically by the tools. This prevents the LLM from
 * modifying its own permission system.
 *
 * THE minni.db FILE IS THE SOURCE OF TRUTH
 * ────────────────────────────────────
 * Any agent, tool, or human can modify the database at any time. Therefore:
 *   - minni_hud and minni_project(load) ALWAYS fetch fresh data
 *   - Context memories can change between sessions
 *   - Identity is resolved fresh on every compaction
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
 * The identity memory sets the tone, whether you want a focused assistant or
 * describe a collective purpose for the swarm.
 *
 * PROGRESSIVE DISCLOSURE
 * ──────────────────────
 * minni_hud returns a 3-line snapshot: project, identity, counts.
 * minni_project(load) returns a project brief: description, stack, active task.
 * Neither dumps full content.
 *
 * The agent knows WHAT exists and HOW MUCH. It loads specific content
 * via minni_equip when needed. This keeps context windows lean while
 * maintaining full access to the knowledge base.
 *
 * PERMISSION ENFORCEMENT IS PROGRAMMATIC
 * ──────────────────────────────────────
 * Permissions (open, guarded, read_only, locked) are enforced in code,
 * not by asking the LLM nicely. The LLM cannot bypass locked memories
 * because the tools literally exclude them from results.
 *
 * Permission cascade for new memories:
 *   1. Explicit permission in args  →  use that
 *   2. Project's defaultMemoryPermission  →  use that
 *   3. settings.default_memory_permission  →  use that
 *   4. Fallback: "guarded"
 *
 * TASK HIERARCHY
 * ──────────────
 * Tasks support subtasks via parent_id (ON DELETE CASCADE):
 *
 *   Level 0: Floating — No project. Standalone task.
 *   Level 1: Project  — Belongs to a project directly.
 *   Level 2+: Subtask — Nested under a parent task.
 *
 * THE NETHER
 * ──────────
 * When searching with an active project, minni_memory(find) returns two sections:
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
 *   Delete project → memories, tasks all deleted
 *   Delete task    → subtasks cascade-deleted
 *   Delete memory  → memory_tags and memory_relations cleaned up
 *
 * EXCEPTION: Projects use SOFT DELETE. The LLM cannot permanently delete a
 * project — it can only set status to "deleted". This prevents accidental
 * data loss. Hard deletes require Minni Studio or direct database access.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { eq, and, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/tursodatabase/database";
import { homedir } from "node:os";
import { join } from "node:path";

import { initializeDatabase } from "./init";
import { globalContext, memories, projects, settings } from "./schema";

// ============================================================================
// IDENTITY
// ============================================================================
// The "who" that persists across all sessions. Stored as a memory of type
// "identity" and activated via global_context.active_identity_id.
// Injected into compacted sessions automatically.
//
// Identity can represent different things depending on your use case.
// Here are three known patterns:
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

/** Title for the identity memory. Used as display name in HUD and beacons. */
const IDENTITY_TITLE = "Default Identity";

/** Free-text content describing the identity. Edit this. */
const IDENTITY_CONTENT = `
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
// SETTINGS OVERRIDES
// ============================================================================
// Settings live in the settings table as key-value pairs.
// initializeDatabase() seeds defaults for all keys (INSERT OR IGNORE).
// The seeder can override specific values after initialization.
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
// AVAILABLE SETTINGS
// ─────────────────────────────────────────────────────────────────────────────
//
//   default_identity                — Identity memory title to use as default
//   force_identity_on_hud           — Inject full identity in every HUD call
//   ask_before_identity_injection   — Use context.ask() before injecting
//   default_memory_permission       — Fallback permission for new memories
//   auto_create_tasks               — Allow automatic task creation (placeholder)
//   search_default_limit            — Default result count for find
//   activate_identity_on_save       — Auto-activate identity on save (placeholder)
//   dangerously_skip_memory_permission — Bypass ALL permission checks
//
// Only override what you want to change. Defaults are set by init.
// ============================================================================
const SETTINGS_OVERRIDES: Record<string, string> = {
	// Uncomment and edit to override defaults:
	// default_memory_permission: "open",
	// search_default_limit: "30",
	// force_identity_on_hud: "true",
};

// ============================================================================
// INITIAL CONTEXT (optional)
// ============================================================================
// Bootstrap a global context memory. Useful when migrating from another system
// or starting with known context. Stored as a memory of type "context" with
// no project association (global scope).
// Set to null to start fresh.
// ============================================================================
const INITIAL_CONTEXT: string | null = null;

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
	console.log("Minni v2 Seeder");
	console.log("===============\n");

	const dbPath = join(homedir(), ".config", "opencode", "minni.db");
	console.log(`Database: ${dbPath}\n`);

	const db = drizzle(dbPath);

	console.log("Initializing database schema...");
	await initializeDatabase(db);
	console.log("  Done.\n");

	// Create identity memory and activate it
	console.log("Seeding identity...");
	const existingIdentity = await db
		.select()
		.from(memories)
		.where(and(eq(memories.type, "identity"), eq(memories.title, IDENTITY_TITLE)))
		.limit(1);

	let identityId: number;
	const now = new Date();

	if (existingIdentity[0]) {
		identityId = existingIdentity[0].id;
		await db
			.update(memories)
			.set({ content: IDENTITY_CONTENT, updatedAt: now })
			.where(eq(memories.id, identityId));
		console.log(`  Updated existing identity: [${identityId}] ${IDENTITY_TITLE}`);
	} else {
		const result = await db
			.insert(memories)
			.values({
				type: "identity",
				title: IDENTITY_TITLE,
				content: IDENTITY_CONTENT,
				status: "proven",
				permission: "guarded",
				createdAt: now,
				updatedAt: now,
			})
			.returning({ id: memories.id });
		identityId = result[0].id;
		console.log(`  Created identity: [${identityId}] ${IDENTITY_TITLE}`);
	}

	// Point global_context to the identity
	await db
		.update(globalContext)
		.set({ activeIdentityId: identityId, updatedAt: now })
		.where(eq(globalContext.id, 1));
	console.log("  Activated as default identity.\n");

	// Override settings if any
	const overrideKeys = Object.keys(SETTINGS_OVERRIDES);
	if (overrideKeys.length > 0) {
		console.log("Applying settings overrides...");
		for (const [key, value] of Object.entries(SETTINGS_OVERRIDES)) {
			await db.update(settings).set({ value }).where(eq(settings.key, key));
			console.log(`  ${key}: ${value}`);
		}
		console.log();
	}

	// Create global context memory if provided
	if (INITIAL_CONTEXT) {
		console.log("Seeding initial context...");
		const existingContext = await db
			.select()
			.from(memories)
			.where(and(eq(memories.type, "context"), isNull(memories.projectId)))
			.limit(1);

		if (existingContext[0]) {
			await db
				.update(memories)
				.set({ content: INITIAL_CONTEXT, updatedAt: now })
				.where(eq(memories.id, existingContext[0].id));
			console.log("  Updated existing global context.\n");
		} else {
			await db.insert(memories).values({
				type: "context",
				title: "Global Context",
				content: INITIAL_CONTEXT,
				status: "draft",
				permission: "open",
				createdAt: now,
				updatedAt: now,
			});
			console.log("  Created global context memory.\n");
		}
	}

	// Create example project if defined
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
				createdAt: now,
				updatedAt: now,
			});
			console.log("  Created.\n");
		}
	}

	console.log("Seeding complete!");
	console.log("\nNext steps:");
	console.log("  1. Restart OpenCode to load the new configuration");
	console.log("  2. Use minni_hud to verify your state");
	console.log("  3. Use minni_project(action: 'load', name: 'your-project') to switch context");
	console.log("  4. Use minni_equip to load specific knowledge into context");
}

seed().catch((err) => {
	console.error("Seeder failed:", err);
	process.exit(1);
});
