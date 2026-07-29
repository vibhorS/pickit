/**
 * Runtime tracer for recommendation.id provenance.
 * Follows ONE object instance from birth → Supabase payload.
 */

export type RecIdTraceEvent = {
  phase: string;
  id: string;
  objectId: string;
  sameAsBirth: boolean | null;
  file: string;
  functionName: string;
  line: number;
  stack: string;
  at: string;
};

const BIRTH = Symbol.for("pickit.recommendation.birth");
const OBJECT_ID = Symbol.for("pickit.recommendation.objectId");

let birthRef: object | null = null;
let birthId: string | null = null;
let objectSerial = 0;

declare global {
  interface Window {
    __PICKIT_REC_ID_TRACE__?: RecIdTraceEvent[];
    __PICKIT_REC_ID_BIRTH__?: { id: string; objectId: string } | null;
  }
}

function push(event: RecIdTraceEvent): void {
  if (typeof window === "undefined") return;
  if (!window.__PICKIT_REC_ID_TRACE__) window.__PICKIT_REC_ID_TRACE__ = [];
  window.__PICKIT_REC_ID_TRACE__.push(event);
  console.info(`[REC-ID-TRACE] ${event.phase}`, event);
  if (event.id.startsWith("rec-")) {
    console.error("[REC-ID-TRACE] ✗ id has rec- prefix at this phase", event);
  }
}

export function resetRecIdTrace(): void {
  birthRef = null;
  birthId = null;
  if (typeof window !== "undefined") {
    window.__PICKIT_REC_ID_TRACE__ = [];
    window.__PICKIT_REC_ID_BIRTH__ = null;
  }
  console.info("[REC-ID-TRACE] RESET");
}

export function tagRecommendationBirth<T extends { id: string }>(
  obj: T,
  meta: { file: string; functionName: string; line: number },
): T {
  objectSerial += 1;
  const objectId = `obj-${objectSerial}`;
  birthRef = obj;
  birthId = obj.id;
  Object.defineProperty(obj, BIRTH, { value: obj.id, enumerable: false });
  Object.defineProperty(obj, OBJECT_ID, { value: objectId, enumerable: false });

  if (typeof window !== "undefined") {
    window.__PICKIT_REC_ID_BIRTH__ = { id: obj.id, objectId };
  }

  push({
    phase: "BIRTH — first assignment of recommendation.id",
    id: obj.id,
    objectId,
    sameAsBirth: true,
    file: meta.file,
    functionName: meta.functionName,
    line: meta.line,
    stack: new Error().stack ?? "",
    at: new Date().toISOString(),
  });

  return obj;
}

export function traceRecommendation(
  obj: { id: string } | null | undefined,
  phase: string,
  meta: { file: string; functionName: string; line: number },
): void {
  if (!obj) {
    console.error(`[REC-ID-TRACE] ${phase} — object is null/undefined`);
    return;
  }
  const objectId =
    (obj as { [OBJECT_ID]?: string })[OBJECT_ID] ?? "UNTAGGED";
  const sameAsBirth = birthRef ? obj === birthRef : null;
  push({
    phase,
    id: obj.id,
    objectId,
    sameAsBirth,
    file: meta.file,
    functionName: meta.functionName,
    line: meta.line,
    stack: new Error().stack ?? "",
    at: new Date().toISOString(),
  });
}

export function assertValidRecommendationId(
  id: unknown,
  where: string,
): void {
  const value = String(id ?? "");
  const ok =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    );
  if (!ok) {
    console.error(`[REC-ID-TRACE] INVALID ID at ${where}`, {
      id: value,
      birthId,
      stack: new Error().stack,
      trace:
        typeof window !== "undefined" ? window.__PICKIT_REC_ID_TRACE__ : null,
    });
    throw new Error(
      `Invalid recommendation.id at ${where}: "${value}". Expected a bare UUID. Refusing to persist.`,
    );
  }
}
