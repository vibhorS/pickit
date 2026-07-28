/** Shared audit fields for every cloud-synced domain entity. */
export type AuditFields = {
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type SoftDeletable = {
  deletedAt?: string | null;
};

export function isDeleted(entity: SoftDeletable): boolean {
  return Boolean(entity.deletedAt);
}

export function stampCreate(userId: string, now = new Date().toISOString()) {
  return {
    createdBy: userId,
    updatedBy: userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null as string | null,
  };
}

export function stampUpdate(userId: string, now = new Date().toISOString()) {
  return {
    updatedBy: userId,
    updatedAt: now,
  };
}

export function stampDelete(userId: string, now = new Date().toISOString()) {
  return {
    updatedBy: userId,
    updatedAt: now,
    deletedAt: now,
  };
}
