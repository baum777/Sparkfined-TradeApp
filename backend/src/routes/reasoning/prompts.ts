/**
 * Reasoning Prompts — Re-export Shim
 * Owner: Reasoning Team
 * Status: active
 * Version: 1.0
 * LastUpdated: 2026-02-27
 * Canonical: false
 * Note: Re-export from shared/contracts/reasoning-prompts.ts
 *
 * This file is a compatibility shim that re-exports from the
 * canonical location: shared/contracts/reasoning-prompts.ts
 *
 * Do NOT add implementation here. All changes must be made in
 * the shared/contracts/ source file.
 */

export {
  type JsonObject,
  type ReasoningType,
  buildGeneratorPrompt,
  buildCriticPrompt,
} from '../../../../shared/contracts/reasoning-prompts.js';
