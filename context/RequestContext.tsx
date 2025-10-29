

import React, { createContext, useState, ReactNode, useCallback, useEffect, useMemo } from 'react';
import { Request, ApprovalStatus, PdfComment, RequestType, Approver, User, UserRole } from '../types.ts';
import { supabase } from '../lib/supabaseClient.ts';
import { useAuth } from '../hooks/useAuth.ts';

interface RequestContextType {
  requests: Request[];
  users: User[];
  approvers: User[];
  loading: boolean;
  error: string | null;
  addRequest: (request: Omit<Request, 'id' | 'createdAt' | 'status' | 'currentApproverIndex' | 'pdfComments'>, file: File | null) => Promise<{ success: boolean; error: string | null }>;
  updateRequest: (request: Request, file: File | null) => Promise<{ success: boolean; error: string | null }>;
  updateRequestStatus: (requestId: string, approverId: string, status: ApprovalStatus, comments: string, signature: string, hodComments?: string, auditDetails?: { internalAuditComments?: string; finalAmount?: number }) => Promise<{ success: boolean; error: string | null }>;
  updateItemRequestStatus: (requestId: string, status: ApprovalStatus) => Promise<{ success: boolean; error: string | null }>;
  addPdfComment: (requestId: string, userId: string, userEmail: string, comment: string) => Promise<{ success: boolean; error: string | null }>;
  getUserById: (id: string) => User | undefined;
  refreshData: () => void;
}

export const RequestContext = createContext<RequestContextType | undefined>(undefined);

interface RequestProviderProps {
  children?: ReactNode;
}

const parseSupabaseError = (error: any, context: string): string => {
    console.error(`Supabase error in ${context}:`, error);
    if (error.message.includes('security violation') || error.message.includes('permission denied')) {
        return `Permission Denied: You do not have the required permissions to perform this action. Please contact an administrator. (Context: ${context})`;
    }
    return `A database error occurred. Please try again. (Details: ${error.message})`;
};

const parseNetworkError = (error: any, context: string): string => {
    console.error(`Network/unknown error in ${context}:`, error);
    if (error.message === 'Failed to fetch' && typeof navigator !== 'undefined' && !navigator.onLine) {
         return `You appear to be offline. Please check your internet connection. (Context: ${context})`;
    }
    return `A network error occurred. Please check your internet connection or browser extensions. (Context: ${context}, Details: ${error.message})`;
}

