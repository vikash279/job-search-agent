import { AssistedUrlAdapter } from "./adapters/assisted.js";
import { LocalApplicationAdapter } from "./adapters/local.js";
import type { PortalApplicationAdapter } from "./types.js";

const adapters: PortalApplicationAdapter[] = [];

export function registerApplicationAdapter(adapter: PortalApplicationAdapter): void {
  if (adapters.some((item) => item.source === adapter.source)) return;
  adapters.push(adapter);
}

export function listApplicationAdapters(): Array<{
  source: string;
  testedAgainstPortal: boolean;
}> {
  return adapters.map((adapter) => ({
    source: adapter.source,
    testedAgainstPortal: adapter.testedAgainstPortal,
  }));
}

export function getApplicationAdapter(source: string): PortalApplicationAdapter | undefined {
  return adapters.find((adapter) => adapter.source === source);
}

export function resolveApplicationAdapter(input: {
  source: string;
  canonicalUrl: string;
}): PortalApplicationAdapter {
  const match = adapters.find((adapter) => adapter.source !== "assisted" && adapter.supports(input));
  return match ?? adapters.find((adapter) => adapter.source === "assisted") ?? new AssistedUrlAdapter();
}

export function resetApplicationAdaptersForTests(): void {
  adapters.splice(0, adapters.length);
  registerDefaultApplicationAdapters();
}

export function registerDefaultApplicationAdapters(): void {
  registerApplicationAdapter(new LocalApplicationAdapter());
  registerApplicationAdapter(new AssistedUrlAdapter());
}

registerDefaultApplicationAdapters();
