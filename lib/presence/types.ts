// Types partagés du module Présence & Actions (client-safe : consommés par les
// écrans Super Admin ET produits par les lectures serveur).
import type { PresenceStatus, AlertSeverity } from "./taxonomy";

export type TeamRow = {
  userId: string;
  name: string;
  roles: string[];
  status: PresenceStatus;
  firstSeenAt: string | null; // 1ʳᵉ connexion du jour (ISO)
  lastActiveAt: string | null; // dernière activité (ISO)
  activeSeconds: number; // temps d'activité réelle (jour)
  sessionSeconds: number; // temps de session (jour)
  actionsCount: number; // volume d'actions du jour
  leadsTreated: number; // leads réellement pris en charge (jour)
  openAlerts: number; // alertes ouvertes le concernant
  topSeverity: AlertSeverity | null;
};

export type TimelineSegment = {
  kind: "active" | "inactive";
  start: string; // ISO
  end: string; // ISO
  seconds: number;
};

export type ActionEvent = {
  id: string;
  at: string; // ISO
  action: string;
  label: string;
  verb: string;
  category: string;
  entityType: string | null;
  entityId: string | null;
  entityRef: string | null; // ex. "L-1087" / "DEV-2026-0001"
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

export type UserDaySummary = {
  userId: string;
  name: string;
  day: string; // YYYY-MM-DD
  status: PresenceStatus;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  lastActiveAt: string | null;
  sessionSeconds: number;
  activeSeconds: number;
  inactiveSeconds: number;
  sessionsCount: number;
  counters: Record<string, number>; // leads_traites, devis_crees, …
  timeline: TimelineSegment[];
};

export type AlertRow = {
  id: string;
  ruleKey: string;
  ruleLabel: string;
  severity: AlertSeverity;
  userId: string | null;
  userName: string | null;
  entityType: string | null;
  entityId: string | null;
  entityRef: string | null;
  title: string;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt: string | null;
  resolvedAction: string | null;
  delaySeconds: number | null;
};

export type DashboardStats = {
  presence: { active: number; inactive: number; offline: number; expectedAbsent: number };
  leads: { newToday: number; treated: number; pending: number };
  alerts: { total: number; critical: number; high: number; warn: number; watch: number };
};

export type AlertRule = {
  key: string;
  label: string;
  enabled: boolean;
  config: Record<string, number | string | boolean>;
};
