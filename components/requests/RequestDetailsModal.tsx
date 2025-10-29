import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Request, ApprovalStatus, UserRole, RequestType, StoreRequisitionItem } from '../../types.ts';
import { useRequests } from '../../hooks/useRequests.ts';
import { useAuth } from '../../hooks/useAuth.ts';
import { useVendors } from '../../hooks/useVendors.ts';
import { X, CheckCircle, XCircle, Clock, Paperclip, Edit, Send, ShoppingCart, Download, MessageSquare, AlertTriangle, Loader2 } from 'lucide-react';
import PdfViewerWithComments from './PdfViewerWithComments.tsx';
import RequestPDFLayout from './RequestPDFLayout.tsx';
import SignaturePad, { SignaturePadRef } from '../shared/SignaturePad.tsx';

interface RequestDetailsModalProps {
    request: Request;
    onClose: () => void;
    onEdit?: (request: Request) => void;
    onCreateProcurement?: (request: Request) => void;
}

const RequestDetailsModal = ({ request, onClose, onEdit, onCreateProcurement }: RequestDetailsModalProps) => {
    const { updateRequestStatus, getUserById, users } = useRequests();
    const { currentUser } = useAuth();
    const { getVendorById } = useVendors();
    const [comments, setComments] = useState('');
    const [hodComments, setHODComments] = useState('');
    const [internalAuditComments, setInternalAuditComments] = useState('');
    const [finalAmount, setFinalAmount] = useState<string>('');
    const [isViewingPdf, setIsViewingPdf] = useState(false);
    const signaturePadRef = useRef<SignaturePadRef>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const pdfLayoutRef = useRef<HTMLDivElement>(null);

    const AUDITOR_EMAIL = 'auditorzankli@gmail.com';

    const vendor = useMemo(() => request.vendorId ? getVendorById(request.vendorId) : null, [request.vendorId, getVendorById]);
    const isAdmin = currentUser?.role === UserRole.ADMIN;
    
    const auditor = users.find(u => u.email === AUDITOR_EMAIL);
    const AUDITOR_ID = auditor ? auditor.id : null;


    const isCurrentUserApprover = useMemo(() => {
        if (!currentUser || request.status !== ApprovalStatus.PENDING) return false;
        if (request.type === RequestType.ITEM) return false;
        if (!request.approvalQueue || request.approvalQueue.length <= request.currentApproverIndex) return false;
        const currentApprover = request.approvalQueue[request.currentApproverIndex];
        return currentApprover?.userId === currentUser.id;
    }, [currentUser, request]);

    const isHOD = useMemo(() => {
        return request.type === RequestType.LEAVE && isCurrentUserApprover && currentUser?.id === request.details?.selectedHODId;
    }, [request, currentUser, isCurrentUserApprover]);
    
    const isAuditor = useMemo(() => {
        return isCurrentUserApprover && currentUser?.id === AUDITOR_ID;
    }, [isCurrentUserApprover, currentUser, AUDITOR_ID]);


    const handleAction = async (status: ApprovalStatus) => {
        if (!currentUser) return;
        setActionError(null);
        setIsSubmitting(true);
        
        const signature = signaturePadRef.current?.getSignature();
        if (!signature) {
            setActionError("Please provide your signature to complete this action.");
            setIsSubmitting(false);
            return;
        }
        
        if (status === ApprovalStatus.SENT_BACK && !comments.trim()) {
            setActionError("Comments are required when sending a request back for correction.");
            setIsSubmitting(false);
            return;
        }

        const parsedFinalAmount = parseFloat(finalAmount);
        const auditDetails = isAuditor ? {
            internalAuditComments,
            finalAmount: !finalAmount || isNaN(parsedFinalAmount) ? undefined : parsedFinalAmount
        } : undefined;

        const result = await updateRequestStatus(request.id, currentUser.id, status, comments, signature, isHOD ? hodComments : undefined, auditDetails);
        
        if (result.success) {
            onClose();
        } else {
            setActionError(result.error);
            setIsSubmitting(false);
        }
    };
    
    // This function is now a callback, called by RequestPDFLayout when it's fully rendered.
    const generatePdfFromLayout = useCallback(async () => {
        const elementToCapture = pdfLayoutRef.current;
        if (!elementToCapture) {
            console.error("PDF layout element ref is not available.");
            setIsGeneratingPdf(false);
            return;
        }

        try {
            // This is the definitive fix for missing signatures. We find all images in the
            // layout and wait for them to be fully loaded before calling html2canvas.
            const images = Array.from(elementToCapture.getElementsByTagName('img'));
            // FIX: Explicitly type `img` as HTMLImageElement to fix type inference issues.
            const imageLoadPromises = images.map((img: HTMLImageElement) => {
                return new Promise<void>((resolve, reject) => {
                    if (img.complete && img.naturalHeight !== 0) {
                        resolve();
                    } else {
                        img.onload = () => resolve();
                        img.onerror = () => reject(new Error(`Could not load image: ${img.src.substring(0, 100)}...`));
                    }
                });
            });

            await Promise.all(imageLoadPromises);

            // Use a higher scale for better resolution
            const canvas = await html2canvas(elementToCapture, { scale: 2, useCORS: true, logging: false });
            
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const ratio = canvasWidth / pdfWidth;
            const calculatedHeight = canvasHeight / ratio;
            const pdfHeight = pdf.internal.pageSize.getHeight();

            let heightLeft = calculatedHeight;
            let position = 0;

            // Add the first page
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, calculatedHeight);
            heightLeft -= pdfHeight;

            // Add new pages if content overflows
            while (heightLeft > 0) {
                position = position - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, calculatedHeight);
                heightLeft -= pdfHeight;
            }

            pdf.save(`request-${request.id}.pdf`);
        } catch (error: any) {
            console.error("Error generating PDF:", error);
            alert(`An error occurred while generating the PDF: ${error.message}`);
        } finally {
            setIsGeneratingPdf(false); // Reset state after generation is complete or fails
        }
    }, [request.id]);
    
    // This function now just sets a state to begin the PDF generation process.
    const handleDownloadPdf = () => {
        if (!isGeneratingPdf) {
            setIsGeneratingPdf(true); // This will trigger the rendering of RequestPDFLayout
        }
    };

    const StatusIcon = ({ status }: { status: ApprovalStatus }) => {
        switch (status) {
            case ApprovalStatus.APPROVED: return <CheckCircle className="w-5 h-5 text-green-500" />;
            case ApprovalStatus.REJECTED: return <XCircle className="w-5 h-5 text-red-500" />;
            case ApprovalStatus.SENT_BACK: return <Send className="w-5 h-5 text-blue-500" />;
            default: return <Clock className="w-5 h-5 text-yellow-500" />;
        }
    };
    
    if (isViewingPdf && request.fileURL) {
        return <PdfViewerWithComments request={request} onClose={() => setIsViewingPdf(false)} />;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
             {/* The RequestPDFLayout is now rendered conditionally and positioned off-screen.
                 It will call `generatePdfFromLayout` via its `onReady` prop when it has finished rendering all its content. */}
            {isGeneratingPdf && (
                <div style={{ position: 'absolute', left: '-9999px', top: 0, zIndex: -1, width: '210mm' }}>
                    <RequestPDFLayout
                        ref={pdfLayoutRef}
                        request={request}
                        onReady={generatePdfFromLayout} // Pass the generation function as a callback
                    />
                </div>
            )}
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">{request.type} - {request.id}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-grow">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left Column: Request Details */}
                        <div className="space-y-4">
                             <div>
                                <h3 className="font-semibold text-gray-700">Subject</h3>
                                <p className="text-gray-600">{request.details?.subject || 'No Subject'}</p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-700">Requester</h3>
                                <p className="text-gray-600">{request.requesterName} ({getUserById(request.requesterId)?.email})</p>
                            </div>
                             <div>
                                <h3 className="font-semibold text-gray-700">Submitted On</h3>
                                <p className="text-gray-600">{new Date(request.createdAt).toLocaleString()}</p>
                            </div>
                            {request.requesterSignature && (
                                <div>
                                    <h3 className="font-semibold text-gray-700">Requester's Signature</h3>
                                    <div className="mt-1 p-2 border rounded-md bg-gray-50 inline-block">
                                        <img src={request.requesterSignature} alt="Requester's Signature" className="h-16" />
                                    </div>
                                </div>
                            )}

                             {vendor && (
                                <div>
                                    <h3 className="font-semibold text-gray-700">Vendor</h3>
                                    <p className="text-gray-600">{vendor.name}</p>
                                </div>
                            )}

                            <div className="space-y-2 pt-2 border-t">
                                <h3 className="font-semibold text-gray-700">Details</h3>
                                {Object.entries(request.details || {}).filter(([key]) => !['subject', 'selectedHODId', 'items', 'grandTotal'].includes(key)).map(([key, value]) => {
                                    const isCurrency = ['unitCost', 'totalCost', 'costPerLiter', 'finalAmount'].includes(key) && typeof value === 'number';
                                    const displayValue = isCurrency
                                        ? Number(value).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })
                                        : String(value);

                                    return (
                                        <div key={key} className="flex text-sm">
                                            <span className="font-medium text-gray-500 capitalize w-36">{key.replace(/([A-Z])/g, ' $1')}:</span>
                                            <span className="text-gray-800">{displayValue}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            
                             {request.type === RequestType.STORE && request.details?.items && (
                                <div className="pt-4 mt-4 border-t">
                                    <h3 className="font-semibold text-gray-700 mb-2">Requested Items</h3>
                                    <div className="border rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-medium text-gray-600">Item</th>
                                                    <th className="px-3 py-2 text-center font-medium text-gray-600">Qty</th>
                                                    <th className="px-3 py-2 text-right font-medium text-gray-600">Unit Cost</th>
                                                    <th className="px-3 py-2 text-right font-medium text-gray-600">Total Cost</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(request.details?.items as StoreRequisitionItem[] || []).map(item => (
                                                    <tr key={item.itemId} className="border-b last:border-0">
                                                        <td className="px-3 py-2">{item.itemName}</td>
                                                        <td className="px-3 py-2 text-center">{item.quantity}</td>
                                                        <td className="px-3 py-2 text-right">{(item.unitCost || 0).toLocaleString()}</td>
                                                        <td className="px-3 py-2 text-right font-medium">{(item.totalCost || 0).toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="font-bold bg-gray-50">
                                                    <td colSpan={3} className="px-3 py-2 text-right">Grand Total</td>
                                                    <td className="px-3 py-2 text-right text-base">
                                                        {(request.details?.grandTotal || 0).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {request.fileURL && (
                                <div className="space-y-2">
                                     <h3 className="font-semibold text-gray-700">Attachment</h3>
                                     <div className="flex items-center justify-between p-2 border rounded-md">
                                        <div className="flex items-center">
                                            <Paperclip className="h-5 w-5 mr-2 text-gray-400"/>
                                            <a href={request.fileURL} target="_blank" rel="noopener noreferrer" className="text-sm text-zankli-orange-600 hover:underline">{request.fileName}</a>
                                        </div>
                                        <button onClick={() => setIsViewingPdf(true)} className="flex items-center text-sm text-zankli-orange-600 hover:text-zankli-orange-800">
                                            <MessageSquare className="h-4 w-4 mr-1"/> View Document & Comments
                                        </button>
                                     </div>
                                </div>
                            )}

                        </div>

                        {/* Right Column: Approval Status */}
                        <div>
                            <h3 className="font-semibold text-gray-700 mb-2">Approval Queue</h3>
                            {request.approvalQueue && request.approvalQueue.length > 0 ? (
                            <ul className="space-y-4">
                                {request.approvalQueue.map((approver, index) => {
                                    const user = getUserById(approver.userId);
                                    const isDesignatedHOD = request.type === RequestType.LEAVE && request.details?.selectedHODId === approver.userId;
                                    return (
                                        <li key={index} className="flex items-start">
                                            <div className="pt-1"><StatusIcon status={approver.status} /></div>
                                            <div className="ml-3">
                                                <p className="text-sm font-medium text-gray-800 flex items-center">{user?.email} {isDesignatedHOD && <span className="ml-2 text-xs font-bold text-zankli-orange-700 bg-zankli-orange-100 px-2 py-0.5 rounded-full">HOD</span>}</p>
                                                <p className="text-xs text-gray-500">{approver.status}</p>
                                                {approver.comments && <p className="text-xs text-gray-600 mt-1 italic">"{approver.comments}"</p>}
                                                {approver.hodComments && <p className="text-xs font-semibold text-zankli-orange-800 mt-1">HOD Comments: <span className="font-normal italic">"{approver.hodComments}"</span></p>}
                                                {approver.internalAuditComments && <p className="text-xs font-semibold text-purple-800 mt-1">Audit Comments: <span className="font-normal italic">"{approver.internalAuditComments}"</span></p>}
                                                {approver.finalAmount !== undefined && approver.finalAmount !== null && <p className="text-xs font-semibold text-purple-800 mt-1">Final Amount: <span className="font-normal">{approver.finalAmount.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}</span></p>}
                                                {approver.approvedAt && <p className="text-xs text-gray-400 mt-1">{new Date(approver.approvedAt).toLocaleString()}</p>}
                                                {approver.signature && (
                                                    <div className="mt-2 p-1 border rounded-md bg-gray-50 inline-block">
                                                        <img src={approver.signature} alt="Approver's Signature" className="h-12" />
                                                    </div>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                            ) : <p className="text-sm text-gray-500">No approval queue for this request type.</p> }
                        </div>
                    </div>
                </div>
                
                 <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-start">
                    <button 
                        onClick={handleDownloadPdf}
                        disabled={isGeneratingPdf}
                        className="flex items-center px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-wait"
                    >
                        {isGeneratingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                        {isGeneratingPdf ? 'Generating PDF...' : 'Download as PDF'}
                    </button>
                </div>


                {isCurrentUserApprover && request.status === ApprovalStatus.PENDING && (
                    <div className="p-6 border-t bg-gray-50 rounded-b-lg">
                        <h3 className="font-semibold text-gray-700 mb-2">Take Action</h3>
                        {actionError && (
                            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg mb-4 flex items-start">
                                <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold">Action Failed</p>
                                    <p className="text-sm">{actionError}</p>
                                </div>
                            </div>
                        )}
                        {isAuditor && (
                            <div className="bg-purple-50 border border-purple-200 p-3 rounded-md mb-4">
                                <h4 className="font-bold text-purple-800 mb-2">Internal Audit Section</h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Internal Audit Comments</label>
                                        <textarea
                                            value={internalAuditComments}
                                            onChange={(e) => setInternalAuditComments(e.target.value)}
                                            placeholder="Add internal audit comments..."
                                            className="w-full p-2 border rounded-md text-sm border-purple-300 focus:ring-purple-500 focus:border-purple-500"
                                            rows={2}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Final Amount (NGN)</label>
                                        <input
                                            type="number"
                                            value={finalAmount}
                                            onChange={(e) => setFinalAmount(e.target.value)}
                                            placeholder="Enter final approved amount"
                                            className="w-full p-2 border rounded-md text-sm border-purple-300 focus:ring-purple-500 focus:border-purple-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div>
                                {isHOD && (
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">HOD Comments</label>
                                        <textarea
                                            value={hodComments}
                                            onChange={(e) => setHODComments(e.target.value)}
                                            placeholder="Add HOD specific comments..."
                                            className="w-full p-2 border rounded-md text-sm border-zankli-orange-300 focus:ring-zankli-orange-500 focus:border-zankli-orange-500"
                                            rows={2}
                                        />
                                    </div>
                                )}
                                <label className="block text-sm font-medium text-gray-700 mb-1">General Comments</label>
                                <textarea
                                    value={comments}
                                    onChange={(e) => setComments(e.target.value)}
                                    placeholder="Add optional comments..."
                                    className="w-full p-2 border rounded-md text-sm"
                                    rows={isHOD ? 2 : 5}
                                />
                            </div>
                            <div>
                                {isCurrentUserApprover && <SignaturePad ref={signaturePadRef} label="Your Signature" />}
                            </div>
                        </div>

                        <div className="mt-3 flex justify-end space-x-3">
                             <button
                                onClick={() => handleAction(ApprovalStatus.SENT_BACK)}
                                disabled={isSubmitting}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center min-w-[110px]"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Send Back'}
                            </button>
                            <button
                                onClick={() => handleAction(ApprovalStatus.REJECTED)}
                                disabled={isSubmitting}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-red-300 flex items-center justify-center min-w-[110px]"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Reject'}
                            </button>
                            <button
                                onClick={() => handleAction(ApprovalStatus.APPROVED)}
                                disabled={isSubmitting}
                                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-green-300 flex items-center justify-center min-w-[110px]"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Approve'}
                            </button>
                        </div>
                    </div>
                )}
                
                {isAdmin && request.status === ApprovalStatus.SENT_BACK && onEdit && (
                    <div className="p-6 border-t bg-gray-50 rounded-b-lg flex justify-end">
                        <button
                            onClick={() => onEdit(request)}
                            className="px-6 py-2 text-sm font-medium text-white bg-zankli-orange-600 rounded-md hover:bg-zankli-orange-700 flex items-center"
                        >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Request
                        </button>
                    </div>
                )}

                {isAdmin && request.type === RequestType.ITEM && request.status === ApprovalStatus.PENDING && onCreateProcurement && (
                    <div className="p-6 border-t bg-gray-50 rounded-b-lg flex justify-end">
                         <button
                            onClick={() => onCreateProcurement(request)}
                            className="px-6 py-2 text-sm font-medium text-white bg-zankli-orange-600 rounded-md hover:bg-zankli-orange-700 flex items-center"
                        >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Create Procurement Request
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RequestDetailsModal;