import React, { useState, useRef, useEffect, useMemo } from 'react';
import { RequestType, User, Request, ApprovalStatus, StoreRequisitionItem, StoreItem } from '../../types.ts';
import { useAuth } from '../../hooks/useAuth.ts';
import { useRequests } from '../../hooks/useRequests.ts';
import { useVendors } from '../../hooks/useVendors.ts';
import { useStore } from '../../hooks/useStore.ts';
import ApprovalQueueSelector from './ApprovalQueueSelector.tsx';
import { Info, Plus, X, Search, Loader2, AlertTriangle } from 'lucide-react';
import SignaturePad, { SignaturePadRef } from '../shared/SignaturePad.tsx';
import { InputField, TextAreaField, SelectField } from '../shared/FormFields.tsx';

interface RequestFormProps {
    requestType: RequestType;
    onFormSubmit: () => void;
    requestToEdit?: Request | null;
    initialDetails?: { [key: string]: any } | null;
}

const RequestForm = ({ requestType, onFormSubmit, requestToEdit, initialDetails }: RequestFormProps) => {
    const [details, setDetails] = useState<{ [key: string]: any }>({ 
        subject: '',
        dateOfRequisition: new Date().toISOString().split('T')[0],
     });
    const [requesterName, setRequesterName] = useState('');
    const [approvalQueue, setApprovalQueue] = useState<User[]>([]);
    const [selectedHODId, setSelectedHODId] = useState<string>('');
    const [vendorId, setVendorId] = useState<string>('');
    const [file, setFile] = useState<File | null>(null);
    const signaturePadRef = useRef<SignaturePadRef>(null);
    const [leaveDays, setLeaveDays] = useState<number | null>(null);
    const [dateError, setDateError] = useState('');
    
    // Store Requisition state
    const [selectedStoreItems, setSelectedStoreItems] = useState<{[itemId: string]: number}>({}); // { itemId: quantity }
    const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionError, setSubmissionError] = useState<string | null>(null);

    const isEditMode = !!requestToEdit;

    const { currentUser } = useAuth();
    const { addRequest, updateRequest, approvers, getUserById, loading: usersLoading } = useRequests();
    const { vendors } = useVendors();
    const { storeItems, getStoreItemById } = useStore();

    const sentBackComment = useMemo(() => {
        if (isEditMode && requestToEdit?.status === ApprovalStatus.SENT_BACK) {
            const approverAction = requestToEdit.approvalQueue.find(a => a.status === ApprovalStatus.SENT_BACK);
            return approverAction?.comments;
        }
        return null;
    }, [isEditMode, requestToEdit]);
    
    const grandTotal = useMemo(() => {
        if (requestType !== RequestType.STORE) return 0;
        return Object.entries(selectedStoreItems).reduce((total, [itemId, quantity]) => {
            const item = getStoreItemById(itemId);
            const numQuantity = Number(quantity);
            if (item && numQuantity > 0) {
                return total + ((item.unitCost || 0) * numQuantity);
            }
            return total;
        }, 0);
    }, [selectedStoreItems, getStoreItemById, requestType]);

    useEffect(() => {
        // Prevent setting state until users are loaded, especially in edit mode
        if (usersLoading) return;

        if (isEditMode && requestToEdit) {
            setDetails(requestToEdit.details || {});
            setRequesterName(requestToEdit.requesterName);
            const selectedUsers = (requestToEdit.approvalQueue || []).map(a => getUserById(a.userId)).filter((u): u is User => !!u);
            setApprovalQueue(selectedUsers);
            setSelectedHODId(requestToEdit.details?.selectedHODId || '');
            setVendorId(requestToEdit.vendorId || '');
            if (requestToEdit.type === RequestType.STORE && requestToEdit.details?.items) {
                 const initialStoreItems: {[itemId: string]: number} = {};
                (requestToEdit.details?.items as StoreRequisitionItem[]).forEach(item => {
                    initialStoreItems[item.itemId] = item.quantity;
                });
                setSelectedStoreItems(initialStoreItems);
            }
        } else if (initialDetails) {
            setDetails(prev => ({ ...prev, ...initialDetails }));
        }
    }, [isEditMode, requestToEdit, initialDetails, getUserById, usersLoading]);

    useEffect(() => {
        if (requestType === RequestType.LEAVE) {
            const { startDate, endDate } = details;
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                if (end < start) {
                    setDateError('End date cannot be before start date.');
                    setLeaveDays(null);
                } else {
                    setDateError('');
                    const diffTime = end.getTime() - start.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive
                    setLeaveDays(diffDays);
                }
            } else {
                setLeaveDays(null);
            }
        }
    }, [details.startDate, details.endDate, requestType]);

    useEffect(() => {
        if (requestType === RequestType.DIESEL) {
            const volume = Number(details.volume);
            const costPerLiter = Number(details.costPerLiter);
            if (volume > 0 && costPerLiter > 0) {
                const total = volume * costPerLiter;
                setDetails(d => ({...d, totalCost: total.toFixed(2) }));
            } else {
                 setDetails(d => ({...d, totalCost: '0.00' }));
            }
        }
    }, [details.volume, details.costPerLiter, requestType]);

    useEffect(() => {
        if (requestType === RequestType.PROCUREMENT) {
            const quantity = Number(details.quantity);
            const unitCost = Number(details.unitCost);
            if (quantity > 0 && unitCost > 0) {
                const total = quantity * unitCost;
                setDetails(d => ({...d, totalCost: total.toFixed(2) }));
            } else {
                 setDetails(d => ({...d, totalCost: '0.00' }));
            }
        }
    }, [details.quantity, details.unitCost, requestType]);

    const handleDetailChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setDetails({ ...details, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
        }
    };
    
    const handleStoreItemQuantityChange = (itemId: string, quantity: string) => {
        const numQuantity = parseInt(quantity, 10);
        if (isNaN(numQuantity) || numQuantity < 0) {
             setSelectedStoreItems(prev => ({ ...prev, [itemId]: 0 }));
        } else {
            setSelectedStoreItems(prev => ({ ...prev, [itemId]: numQuantity }));
        }
    }

    const handleAddStoreItems = (itemIds: string[]) => {
        const newSelections = {...selectedStoreItems};
        itemIds.forEach(id => {
            if (!newSelections.hasOwnProperty(id)) {
                 newSelections[id] = 1; // Default to 1
            }
        });
        setSelectedStoreItems(newSelections);
        setIsAddItemModalOpen(false);
    };

    const handleRemoveStoreItem = (itemId: string) => {
        const newSelections = {...selectedStoreItems};
        delete newSelections[itemId];
        setSelectedStoreItems(newSelections);
    }
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        setSubmissionError(null);
        setIsSubmitting(true);

        if (dateError) {
            setSubmissionError(dateError);
            setIsSubmitting(false);
            return;
        }
        
        const signature = signaturePadRef.current?.getSignature();

        if (requestType !== RequestType.ITEM && approvalQueue.length === 0) {
            setSubmissionError("Please select at least one approver.");
            setIsSubmitting(false);
            return;
        }
        
        if (requestType === RequestType.STORE && Object.keys(selectedStoreItems).length === 0) {
            setSubmissionError("Please select at least one item and specify a quantity.");
            setIsSubmitting(false);
            return;
        }

        if (requestType === RequestType.LEAVE && !selectedHODId) {
            setSubmissionError("Please select a Head of Department from the approval queue.");
            setIsSubmitting(false);
            return;
        }
        
        if (requestType === RequestType.LEAVE && !details.daysRemaining) {
            setSubmissionError("Please enter the remaining leave days.");
            setIsSubmitting(false);
            return;
        }

        if (!signature) {
            setSubmissionError("Please provide your signature to submit the request.");
            setIsSubmitting(false);
            return;
        }

        const requestDetails: { [key: string]: any } = {
            ...details,
            ...(requestType === RequestType.LEAVE && { selectedHODId, leaveDays }),
        };

        if (requestType === RequestType.STORE) {
            const itemsForRequest = Object.entries(selectedStoreItems)
                .map(([itemId, quantity]) => {
                    const item = getStoreItemById(itemId);
                    const numQuantity = Number(quantity);
                    if (!item || numQuantity <= 0) return null;
                    return {
                        itemId: item.id, itemName: item.name, quantity: numQuantity,
                        unitCost: item.unitCost, totalCost: (item.unitCost || 0) * numQuantity,
                    };
                })
                .filter((i): i is NonNullable<typeof i> => i !== null);

            requestDetails.items = itemsForRequest;
            requestDetails.grandTotal = grandTotal;
        }

        let result;
        if (isEditMode && requestToEdit) {
            const updatedRequest: Request = {
                ...requestToEdit, requesterName, details: requestDetails,
                approvalQueue: approvalQueue.map(u => ({ userId: u.id, userEmail: u.email, status: ApprovalStatus.PENDING })),
                requesterSignature: signature, vendorId: [RequestType.DIESEL, RequestType.PROCUREMENT].includes(requestType) ? vendorId : undefined,
            };
            result = await updateRequest(updatedRequest, file);
        } else {
            result = await addRequest({
                requesterId: currentUser.id, requesterName, type: requestType, details: requestDetails,
                approvalQueue: requestType === RequestType.ITEM ? [] : approvalQueue.map(u => ({ userId: u.id, userEmail: u.email, status: ApprovalStatus.PENDING })),
                requesterSignature: signature, vendorId: [RequestType.DIESEL, RequestType.PROCUREMENT].includes(requestType) ? vendorId : undefined,
            }, file);
        }

        if (result.success) {
            onFormSubmit();
        } else {
            setSubmissionError(result.error);
            setIsSubmitting(false);
        }
    };

    if (usersLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-zankli-orange-500" />
                <p className="ml-4 text-gray-600">Loading user data...</p>
            </div>
        )
    }
    
    const showApprovalQueue = requestType !== RequestType.ITEM;
    const showVendorSelector = [RequestType.DIESEL, RequestType.PROCUREMENT].includes(requestType);
    const showFileUpload = ![RequestType.DIESEL, RequestType.ITEM, RequestType.STORE].includes(requestType);

    return (
        <div className="max-w-4xl mx-auto bg-white p-6 md:p-8 rounded-xl shadow-lg">
            {isAddItemModalOpen && (
                <AddItemModal
                    onClose={() => setIsAddItemModalOpen(false)}
                    onAdd={handleAddStoreItems}
                    allItems={storeItems}
                    alreadySelectedIds={Object.keys(selectedStoreItems)}
                />
            )}
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">{isEditMode ? `Edit ${requestType}` : `New ${requestType}`}</h2>
            {isEditMode && sentBackComment && (
                <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-6" role="alert">
                    <div className="flex">
                        <Info className="h-5 w-5 mr-3"/>
                        <div>
                            <p className="font-bold">Sent Back for Correction</p>
                            <p className="text-sm">"{sentBackComment}"</p>
                        </div>
                    </div>
                </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
                 {/* Common fields */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputField label="Subject" name="subject" value={details.subject || ''} onChange={handleDetailChange} required />
                    <InputField label="Date of Requisition" name="dateOfRequisition" type="date" value={details.dateOfRequisition || ''} onChange={handleDetailChange} required />
                    <InputField label="Requester Name" name="requesterName" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} required />
                 </div>
                 <hr />

                {/* Request specific fields */}
                {requestType === RequestType.DIESEL && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputField label="Volume (in Liters)" name="volume" type="number" value={details.volume || ''} onChange={handleDetailChange} required />
                        <InputField label="Diesel Remaining (in Liters)" name="dieselRemaining" type="number" value={details.dieselRemaining || ''} onChange={handleDetailChange} required />
                        <InputField label="Cost per Liter (NGN)" name="costPerLiter" type="number" value={details.costPerLiter || ''} onChange={handleDetailChange} required />
                        <InputField label="Total Cost (NGN)" name="totalCost" type="text" value={details.totalCost || '0.00'} onChange={() => {}} readOnly />
                        <TextAreaField label="Reason" name="reason" value={details.reason || ''} onChange={handleDetailChange} required />
                    </div>
                )}
                {requestType === RequestType.PROCUREMENT && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InputField label="Department" name="department" value={details.department || ''} onChange={handleDetailChange} required />
                            <InputField label="Quantity" name="quantity" type="number" value={details.quantity || ''} onChange={handleDetailChange} required />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InputField label="Unit Cost (NGN)" name="unitCost" type="number" value={details.unitCost || ''} onChange={handleDetailChange} required />
                            <InputField label="Total Cost (NGN)" name="totalCost" type="text" value={details.totalCost || '0.00'} onChange={() => {}} readOnly />
                        </div>
                        <TextAreaField label="Justification" name="justification" value={details.justification || ''} onChange={handleDetailChange} required />
                    </div>
                )}
                 {requestType === RequestType.LEAVE && (
                    <div className="space-y-6">
                        <InputField label="Applicant Name" name="applicantName" value={details.applicantName || ''} onChange={handleDetailChange} required />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InputField label="Start Date" name="startDate" type="date" value={details.startDate || ''} onChange={handleDetailChange} required />
                            <InputField label="End Date" name="endDate" type="date" value={details.endDate || ''} onChange={handleDetailChange} required />
                        </div>
                         {dateError && <p className="text-sm text-red-500">{dateError}</p>}
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InputField label="Number of Leave Days" name="leaveDays" type="text" value={leaveDays !== null ? String(leaveDays) : '...'} readOnly onChange={() => {}} />
                            <InputField label="Days Remaining for Leave" name="daysRemaining" type="number" value={details.daysRemaining || ''} onChange={handleDetailChange} required />
                        </div>
                        <TextAreaField label="Reason" name="reason" value={details.reason || ''} onChange={handleDetailChange} required />
                    </div>
                )}
                {requestType === RequestType.ITEM && (
                     <div className="space-y-6">
                        <InputField label="Item Name" name="item" value={details.item || ''} onChange={handleDetailChange} required />
                        <InputField label="Quantity" name="quantity" type="number" value={details.quantity || ''} onChange={handleDetailChange} required />
                        <TextAreaField label="Justification" name="justification" value={details.justification || ''} onChange={handleDetailChange} required />
                    </div>
                )}

                 {requestType === RequestType.STORE && (
                    <div className="space-y-4">
                        <h3 className="text-md font-semibold text-gray-800">Selected Items</h3>
                        <div className="border rounded-lg overflow-hidden">
                           <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium text-gray-600">Item</th>
                                        <th className="px-3 py-2 text-center font-medium text-gray-600">In Stock</th>
                                        <th className="px-3 py-2 text-right font-medium text-gray-600">Unit Cost</th>
                                        <th className="px-3 py-2 text-center font-medium text-gray-600 w-28">Quantity</th>
                                        <th className="px-3 py-2 text-right font-medium text-gray-600">Total</th>
                                        <th className="px-3 py-2 text-center font-medium text-gray-600">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.keys(selectedStoreItems).length > 0 ? Object.entries(selectedStoreItems).map(([itemId, quantity]) => {
                                        const item = getStoreItemById(itemId);
                                        if (!item) return null;
                                        const total = (Number(quantity) || 0) * (item.unitCost || 0);
                                        return (
                                            <tr key={item.id} className="border-b last:border-0">
                                                <td className="px-3 py-2">{item.name}</td>
                                                <td className="px-3 py-2 text-center">{item.quantityInStock}</td>
                                                <td className="px-3 py-2 text-right">{(item.unitCost || 0).toLocaleString()}</td>
                                                <td className="px-3 py-2 text-center">
                                                    <input 
                                                        type="number" 
                                                        value={quantity} 
                                                        onChange={(e) => handleStoreItemQuantityChange(itemId, e.target.value)}
                                                        className="w-20 text-center p-1 border rounded-md"
                                                        min="0"
                                                        max={item.quantityInStock}
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-right font-medium">{total.toLocaleString()}</td>
                                                <td className="px-3 py-2 text-center">
                                                    <button type="button" onClick={() => handleRemoveStoreItem(itemId)} className="text-red-500 hover:text-red-700">
                                                        <X size={16}/>
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    }) : (
                                        <tr><td colSpan={6} className="text-center text-gray-500 py-4">No items selected.</td></tr>
                                    )}
                                </tbody>
                                {Object.keys(selectedStoreItems).length > 0 && (
                                    <tfoot>
                                        <tr className="font-bold bg-gray-50">
                                            <td colSpan={4} className="px-3 py-2 text-right">Grand Total</td>
                                            <td className="px-3 py-2 text-right text-base">
                                                {grandTotal.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                )}
                           </table>
                        </div>
                        <button type="button" onClick={() => setIsAddItemModalOpen(true)} className="flex items-center text-sm px-4 py-2 bg-zankli-orange-100 text-zankli-orange-800 font-semibold rounded-lg hover:bg-zankli-orange-200">
                           <Plus size={16} className="mr-2"/> Add Items from Store
                        </button>
                    </div>
                )}
                
                 {showVendorSelector && (
                    <div className="pt-4 border-t">
                        <SelectField 
                            label="Select Vendor" 
                            value={vendorId} 
                            onChange={(e) => setVendorId(e.target.value)} 
                            options={vendors.map(v => ({ value: v.id, label: v.name }))}
                            required
                        />
                    </div>
                 )}

                {showApprovalQueue && (
                    <div className="pt-4 border-t">
                        <ApprovalQueueSelector approvers={approvers} selectedApprovers={approvalQueue} setSelectedApprovers={setApprovalQueue} />
                        {requestType === RequestType.LEAVE && (
                            <div className="mt-4">
                                <SelectField 
                                    label="Select Head of Department" 
                                    value={selectedHODId}
                                    onChange={(e) => setSelectedHODId(e.target.value)}
                                    options={approvalQueue.map(u => ({value: u.id, label: u.email}))}
                                    required
                                    placeholder="Select from approval queue"
                                />
                            </div>
                        )}
                    </div>
                )}

                {showFileUpload && (
                    <div className="pt-4 border-t">
                        <label className="block text-sm font-medium text-gray-700">Attach Document (Optional)</label>
                        <input type="file" onChange={handleFileChange} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-zankli-orange-50 file:text-zankli-orange-700 hover:file:bg-zankli-orange-100"/>
                        {file && <p className="text-xs text-gray-500 mt-1">Selected: {file.name}</p>}
                        {!file && isEditMode && requestToEdit?.fileName && <p className="text-xs text-gray-500 mt-1">Current file: {requestToEdit.fileName}</p>}
                    </div>
                )}
                
                 <div className="pt-4 border-t">
                    <SignaturePad ref={signaturePadRef} label="Your Signature (Required)" />
                 </div>

                 {submissionError && (
                    <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-start mt-4">
                        <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
                        <div>
                            <p className="font-bold">Submission Failed</p>
                            <p className="text-sm">{submissionError}</p>
                        </div>
                    </div>
                )}

                <div className="flex justify-end pt-6">
                    <button type="submit" disabled={isSubmitting} className="px-8 py-3 bg-zankli-orange-600 text-white font-semibold rounded-lg hover:bg-zankli-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zankli-orange-500 disabled:bg-zankli-orange-300 flex items-center justify-center min-w-[150px]">
                        {isSubmitting ? (
                            <>
                                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                                Submitting...
                            </>
                        ) : isEditMode ? 'Update & Resubmit' : 'Submit Request'}
                    </button>
                </div>
            </form>
        </div>
    );
};

