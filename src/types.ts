/**
 * Type declarations for the Pageify Studio app.
 */

export type ProgressStatus = 'en_espera' | 'en_curso' | 'hecho' | 'finalizado' | 'cambios_solicitados';
export type PaymentStatus = 'pendiente' | 'pagado';

export interface Order {
  id: string; // matches document ID
  clientId: string;
  clientEmail: string;
  clientPhone: string;
  clientName: string;
  description: string;
  price: number;
  progressStatus: ProgressStatus;
  paymentStatus: PaymentStatus;
  resultUrl?: string;
  resultCode?: string;
  changesCount: number;
  changesDescription?: string;
  createdAt: string; // date-time representation (JSON format)
  updatedAt: string; // date-time representation (JSON format)
  sheetSynced?: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string; // ISO String
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}
