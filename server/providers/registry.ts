import type { Provider, ProviderConfig, ProviderExecuteOptions, UnifiedResponse, ModelTier } from './types';
import { createAnthropicProvider } from './anthropicProvider';
import { createOpenRouterProvider } from './openrouterProvider';

// ── Provider Registry ────────────────────────────────────────────────────────

class ProviderRegistry {
  private providers: Map<string, Provider> = new Map();
  private healthCache: Map<string, { healthy: boolean; checkedAt: number }> = new Map();
  private readonly HEALTH_TTL_MS = 30_000; // cache health for 30s

  register(provider: Provider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): Provider | undefined {
    return this.providers.get(name);
  }

  list(): Provider[] {
    return Array.from(this.providers.values())
      .sort((a, b) => a.config.priority - b.config.priority);
  }

  async isHealthy(name: string): Promise<boolean> {
    const cached = this.healthCache.get(name);
    if (cached && Date.now() - cached.checkedAt < this.HEALTH_TTL_MS) {
      return cached.healthy;
    }

    const provider = this.providers.get(name);
    if (!provider) return false;

    try {
      const healthy = await provider.isHealthy();
      this.healthCache.set(name, { healthy, checkedAt: Date.now() });
      return healthy;
    } catch {
      this.healthCache.set(name, { healthy: false, checkedAt: Date.now() });
      return false;
    }
  }

  /**
   * Execute with automatic failover.
   * Tries providers in priority order. Falls back to next healthy provider on failure.
   */
  async execute(
    options: ProviderExecuteOptions,
    preferredProvider?: string,
  ): Promise<UnifiedResponse> {
    const providers = this.list();
    const errors: string[] = [];

    // Try preferred provider first
    if (preferredProvider) {
      const provider = this.providers.get(preferredProvider);
      if (provider && provider.config.enabled) {
        try {
          const healthy = await this.isHealthy(provider.name);
          if (healthy) {
            return await provider.execute(options);
          }
        } catch (err: any) {
          errors.push(`${provider.name}: ${err.message}`);
          console.warn(`[provider-registry] ${provider.name} failed:`, err.message);
        }
      }
    }

    // Fallback through remaining providers
    for (const provider of providers) {
      if (preferredProvider && provider.name === preferredProvider) continue;
      if (!provider.config.enabled) continue;

      try {
        const healthy = await this.isHealthy(provider.name);
        if (!healthy) {
          errors.push(`${provider.name}: unhealthy`);
          continue;
        }
        return await provider.execute(options);
      } catch (err: any) {
        errors.push(`${provider.name}: ${err.message}`);
        console.warn(`[provider-registry] ${provider.name} failed:`, err.message);
      }
    }

    throw new Error(`All providers failed: ${errors.join('; ')}`);
  }

  /** Get model ID for a tier, using the first healthy provider */
  getModelId(tier: ModelTier, providerName?: string): string {
    if (providerName) {
      const p = this.providers.get(providerName);
      if (p) return p.getModelId(tier);
    }
    const first = this.list()[0];
    return first?.getModelId(tier) ?? `claude-${tier}`;
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

export const providerRegistry = new ProviderRegistry();

// ── Auto-initialize from env ─────────────────────────────────────────────────

const llmProvider = process.env.LLM_PROVIDER ?? 'auto';

// Always register Anthropic (primary)
const anthropicConfig: ProviderConfig = {
  name: 'anthropic',
  enabled: llmProvider === 'anthropic' || llmProvider === 'auto',
  priority: 1,
  maxRetries: 2,
  timeoutMs: 300_000,
};
providerRegistry.register(createAnthropicProvider(anthropicConfig));

// Register OpenRouter as fallback
if (process.env.OPENROUTER_API_KEY) {
  const openrouterConfig: ProviderConfig = {
    name: 'openrouter',
    apiKey: process.env.OPENROUTER_API_KEY,
    enabled: llmProvider === 'openrouter' || llmProvider === 'auto',
    priority: 2,
    maxRetries: 1,
    timeoutMs: 120_000,
  };
  providerRegistry.register(createOpenRouterProvider(openrouterConfig));
}
