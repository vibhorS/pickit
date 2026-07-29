"use client";

import { useEffect, useMemo, useState } from "react";
import { analytics, type AnalyticsEnvelope } from "@/lib/observability/analytics";

function count(events: AnalyticsEnvelope[], name: string): number {
  return events.filter((event) => event.event === name).length;
}

function pct(numerator: number, denominator: number): string {
  if (denominator <= 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function avg(values: number[]): string {
  if (values.length === 0) return "0ms";
  return `${Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)}ms`;
}

function readDuration(events: AnalyticsEnvelope[], key: string): number[] {
  return events
    .filter((event) => event.event === "timing_recorded" && event.props.metric === key)
    .map((event) =>
      typeof event.props.durationMs === "number" ? event.props.durationMs : 0,
    )
    .filter((value) => value > 0);
}

export function BetaDashboard() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 5000);
    return () => window.clearInterval(id);
  }, []);

  const snapshot = useMemo(() => analytics.snapshot(), [tick]);
  const events = snapshot.events;

  const metrics = useMemo(() => {
    const sessions = new Set(events.map((event) => event.sessionId)).size;
    const appOpens = count(events, "app_opened");
    const accountCreated = count(events, "account_created");
    const crewCreated = count(events, "crew_created");
    const invitesSent = count(events, "invite_sent");
    const invitesAccepted = count(events, "invite_accepted");
    const captureStarted = count(events, "capture_started");
    const captureCompleted = count(events, "capture_completed");
    const captureFailed = count(events, "capture_failed");
    const recoveryUsed = events.filter(
      (event) => event.event === "capture_completed" && event.props.recoveryPassUsed === true,
    ).length;
    const tmdbMatched = events
      .filter((event) => event.event === "capture_completed")
      .map((event) =>
        typeof event.props.tmdbMatchSuccessRate === "number"
          ? event.props.tmdbMatchSuccessRate
          : 0,
      );
    const autoSelectionRates = events
      .filter((event) => event.event === "capture_completed")
      .map((event) =>
        typeof event.props.autoSelectionRate === "number"
          ? event.props.autoSelectionRate
          : 0,
      );
    const manualReviewRates = events
      .filter((event) => event.event === "capture_completed")
      .map((event) =>
        typeof event.props.manualReviewRate === "number"
          ? event.props.manualReviewRate
          : 0,
      );
    const movieNightStarted = count(events, "movie_night_started");
    const movieNightCompleted = count(events, "movie_night_completed");
    const recommendationImported = count(events, "recommendation_imported");
    const errors = events.filter((event) => event.kind === "error");

    const captureDurations = events
      .filter((event) => event.event === "capture_completed")
      .map((event) =>
        typeof event.props.durationMs === "number" ? event.props.durationMs : 0,
      )
      .filter((value) => value > 0);

    return {
      sessions,
      appOpens,
      accountCreated,
      crewCreated,
      inviteAcceptance: pct(invitesAccepted, invitesSent),
      captureSuccess: pct(captureCompleted, captureStarted || captureCompleted + captureFailed),
      recoveryRate: pct(recoveryUsed, captureCompleted),
      tmdbMatchRate:
        tmdbMatched.length === 0
          ? "0%"
          : `${Math.round(
              (tmdbMatched.reduce((sum, value) => sum + value, 0) / tmdbMatched.length) * 100,
            )}%`,
      autoSelectionRate:
        autoSelectionRates.length === 0
          ? "0%"
          : `${Math.round(
              (autoSelectionRates.reduce((sum, value) => sum + value, 0) /
                autoSelectionRates.length) *
                100,
            )}%`,
      manualReviewRate:
        manualReviewRates.length === 0
          ? "0%"
          : `${Math.round(
              (manualReviewRates.reduce((sum, value) => sum + value, 0) /
                manualReviewRates.length) *
                100,
            )}%`,
      avgCaptureTime: avg(captureDurations),
      movieNightStarted,
      movieNightCompleted,
      recommendationImported,
      avgScreenTime: avg(readDuration(events, "time_on_screen")),
      avgFirstInteraction: avg(readDuration(events, "time_to_first_interaction")),
      errors,
    };
  }, [events]);

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold text-white">Beta Dashboard</h3>
      <p className="mt-1 text-xs text-netflix-muted">
        Local observability snapshot for beta diagnostics.
      </p>
      <div className="mt-4 grid gap-2 text-xs text-netflix-muted sm:grid-cols-2">
        <p>Sessions: {metrics.sessions}</p>
        <p>App opens: {metrics.appOpens}</p>
        <p>New accounts: {metrics.accountCreated}</p>
        <p>Crew created: {metrics.crewCreated}</p>
        <p>Invite acceptance: {metrics.inviteAcceptance}</p>
        <p>Capture success: {metrics.captureSuccess}</p>
        <p>Recovery rate: {metrics.recoveryRate}</p>
        <p>TMDb match rate: {metrics.tmdbMatchRate}</p>
        <p>Auto-selection: {metrics.autoSelectionRate}</p>
        <p>Manual review: {metrics.manualReviewRate}</p>
        <p>Avg capture time: {metrics.avgCaptureTime}</p>
        <p>Movie Nights started: {metrics.movieNightStarted}</p>
        <p>Movie Nights completed: {metrics.movieNightCompleted}</p>
        <p>Recommendations imported: {metrics.recommendationImported}</p>
        <p>Avg screen time: {metrics.avgScreenTime}</p>
        <p>First interaction: {metrics.avgFirstInteraction}</p>
        <p>Queue size: {snapshot.queueSize}</p>
        <p>Sent events: {snapshot.sentCount}</p>
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold text-white">Recent errors</p>
        <ul className="mt-2 space-y-1 text-xs text-netflix-muted">
          {metrics.errors.slice(-6).map((event) => (
            <li key={event.id}>
              {new Date(event.ts).toLocaleTimeString()} · {event.event}
            </li>
          ))}
          {metrics.errors.length === 0 ? <li>None recorded.</li> : null}
        </ul>
      </div>
    </section>
  );
}
