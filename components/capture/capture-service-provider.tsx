"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { ManualPasteAdapter } from "@/lib/capture/adapters";
import { CaptureService } from "@/lib/capture/capture-service";
import { MockCaptureExtractionProvider } from "@/lib/capture/mock-extraction-provider";
import { sourceFromMetadata } from "@/lib/recommendation-metadata";
import type {
  CaptureSaveResult,
  CaptureSession,
  ManualCaptureInput,
  MovieCandidate,
} from "@/lib/capture/types";
import type { RecommendationMetadata } from "@/lib/types";
import { useCaptureStore } from "@/store/capture-store";
import { useCollaborationStore } from "@/store/collaboration-store";
import { useLocalCollectionStore } from "@/store/local-collection-store";

type CaptureServiceContextValue = {
  receive: (input: ManualCaptureInput) => Promise<CaptureSession>;
  save: (
    session: CaptureSession,
    candidates: MovieCandidate[],
    collectionIds: string[],
    recommendationMetadata: RecommendationMetadata,
  ) => Promise<CaptureSaveResult>;
};

const CaptureServiceContext =
  createContext<CaptureServiceContextValue | null>(null);

const captureService = new CaptureService(
  new MockCaptureExtractionProvider(),
);
const manualPasteAdapter = new ManualPasteAdapter();

export function CaptureServiceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const receive = useCallback((input: ManualCaptureInput) => {
    return captureService.capture(manualPasteAdapter, input);
  }, []);

  const save = useCallback(
    (
      session: CaptureSession,
      candidates: MovieCandidate[],
      collectionIds: string[],
      recommendationMetadata: RecommendationMetadata,
    ) => {
      return captureService.save(
        session,
        candidates,
        collectionIds,
        recommendationMetadata,
        {
          async save(request) {
            let savedMovieCount = 0;
            const detectedSource = {
              type: request.session.result.source.type,
              label: request.session.result.source.label,
            };
            const source = sourceFromMetadata(
              request.recommendationMetadata,
              detectedSource,
            );

            for (const candidate of request.candidates) {
              const result =
                useLocalCollectionStore
                  .getState()
                  .addMovieToCollections(
                    request.collectionIds,
                    candidate.movie,
                    source,
                    request.recommendationMetadata,
                  );
              if (result.added.length > 0) {
                savedMovieCount += 1;
              }
            }

            const savedAt = new Date().toISOString();
            const savedSession: CaptureSession = {
              ...request.session,
              status: "saved",
              approvedCandidateIds: request.candidates.map(
                (candidate) => candidate.id,
              ),
              collectionIds: request.collectionIds,
              savedByUserId:
                useCollaborationStore.getState().activeUserId,
              recommendationMetadata:
                request.recommendationMetadata,
              savedAt,
            };

            useCaptureStore.getState().saveSession(savedSession);

            return {
              session: savedSession,
              savedMovieCount,
              collectionIds: request.collectionIds,
            };
          },
        },
      );
    },
    [],
  );

  const value = useMemo(() => ({ receive, save }), [receive, save]);

  return (
    <CaptureServiceContext.Provider value={value}>
      {children}
    </CaptureServiceContext.Provider>
  );
}

export function useCaptureService(): CaptureServiceContextValue {
  const context = useContext(CaptureServiceContext);
  if (!context) {
    throw new Error(
      "useCaptureService must be used within CaptureServiceProvider.",
    );
  }
  return context;
}
