import { DEFAULT_CONFIG, MemvidConfig, resolveEnvVars } from '../types/types';

/**
 * Merge user config with defaults
 */
export function mergeConfig(userConfig: MemvidConfig): Required<MemvidConfig> {
     const merged = { ...DEFAULT_CONFIG, ...userConfig };

     // Resolve environment variables in string fields
     if (merged.memvidPath) {
          merged.memvidPath = resolveEnvVars(merged.memvidPath);
     }
     if (merged.archivesDir) {
          merged.archivesDir = resolveEnvVars(merged.archivesDir);
     }
     if (merged.apiKey) {
          merged.apiKey = resolveEnvVars(merged.apiKey);
     }
     if (merged.ticketIssuer) {
          merged.ticketIssuer = resolveEnvVars(merged.ticketIssuer);
     }

     return merged;
}
