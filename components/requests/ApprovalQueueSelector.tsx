import React, { useState } from 'react';
import { User } from '../../types.ts';
import { ChevronDown, Plus, X } from 'lucide-react';

interface ApprovalQueueSelectorProps {
    approvers: User[];
    selectedApprovers: User[];
    setSelectedApprovers: React.Dispatch<React.SetStateAction<User[]>>;
}

const ApprovalQueueSelector = ({ approvers, selectedApprovers, setSelectedApprovers }: ApprovalQueueSelectorProps) => {
    const [isOpen, setIsOpen] = useState(false);

    const availableApprovers = approvers.filter(
        (approver) => !selectedApprovers.some((selected) => selected.id === approver.id)
    );

    const addApprover = (approver: User) => {
        // Use functional update to avoid stale state issues
        setSelectedApprovers(prevSelected => [...prevSelected, approver]);
        setIsOpen(false);
    };

    const removeApprover = (approverId: string) => {
        // Use functional update to avoid stale state issues
        setSelectedApprovers(prevSelected => prevSelected.filter((approver) => approver.id !== approverId));
    };

    return (
        <div className="space-y-3">
            <h3 className="text-md font-semibold text-gray-800">Approval Queue</h3>
            <p className="text-sm text-gray-500">Add approvers in the order they should review the request.</p>
            
            <div className="p-3 border border-dashed border-gray-300 rounded-lg min-h-[60px] space-y-2">
                {selectedApprovers.length === 0 && <p className="text-center text-gray-400 text-sm">No approvers selected</p>}
                {selectedApprovers.map((approver, index) => (
                    <div key={approver.id} className="flex items-center justify-between bg-zankli-cream-100 p-2 rounded">
                        <div className="flex items-center">
                            <span className="text-sm font-bold text-zankli-orange-700 mr-2">{index + 1}</span>
                            <span className="text-sm text-gray-800">{approver.email}</span>
                        </div>
                        <button type="button" onClick={() => removeApprover(approver.id)} className="text-gray-400 hover:text-red-600">
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>

            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between p-2 text-sm bg-white border border-gray-300 rounded-md"
                >
                    <span>Add an approver...</span>
                    <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                        <ul>
                            {availableApprovers.map((approver) => (
                                <li
                                    key={approver.id}
                                    onClick={() => addApprover(approver)}
                                    className="p-2 text-sm text-gray-700 hover:bg-zankli-orange-50 cursor-pointer flex items-center"
                                >
                                    <Plus size={14} className="mr-2" />
                                    {approver.email}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApprovalQueueSelector;