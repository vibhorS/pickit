"use client";

import { useEffect, useState } from "react";
import { CaptureCollectionsStep } from "@/components/capture/pipeline/capture-collections-step";
import { CaptureEntryStep } from "@/components/capture/pipeline/capture-entry-step";
import { CaptureHistory } from "@/components/capture/pipeline/capture-history";
import { CaptureReviewStep } from "@/components/capture/pipeline/capture-review-step";
import { CaptureSaveSuccess } from "@/components/capture/pipeline/capture-save-success";
import { RecommendationContextForm } from "@/components/recommendation/recommendation-context-form";
import { FadeIn } from "@/components/ui/fade-in";
import { useCaptureService } from "@/components/capture/capture-service-provider";
import type {
  CaptureSession,
  ManualCaptureInput,
  MovieCandidate,
} from "@/lib/capture/types";
import type { Collection, RecommendationMetadata } from "@/lib/types";
import {
  EMPTY_CAPTURE_SESSIONS,
  useCaptureStore,
} from "@/store/capture-store";
import {
  getCurrentSession,
  useSessionStore,
  type CaptureSessionState,
  type RecommendationContextDraft,
} from "@/store/session-store";

type Step =
  | "entry"
  | "review"
  | "collections"
  | "context"
  | "success"
  | "summary";

type CapturePipelineClientProps = {
  seedCollections: Collection[];
};

export function CapturePipelineClient({
  seedCollections,
}: CapturePipelineClientProps) {
  const { receive, save } = useCaptureService();
  const sessions = useCaptureStore((state) => state.sessions);
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<Step>("entry");
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [candidates, setCandidates] = useState<MovieCandidate[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(
    [],
  );
  const [contextDraft, setContextDraft] =
    useState<RecommendationContextDraft>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMovieCount, setSavedMovieCount] = useState(0);
  const setCurrentSession = useSessionStore(
    (state) => state.setCurrentSession,
  );
  const clearCurrentSession = useSessionStore(
    (state) => state.clearCurrentSession,
  );

  useEffect(() => {
    const finish = () => {
      if (
        !useCaptureStore.persist.hasHydrated() ||
        !useSessionStore.persist.hasHydrated()
      ) {
        return;
      }
      queueMicrotask(() => {
        const draft = getCurrentSession();
        if (draft?.kind === "capture") {
          setSession(draft.session);
          setCandidates(draft.candidates);
          setSelectedCollectionIds(draft.selectedCollectionIds);
          setContextDraft(draft.contextDraft);
          setStep(draft.step);
        }
        setHydrated(true);
      });
    };
    const unsubscribeCapture =
      useCaptureStore.persist.onFinishHydration(finish);
    const unsubscribeSession =
      useSessionStore.persist.onFinishHydration(finish);
    if (
      useCaptureStore.persist.hasHydrated() &&
      useSessionStore.persist.hasHydrated()
    ) {
      finish();
    }
    return () => {
      unsubscribeCapture();
      unsubscribeSession();
    };
  }, []);

  function saveDraft(
    nextStep: CaptureSessionState["step"],
    nextSession = session,
    nextCandidates = candidates,
    nextCollectionIds = selectedCollectionIds,
    nextContextDraft = contextDraft,
  ) {
    if (!nextSession) return;
    setCurrentSession({
      kind: "capture",
      step: nextStep,
      session: nextSession,
      candidates: nextCandidates,
      selectedCollectionIds: nextCollectionIds,
      contextDraft: nextContextDraft,
      updatedAt: new Date().toISOString(),
    });
  }

  function reset() {
    setStep("entry");
    setSession(null);
    setCandidates([]);
    setSelectedCollectionIds([]);
    setContextDraft(undefined);
    setError(null);
    setSavedMovieCount(0);
    clearCurrentSession("capture");
  }

  async function handleReceive(input: ManualCaptureInput) {
    setBusy(true);
    setError(null);
    try {
      const nextSession = await receive(input);
      setSession(nextSession);
      setCandidates(nextSession.result.candidates);
      setStep("review");
      saveDraft(
        "review",
        nextSession,
        nextSession.result.candidates,
        [],
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Capture could not be read.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(
    recommendationMetadata: RecommendationMetadata,
  ) {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const result = await save(
        session,
        candidates,
        selectedCollectionIds,
        recommendationMetadata,
      );
      setSession(result.session);
      setSavedMovieCount(result.savedMovieCount);
      setStep("success");
      clearCurrentSession("capture");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Capture could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  function openSummary(historySession: CaptureSession) {
    setSession(historySession);
    setCandidates(
      historySession.result.candidates.filter((candidate) =>
        historySession.approvedCandidateIds.includes(candidate.id),
      ),
    );
    setStep("summary");
  }

  const selectedMovieCount = candidates.filter(
    (candidate) => candidate.selected,
  ).length;

  return (
    <FadeIn className="w-full pb-16">
      {step === "entry" && (
        <>
          <CaptureEntryStep
            busy={busy}
            error={error}
            onSubmit={handleReceive}
          />
          <CaptureHistory
            sessions={hydrated ? sessions ?? EMPTY_CAPTURE_SESSIONS : []}
            onSelect={openSummary}
          />
        </>
      )}

      {step === "review" && session && (
        <CaptureReviewStep
          session={session}
          candidates={candidates}
          onChange={(nextCandidates) => {
            setCandidates(nextCandidates);
            saveDraft("review", session, nextCandidates);
          }}
          onBack={reset}
          onContinue={() => {
            setError(null);
            setStep("collections");
            saveDraft("collections");
          }}
        />
      )}

      {step === "summary" && session && (
        <CaptureReviewStep
          session={session}
          candidates={candidates}
          readOnly
          onBack={reset}
        />
      )}

      {step === "collections" && (
        <CaptureCollectionsStep
          seedCollections={seedCollections}
          selectedIds={selectedCollectionIds}
          movieCount={selectedMovieCount}
          busy={busy}
          error={error}
          onChange={(collectionIds) => {
            setSelectedCollectionIds(collectionIds);
            saveDraft(
              "collections",
              session,
              candidates,
              collectionIds,
            );
          }}
          onBack={() => {
            setError(null);
            setStep("review");
            saveDraft("review");
          }}
          onContinue={() => {
            setError(null);
            setStep("context");
            saveDraft("context");
          }}
        />
      )}

      {step === "context" && session && (
        <RecommendationContextForm
          initialPlatform={session.result.source.type}
          initialPlatformLabel={session.result.source.label}
          sourceUrl={session.result.source.url}
          captureMethod={session.payload.adapterId}
          initialDraft={contextDraft}
          onDraftChange={(draft) => {
            setContextDraft(draft);
            saveDraft(
              "context",
              session,
              candidates,
              selectedCollectionIds,
              draft,
            );
          }}
          submitLabel={`Save ${selectedMovieCount} ${
            selectedMovieCount === 1 ? "Movie" : "Movies"
          }`}
          busy={busy}
          error={error}
          onBack={() => {
            setError(null);
            setStep("collections");
            saveDraft("collections");
          }}
          onSubmit={(metadata) => void handleSave(metadata)}
        />
      )}

      {step === "success" && (
        <CaptureSaveSuccess
          savedMovieCount={savedMovieCount}
          primaryCollectionId={selectedCollectionIds[0] ?? null}
          onCaptureAnother={reset}
        />
      )}
    </FadeIn>
  );
}
