import { randomUUID } from "node:crypto";

/**
 * Ephemeral in-memory session only.
 * Playwright is not used: no permitted employer portal has been tested,
 * and unauthorized browser automation is out of scope.
 * Sessions never store passwords, OTPs, cookies, or access tokens.
 */
export interface ApplicationSession {
  id: string;
  applicationId: string;
  adapter: string;
  createdAt: Date;
}

const sessions = new Map<string, ApplicationSession>();

export function openSession(applicationId: string, adapter: string): ApplicationSession {
  const session: ApplicationSession = {
    id: randomUUID(),
    applicationId,
    adapter,
    createdAt: new Date(),
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): ApplicationSession | undefined {
  return sessions.get(id);
}

export function closeSession(id: string): void {
  sessions.delete(id);
}

export function listOpenSessions(): ApplicationSession[] {
  return [...sessions.values()];
}

export function resetSessionsForTests(): void {
  sessions.clear();
}