export const RequestProvider = ({ children }: RequestProviderProps) => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const approvers = useMemo(() => users.filter(u => u.role === UserRole.APPROVER), [users]);
  const getUserById = useCallback((id: string) => users.find(u => u.id === id), [users]);
  
  const refreshData = useCallback(() => setRefreshTrigger(t => t + 1), []);

  useEffect(() => {
    const fetchData = async () => {
        if (!currentUser) {
            setLoading(false);
            setUsers([]);
            setRequests([]);
            return;
        }
        setLoading(true);
        setError(null);

        try {
            const [usersResponse, requestsResponse, commentsResponse] = await Promise.all([
                supabase.from('profiles').select('id, email, role, full_name'),
                supabase.from('requests').select('*').order('created_at', { ascending: false }),
                supabase.from('pdf_comments').select('*')
            ]);

            if (usersResponse.error) throw usersResponse.error;
            if (requestsResponse.error) throw requestsResponse.error;
            if (commentsResponse.error) throw commentsResponse.error;

            const formattedUsers = (usersResponse.data || []).map(p => ({
                id: p.id,
                email: p.email,
                role: p.role,
                fullName: p.full_name
            })) as User[];
            setUsers(formattedUsers);

            const userMap = new Map<string, User>(formattedUsers.map(u => [u.id, u]));

            const commentsByRequestId = (commentsResponse.data || []).reduce((acc, c) => {
                const comment: PdfComment = {
                    id: c.id, requestId: c.request_id, userId: c.user_id,
                    userEmail: c.user_email, comment: c.comment, createdAt: c.created_at
                };
                (acc[c.request_id] = acc[c.request_id] || []).push(comment);
                return acc;
            }, {} as Record<string, PdfComment[]>);

            const formattedRequests = (requestsResponse.data || []).map((req): Request => {
                const robustApprovalQueue = (req.approval_queue || []).map((approverInDb: any) => {
                    const userId = approverInDb.user_id || approverInDb.userId;
                    const user = userMap.get(userId);
                    const baseApproverData = {
                        userId: userId, status: approverInDb.status, comments: approverInDb.comments,
                        approvedAt: approverInDb.approved_at, signature: approverInDb.signature,
                        hodComments: approverInDb.hod_comments, internalAuditComments: approverInDb.internal_audit_comments,
                        finalAmount: approverInDb.final_amount,
                    };

                    if (user) {
                        return { ...baseApproverData, userEmail: user.email };
                    } else {
                         return {
                            ...baseApproverData,
                            userEmail: approverInDb.user_email || `Unknown User (${(userId || 'no-id').substring(0, 8)})`,
                        };
                    }
                });

                return {
                    id: req.id,
                    requesterId: req.requester_id,
                    requesterName: req.requester_name,
                    type: req.type,
                    details: req.details,
                    status: req.status,
                    approvalQueue: robustApprovalQueue,
                    currentApproverIndex: req.current_approver_index,
                    createdAt: req.created_at,
                    fileName: req.file_name,
                    fileURL: req.file_url,
                    pdfComments: commentsByRequestId[req.id] || [],
                    requesterSignature: req.requester_signature,
                    vendorId: req.vendor_id,
                };
            });
            setRequests(formattedRequests);
        } catch (e: any) {
            let detailedMessage = `Details: ${e.message}`;
            if (e.message === 'Failed to fetch' && typeof navigator !== 'undefined' && !navigator.onLine) {
                detailedMessage = "It appears you are offline. Please check your internet connection.";
            }
            const errorMessage = `A network or unexpected error occurred while fetching data. This can be caused by network connectivity issues or ad-blockers. ${detailedMessage}`;
            console.error(errorMessage, e);
            setError(errorMessage);
            setRequests([]);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    fetchData();
  }, [currentUser, refreshTrigger]);

  const addRequest = useCallback(async (newRequestData: Omit<Request, 'id' | 'createdAt' | 'status' | 'currentApproverIndex' | 'pdfComments'>, file: File | null): Promise<{ success: boolean; error: string | null }> => {
    if (!currentUser) return { success: false, error: "User not authenticated" };
    
    try {
        let fileURL = '';
        let fileName = '';

        if (file) {
            const filePath = `${currentUser.id}/${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabase.storage
                .from('request_attachments')
                .upload(filePath, file);

            if (uploadError) return { success: false, error: parseSupabaseError(uploadError, 'file upload') };

            const { data: urlData } = supabase.storage
                .from('request_attachments')
                .getPublicUrl(filePath);
            fileURL = urlData.publicUrl;
            fileName = file.name;
        }

        const approvalQueueForDb = newRequestData.approvalQueue.map(approver => {
            const user = getUserById(approver.userId);
            return { user_id: approver.userId, user_email: approver.userEmail || user?.email, status: approver.status };
        });

        const requestForDb = {
            requester_id: newRequestData.requesterId, requester_name: newRequestData.requesterName, type: newRequestData.type,
            details: newRequestData.details, status: ApprovalStatus.PENDING, approval_queue: approvalQueueForDb,
            current_approver_index: 0, file_url: fileURL, file_name: fileName,
            requester_signature: newRequestData.requesterSignature, vendor_id: newRequestData.vendorId,
        };

        const { error } = await supabase.from('requests').insert([requestForDb]);

        if (error) return { success: false, error: parseSupabaseError(error, 'add request') };

        refreshData();
        return { success: true, error: null };
    } catch (e: any) {
        return { success: false, error: parseNetworkError(e, 'add request') };
    }
  }, [currentUser, getUserById, refreshData]);

  const updateRequest = useCallback(async (updatedRequestData: Request, file: File | null): Promise<{ success: boolean; error: string | null }> => {
    if (!currentUser) return { success: false, error: "User not authenticated" };
    
    try {
        let fileURL = updatedRequestData.fileURL || '';
        let fileName = updatedRequestData.fileName || '';

        if (file) {
            const filePath = `${currentUser.id}/${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabase.storage
                .from('request_attachments')
                .upload(filePath, file);

            if (uploadError) return { success: false, error: parseSupabaseError(uploadError, 'file upload on update') };

            const { data: urlData } = supabase.storage
                .from('request_attachments')
                .getPublicUrl(filePath);
            fileURL = urlData.publicUrl;
            fileName = file.name;
        }
        
        const approvalQueueForDb = updatedRequestData.approvalQueue.map(approver => {
            const user = getUserById(approver.userId);
            return { user_id: approver.userId, user_email: user?.email || approver.userEmail, status: ApprovalStatus.PENDING };
        });

        const { error } = await supabase.rpc('resubmit_request_as_admin', {
            p_request_id: updatedRequestData.id, p_requester_name: updatedRequestData.requesterName,
            p_details: updatedRequestData.details, p_approval_queue: approvalQueueForDb,
            p_vendor_id: updatedRequestData.vendorId || null, p_file_url: fileURL || null, p_file_name: fileName || null,
            p_requester_signature: updatedRequestData.requesterSignature
        });
        
        if (error) return { success: false, error: parseSupabaseError(error, 'update request') };
        
        refreshData();
        return { success: true, error: null };
    } catch (e: any) {
        return { success: false, error: parseNetworkError(e, 'update request') };
    }
  }, [currentUser, getUserById, refreshData]);

  const updateRequestStatus = useCallback(async (requestId: string, approverId: string, action: ApprovalStatus, comments: string, signature: string, hodComments?: string, auditDetails?: { internalAuditComments?: string; finalAmount?: number }): Promise<{ success: boolean; error: string | null }> => {
    try {
        const { error } = await supabase.rpc('handle_request_action', {
            p_request_id: requestId, p_action: action, p_comments: comments || null, p_signature: signature,
            p_hod_comments: hodComments || null, p_internal_audit_comments: auditDetails?.internalAuditComments || null,
            p_final_amount: auditDetails?.finalAmount || null
        });

        if (error) return { success: false, error: parseSupabaseError(error, 'update request status') };

        refreshData();
        return { success: true, error: null };
    } catch (e: any) {
        return { success: false, error: parseNetworkError(e, 'update request status') };
    }
  }, [refreshData]);

  const updateItemRequestStatus = useCallback(async (requestId: string, newStatus: ApprovalStatus): Promise<{ success: boolean; error: string | null }> => {
    try {
        const { error } = await supabase.rpc('update_item_request_status_as_admin', {
            p_request_id: requestId, p_new_status: newStatus
        });

        if (error) return { success: false, error: parseSupabaseError(error, 'update item request status') };
        
        refreshData();
        return { success: true, error: null };
    } catch (e: any) {
        return { success: false, error: parseNetworkError(e, 'update item request status') };
    }
  }, [refreshData]);

  const addPdfComment = useCallback(async (requestId: string, userId: string, userEmail: string, comment: string): Promise<{ success: boolean; error: string | null }> => {
    try {
        const { error } = await supabase
            .from('pdf_comments')
            .insert([{ request_id: requestId, user_id: userId, user_email: userEmail, comment }]);

        if (error) return { success: false, error: parseSupabaseError(error, 'add PDF comment') };
        
        refreshData();
        return { success: true, error: null };
    } catch (e: any) {
        return { success: false, error: parseNetworkError(e, 'add PDF comment') };
    }
  }, [refreshData]);

  const value = useMemo(() => ({ 
    requests, users, approvers, loading, error, 
    addRequest, updateRequest, updateRequestStatus, 
    updateItemRequestStatus, addPdfComment,
    getUserById, refreshData,
  }), [requests, users, approvers, loading, error, addRequest, updateRequest, updateRequestStatus, updateItemRequestStatus, addPdfComment, getUserById, refreshData]);

  return (
    <RequestContext.Provider value={value}>
      {children}
    </RequestContext.Provider>
  );
};