const AddItemModal = ({ onClose, onAdd, allItems, alreadySelectedIds }: { onClose: () => void, onAdd: (itemIds: string[]) => void, allItems: StoreItem[], alreadySelectedIds: string[] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    const filteredItems = useMemo(() => {
        return allItems.filter(item => 
            !alreadySelectedIds.includes(item.id) &&
            item.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [allItems, searchTerm, alreadySelectedIds]);

    const handleSelect = (itemId: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    const handleAddClick = () => {
        onAdd(Array.from(selectedIds));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Add Items from Store</h2>
                    <button onClick={onClose}><X className="text-gray-500"/></button>
                </div>
                <div className="relative mb-4">
                    <input 
                        type="text" 
                        placeholder="Search for items..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2 pl-10 border rounded-md"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                </div>
                <div className="flex-grow overflow-y-auto border rounded-lg">
                     <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="p-2 text-center w-10"></th>
                                <th className="p-2 text-left">Item</th>
                                <th className="p-2 text-left">Purpose</th>
                                <th className="p-2 text-center">In Stock</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map(item => (
                                <tr key={item.id} className={`cursor-pointer hover:bg-zankli-orange-50 ${selectedIds.has(item.id) ? 'bg-zankli-orange-100' : ''}`} onClick={() => handleSelect(item.id)}>
                                    <td className="p-2 text-center"><input type="checkbox" checked={selectedIds.has(item.id)} readOnly className="form-checkbox h-4 w-4 text-zankli-orange-600"/></td>
                                    <td className="p-2 font-medium">{item.name}</td>
                                    <td className="p-2 text-gray-600">{item.purpose}</td>
                                    <td className="p-2 text-center">{item.quantityInStock}</td>
                                </tr>
                            ))}
                        </tbody>
                     </table>
                     {filteredItems.length === 0 && <p className="text-center p-8 text-gray-500">No available items match your search.</p>}
                </div>
                 <div className="flex justify-end pt-4">
                    <button onClick={handleAddClick} disabled={selectedIds.size === 0} className="px-6 py-2 bg-zankli-orange-600 text-white font-semibold rounded-lg hover:bg-zankli-orange-700 disabled:bg-gray-400">
                        Add {selectedIds.size > 0 ? `(${selectedIds.size})` : ''} Selected Items
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RequestForm;