
import React, { forwardRef, useEffect, useRef, useState, memo, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Request, ApprovalStatus, StoreRequisitionItem, PdfComment } from '../../types.ts';
import { useRequests } from '../../hooks/useRequests.ts';
import { supabase } from '../../lib/supabaseClient.ts';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://aistudiocdn.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs`;

interface PDFPageRendererProps {
    pageNum: number;
    pdfDoc: pdfjsLib.PDFDocumentProxy;
    onRendered: () => void;
}

const PDFPageRenderer = memo(({ pageNum, pdfDoc, onRendered }: PDFPageRendererProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const render = async () => {
            try {
                const page = await pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = canvasRef.current;
                if (!canvas) return;

                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                canvas.height = viewport.height;
                canvas.width = viewport.width;
                // FIX: Cast render parameters to 'any' to bypass incorrect type definitions from @types/pdfjs-dist.
                await page.render({ canvasContext: ctx, viewport } as any).promise;

            } catch (error) {
                console.error(`Failed to render PDF page ${pageNum}:`, error);
            } finally {
                onRendered();
            }
        };
        if(pdfDoc) render();
    }, [pageNum, pdfDoc, onRendered]);

    return <canvas ref={canvasRef} style={{ border: '1px solid #ccc', maxWidth: '100%', breakInside: 'avoid', marginBottom: '16px' }} />;
});

interface RequestPDFLayoutProps {
    request: Request;
    onReady: () => void;
}

