

export enum UserRole {
  ADMIN = 'admin',
  APPROVER = 'approver',
}

export interface User {
  id: string; // This will be the Supabase auth user ID (UUID)
  email: string;
  role: UserRole;
  fullName?: string; // Add a full name for display purposes
}

export interface Vendor {
    id: string;
    name: string;
    contactPerson: string;
    contactEmail: string;
}

export enum RequestType {
  DIESEL = 'Diesel Requisition',
  PROCUREMENT = 'Product Procurement',
  LEAVE = 'Leave Request',
  ITEM = 'Item Request',
  STORE = 'Store Requisition',
}

export enum ApprovalStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  SENT_BACK = 'Sent Back for Correction',
  COMPLETED = 'Completed',
}

export interface Approver {
  userId: string; // Supabase auth user ID
  userEmail?: string; // Store email for easier display
  status: ApprovalStatus;
  comments?: string;
  approvedAt?: string;
  signature?: string;
  hodComments?: string;
  internalAuditComments?: string;
  finalAmount?: number;
}

export interface PdfComment {
  id?: number; // Added for database primary key
  requestId: string;
  userId: string;
  userEmail?: string; // Store email for display
  comment: string;
  createdAt: string;
}

export interface StoreItem {
  id: string;
  name: string;
  purpose: string;
  quantityInStock: number;
  lastPurchaseDate: string;
  unitCost: number;
}

export interface StoreRequisitionItem {
    itemId: string;
    itemName: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
}

// FIX: Added Annotation interface to support PDF annotations.
export interface Annotation {
  id: string;
  type: 'draw' | 'text';
  page: number;
  x: number;
  y: number;
  content?: string;
  color: string;
  points?: { x: number; y: number }[];
}

export interface Request {
  id: string;
  requesterId: string;
  requesterName: string;
  type: RequestType;
  details: { [key: string]: any };
  status: ApprovalStatus;
  approvalQueue: Approver[];
  currentApproverIndex: number;
  createdAt: string;
  file?: File; // Only for frontend state before upload
  fileName?: string;
  fileURL?: string;
  pdfComments?: PdfComment[];
  requesterSignature?: string;
  vendorId?: string;
  // FIX: Added optional annotations property to the Request interface.
  annotations?: Annotation[];
}

export interface Notification {
  id: string;
  message: string;
  requestId: string;
  isRead: boolean;
  createdAt: string;
}
