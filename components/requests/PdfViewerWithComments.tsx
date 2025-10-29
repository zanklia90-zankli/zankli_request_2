import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Request, UserRole, ApprovalStatus } from '../../types.ts';
import { useRequests } from '../../hooks/useRequests.ts';
import { useAuth } from '../../hooks/useAuth.ts';
import { supabase } from '../../lib/supabaseClient.ts';
import { X, Send } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://aistudiocdn.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs`;

interface PdfViewerWithCommentsProps {
    request: Request;
    onClose: () => void;
}

const PdfViewerWithComments = ({ request, onClose }: PdfViewerWithCommentsProps) => {
    const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
    const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [newComment, setNewComment] = useState('');
    const { addPdfComment, getUserById } = useRequests();
    const { currentUser } = useAuth();
    const commentsEndRef = useRef<HTMLDivElement>(null);

    const renderPage = useCallback(async (pageNum: number, pdfDoc: pdfjsLib.PDFDocumentProxy) => {
        try {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = canvasRefs.current[pageNum - 1];
            if (!canvas) return;

            const canvasContext = canvas.getContext('2d');
            if (!canvasContext) return;
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            const renderContext = { canvasContext, viewport };
            // FIX: Cast render parameters to 'any' to bypass incorrect type definitions from @types/pdfjs-dist.
            await page.render(renderContext as any).promise;
        } catch (error) {
            console.error(`Failed to render PDF page ${pageNum}:`, error);
        }
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
                canvasRefs.current = Array(pdfDoc.numPages).fill(null);
            } catch (error) {
                console.error("Failed to load PDF:", error);
            }
        };
        loadPdf();
    }, [request.fileURL]);

    useEffect(() => {
        if (pdf) {
            for (let i = 1; i <= pdf.numPages; i++) {
                renderPage(i, pdf);
            }
        }
    }, [pdf, renderPage]);
    
    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [request.pdfComments]);

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !currentUser) return;
        
        const result = await addPdfComment(request.id, currentUser.id, currentUser.email, newComment);
        if (result.success) {
            setNewComment('');
        } else {
            alert(`Failed to add comment: ${result.error}`);
        }
    }

    const canComment = (currentUser?.role === UserRole.ADMIN && request.status === ApprovalStatus.PENDING) ||
                        (request.status === ApprovalStatus.PENDING && request.approvalQueue[request.currentApproverIndex]?.userId === currentUser?.id);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col z-50 p-4 font-sans">
            <div className="flex-shrink-0 bg-gray-800 text-white p-2 rounded-t-lg flex justify-between items-center">
                <h2 className="text-lg font-semibold truncate px-2">Document Viewer: {request.fileName}</h2>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700">
                    <X size={20}/>
                </button>
            </div>
            <div className="flex-grow flex min-h-0">
                {/* PDF Viewer Panel */}
                <div className="flex-grow overflow-y-auto bg-gray-600 p-4">
                    <div className="space-y-4 max-w-4xl mx-auto">
                        {pdf && Array.from(new Array(pdf.numPages), (el, index) => (
                            <div key={`page-${index + 1}`} className="shadow-lg">
                                <canvas ref={el => { canvasRefs.current[index] = el; }} />
                            </div>
                        ))}
                         {!pdf && <p className="text-white text-center">Loading PDF...</p>}
                    </div>
                </div>
                {/* Comments Panel */}
                <div className="w-96 bg-white flex flex-col flex-shrink-0 rounded-b-lg lg:rounded-b-none lg:rounded-r-lg">
                    <h3 className="text-lg font-bold text-gray-800 p-4 border-b">Comments</h3>
                    <div className="flex-grow overflow-y-auto p-4 space-y-4">
                        {(request.pdfComments || []).map((comment, index) => {
                            const user = getUserById(comment.userId);
                            const userEmail = user ? user.email : comment.userEmail;
                            return (
                                <div key={index} className="flex items-start">
                                    <div className="w-8 h-8 rounded-full bg-zankli-orange-100 text-zankli-orange-700 flex items-center justify-center font-bold text-sm flex-shrink-0 mr-3">
                                        {userEmail ? userEmail.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div>
                                        <div className="flex items-baseline space-x-2">
                                            <p className="font-semibold text-sm text-gray-800">{userEmail || 'Unknown User'}</p>
                                            <p className="text-xs text-gray-400">{new Date(comment.createdAt).toLocaleTimeString()}</p>
                                        </div>
                                        <div className="bg-gray-100 p-2 rounded-lg mt-1">
                                            <p className="text-sm text-gray-700">{comment.comment}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={commentsEndRef} />
                        {(!request.pdfComments || request.pdfComments.length === 0) && (
                            <p className="text-sm text-gray-500 text-center py-8">No comments yet.</p>
                        )}
                    </div>
                    {canComment && (
                        <div className="p-4 border-t bg-gray-50">
                            <form onSubmit={handleAddComment} className="flex items-center space-x-2">
                                <textarea
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Add a comment..."
                                    className="w-full p-2 border rounded-md text-sm focus:ring-zankli-orange-500 focus:border-zankli-orange-500"
                                    rows={2}
                                />
                                <button type="submit" disabled={!newComment.trim()} className="p-2 rounded-full bg-zankli-orange-600 text-white hover:bg-zankli-orange-700 disabled:bg-gray-400">
                                    <Send size={18}/>
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PdfViewerWithComments;