const RequestPDFLayout = forwardRef<HTMLDivElement, RequestPDFLayoutProps>(({ request, onReady }, ref) => {
    const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [pagesRenderedCount, setPagesRenderedCount] = useState(0);
    const { getUserById } = useRequests();
    const isReadyCalled = useRef(false);

    const handlePageRendered = useCallback(() => {
        setPagesRenderedCount(prev => prev + 1);
    }, []);

    useEffect(() => {
        const loadPdf = async () => {
            if (!request.fileURL) return;
            try {
                // Robustly parse the file path from the full Supabase URL.
                const url = new URL(request.fileURL);
                const pathSegments = url.pathname.split('/');
                const bucketIndex = pathSegments.findIndex(segment => segment === 'request_attachments');
                if (bucketIndex === -1 || bucketIndex + 1 >= pathSegments.length) {
                    throw new Error('Could not parse file path from URL');
                }
                const filePath = pathSegments.slice(bucketIndex + 1).join('/');

                // Use the authenticated Supabase client to download the file, bypassing CORS issues.
                const { data: blob, error: downloadError } = await supabase.storage.from('request_attachments').download(filePath);

                if (downloadError) throw downloadError;
                if (!blob) throw new Error("PDF download returned null.");

                const pdfData = await blob.arrayBuffer();

                const loadingTask = pdfjsLib.getDocument({ data: pdfData });
                const pdfDoc = await loadingTask.promise;
                setPdf(pdfDoc);
            } catch (error) {
                console.error("Failed to load PDF for preview:", error);
            }
        };
        loadPdf();
    }, [request.fileURL]);

    useEffect(() => {
        if (isReadyCalled.current) return;

        // The PDF is considered ready if it doesn't exist, or if all its pages have been rendered.
        const isPdfReady = !pdf || (pagesRenderedCount > 0 && pagesRenderedCount === pdf.numPages);
        
        if (isPdfReady) {
            // Use requestAnimationFrame to ensure the browser has painted the latest updates,
            // including all signature images, before we signal readiness for PDF generation.
            const handle = requestAnimationFrame(() => {
                if (!isReadyCalled.current) {
                    onReady();
                    isReadyCalled.current = true;
                }
            });
            // Cleanup function to cancel the animation frame if the component unmounts
            return () => cancelAnimationFrame(handle);
        }
    }, [pdf, pagesRenderedCount, onReady]);
    
    const StatusBadge = ({ status }: { status: ApprovalStatus }) => {
        const colors = {
          [ApprovalStatus.PENDING]: { bg: '#FEF3C7', text: '#92400E' },
          [ApprovalStatus.APPROVED]: { bg: '#D1FAE5', text: '#065F46' },
          [ApprovalStatus.REJECTED]: { bg: '#FEE2E2', text: '#991B1B' },
          [ApprovalStatus.SENT_BACK]: { bg: '#DBEAFE', text: '#1E40AF' },
          [ApprovalStatus.COMPLETED]: { bg: '#E0E7FF', text: '#3730A3' },
        };
        const style = {
            padding: '4px 12px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: colors[status].bg,
            color: colors[status].text,
        };
        return <span style={style}>{status}</span>;
    };

    return (
        <div ref={ref} style={{ width: '210mm', backgroundColor: 'white', color: '#1f2937', fontFamily: 'sans-serif' }}>
            <div style={{ padding: '24px' }}>
                {/* Header */}
                <header style={{ borderBottom: '2px solid #f3f4f6', paddingBottom: '16px', marginBottom: '24px' }}>
                    <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#c8410c' }}>Zankli Medical Centre</h1>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '600' }}>{request.type} - {request.id}</h2>
                        <StatusBadge status={request.status} />
                    </div>
                </header>

                {/* Main Details */}
                <section style={{ marginBottom: '24px' }}>
                     <h3 style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', marginBottom: '12px' }}>Request Details</h3>
                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                         <DetailItem label="Subject" value={request.details?.subject || ''} />
                         <DetailItem label="Requester" value={`${request.requesterName} (${getUserById(request.requesterId)?.email})`} />
                         <DetailItem label="Submitted On" value={new Date(request.createdAt).toLocaleString()} />
                     </div>
                     <div style={{ marginTop: '16px' }}>
                        {Object.entries(request.details || {}).filter(([key]) => !['subject', 'items', 'grandTotal'].includes(key)).map(([key, value]) => {
                            const isCurrency = ['unitCost', 'totalCost', 'costPerLiter', 'finalAmount'].includes(key);
                            const displayValue = isCurrency && value
                                ? Number(value).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })
                                : String(value);

                            return (
                                <DetailItem key={key} label={key.replace(/([A-Z])/g, ' $1')} value={displayValue} />
                            );
                        })}
                     </div>
                </section>
                
                 {request.type === 'Store Requisition' && (
                    <section style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', marginBottom: '12px' }}>Requested Items</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead style={{ backgroundColor: '#f9fafb' }}>
                                <tr>
                                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Item</th>
                                    <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #e5e7eb' }}>Qty</th>
                                    <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #e5e7eb' }}>Unit Cost</th>
                                    <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #e5e7eb' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(request.details?.items as StoreRequisitionItem[] || []).map(item => (
                                    <tr key={item.itemId}>
                                        <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{item.itemName}</td>
                                        <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #e5e7eb' }}>{item.quantity}</td>
                                        <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #e5e7eb' }}>{(item.unitCost || 0).toLocaleString()}</td>
                                        <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #e5e7eb' }}>{(item.totalCost || 0).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ fontWeight: 'bold' }}>
                                    <td colSpan={3} style={{ padding: '8px', textAlign: 'right', border: '1px solid #e5e7eb' }}>Grand Total</td>
                                    <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #e5e7eb' }}>{(request.details?.grandTotal || 0).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </section>
                )}


                {/* Approval Workflow */}
                <section style={{ marginBottom: '24px', breakInside: 'avoid' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', marginBottom: '12px' }}>Approval Workflow</h3>
                     <div style={{ borderLeft: '2px solid #e5e7eb', paddingLeft: '16px', marginLeft: '8px' }}>
                         <div style={{ position: 'relative', marginBottom: '24px' }}>
                            <div style={{ position: 'absolute', left: '-26px', top: '0', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#10B981', border: '2px solid white' }}></div>
                            <p style={{ fontWeight: '600' }}>Request Submitted</p>
                            <p style={{ fontSize: '12px', color: '#6b7280' }}>by {request.requesterName} on {new Date(request.createdAt).toLocaleString()}</p>
                             {request.requesterSignature && (
                                <div style={{ marginTop: '8px', padding: '4px', border: '1px solid #e5e7eb', borderRadius: '4px', backgroundColor: '#f9fafb', display: 'inline-block' }}>
                                    <img src={request.requesterSignature} alt="Requester's Signature" style={{ height: '48px' }} />
                                </div>
                            )}
                        </div>

                        {(request.approvalQueue || []).map((approver, index) => {
                             const user = getUserById(approver.userId);
                             const statusColors = {
                                [ApprovalStatus.PENDING]: '#FBBF24',
                                [ApprovalStatus.APPROVED]: '#34D399',
                                [ApprovalStatus.REJECTED]: '#F87171',
                                [ApprovalStatus.SENT_BACK]: '#60A5FA',
                             };
                            return (
                                <div key={index} style={{ position: 'relative', marginBottom: '24px' }}>
                                    <div style={{ position: 'absolute', left: '-26px', top: '0', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: statusColors[approver.status] || '#d1d5db', border: '2px solid white' }}></div>
                                    <p style={{ fontWeight: '600' }}>{index + 1}. {user?.email}</p>
                                    <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280' }}>Status: {approver.status}</p>
                                    {approver.approvedAt && <p style={{ fontSize: '12px', color: '#6b7280' }}>{new Date(approver.approvedAt).toLocaleString()}</p>}
                                    
                                    {approver.comments && <p style={{ fontStyle: 'italic', backgroundColor: '#f3f4f6', padding: '8px', borderRadius: '4px', marginTop: '4px' }}>"{approver.comments}"</p>}
                                    {approver.hodComments && <p style={{ fontStyle: 'italic', color: '#c8410c', backgroundColor: '#fff4ec', padding: '8px', borderRadius: '4px', marginTop: '4px' }}>HOD: "{approver.hodComments}"</p>}
                                    {approver.internalAuditComments && <p style={{ fontStyle: 'italic', color: '#5b21b6', backgroundColor: '#f5f3ff', padding: '8px', borderRadius: '4px', marginTop: '4px' }}>Audit: "{approver.internalAuditComments}"</p>}
                                    {approver.finalAmount !== undefined && approver.finalAmount !== null && <p style={{ fontWeight: 'bold', color: '#5b21b6', backgroundColor: '#f5f3ff', padding: '8px', borderRadius: '4px', marginTop: '4px' }}>Final Amount: {approver.finalAmount.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}</p>}
                                    
                                    {approver.signature && (
                                        <div style={{ marginTop: '8px', padding: '4px', border: '1px solid #e5e7eb', borderRadius: '4px', backgroundColor: '#f9fafb', display: 'inline-block' }}>
                                            <img src={approver.signature} alt="Signature" style={{ height: '48px' }} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
                
                {/* Document Comments */}
                {request.pdfComments && request.pdfComments.length > 0 && (
                    <section style={{ marginBottom: '24px', breakInside: 'avoid' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', marginBottom: '12px' }}>Document Comments</h3>
                        {request.pdfComments.map((comment, index) => {
                             const user = getUserById(comment.userId);
                             const userEmail = user ? user.email : comment.userEmail;
                            return (
                                <div key={index} style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
                                    <p style={{ fontWeight: 'bold', fontSize: '14px' }}>{userEmail || 'Unknown User'}</p>
                                    <p style={{ fontSize: '12px', color: '#6b7280' }}>{new Date(comment.createdAt).toLocaleString()}</p>
                                    <p style={{ marginTop: '4px', fontSize: '14px' }}>{comment.comment}</p>
                                </div>
                            );
                        })}
                    </section>
                )}

                {/* Attachment */}
                {request.fileURL && (
                    <section style={{ breakBefore: 'page' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', marginBottom: '12px' }}>Attached Document: {request.fileName}</h3>
                        <div>
                            {pdf && Array.from(new Array(pdf.numPages), (el, index) => (
                                <PDFPageRenderer key={`pdf-page-${index}`} pageNum={index + 1} pdfDoc={pdf} onRendered={handlePageRendered} />
                            ))}
                            {!pdf && request.fileURL && <p>Loading attached document preview...</p>}
                        </div>
                    </section>
                )}

            </div>
        </div>
    );
});

interface DetailItemProps {
    label: string;
    value: string;
}

const DetailItem = memo(({ label, value }: DetailItemProps) => (
    <div style={{ marginBottom: '8px', breakInside: 'avoid' }}>
        <p style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize' }}>{label}</p>
        <p style={{ fontWeight: '500' }}>{value}</p>
    </div>
));


export default RequestPDFLayout;