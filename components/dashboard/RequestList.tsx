

import React, { useState, useMemo, useCallback } from 'react';
import { useRequests } from '../../hooks/useRequests.ts';
import { useAuth } from '../../hooks/useAuth.ts';
import { Request, UserRole, ApprovalStatus, RequestType } from '../../types.ts';
import { Bell, Droplets, Coins, Hash, User, CalendarDays, PackagePlus, Warehouse, Hourglass, UserCheck, UserX, Send, Search, Loader2, AlertTriangle } from 'lucide-react';

interface RequestListProps {
    onEditRequest: (request: Request) => void;
    onViewRequest: (request: Request) => void;
}

const RequestList = ({ onEditRequest, onViewRequest }: RequestListProps) => {
  const { requests, loading, error, getUserById } = useRequests();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ApprovalStatus | 'All'>(ApprovalStatus.PENDING);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRequests = useMemo(() => {
    const nonItemRequests = requests.filter(req => req.type !== RequestType.ITEM);
    
    const searchedRequests = nonItemRequests.filter(req => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        const idMatch = req.id.toLowerCase().includes(query);
        const subjectMatch = req.details?.subject?.toLowerCase().includes(query) || false;
        const requesterMatch = req.requesterName?.toLowerCase().includes(query) || false;
        return idMatch || subjectMatch || requesterMatch;
    });

    if (currentUser?.role === UserRole.ADMIN) {
        if (activeTab === 'All') return searchedRequests;
        return searchedRequests.filter(req => req.status === activeTab);
    }
    
    if (currentUser?.role === UserRole.APPROVER) {
        if (activeTab === 'All') {
            // Show all requests they are a part of
            return searchedRequests.filter(req => 
                (req.approvalQueue || []).some(a => a.userId === currentUser.id)
            );
        }
        
        if (activeTab === ApprovalStatus.PENDING) {
            // Only show requests awaiting THEIR approval
            return searchedRequests.filter(req => 
                req.status === ApprovalStatus.PENDING &&
                req.approvalQueue?.[req.currentApproverIndex]?.userId === currentUser.id
            );
        }
        
        // For Approved/Rejected tabs, show requests where they took that action
        return searchedRequests.filter(req => 
            (req.approvalQueue || []).some(a => a.userId === currentUser.id && a.status === activeTab)
        );
    }

    return []; // No requests for other roles
  }, [requests, currentUser, activeTab, searchQuery]);

  const StatusBadge = useCallback(({ status }: { status: ApprovalStatus }) => {
    const colorClasses = {
      [ApprovalStatus.PENDING]: 'bg-yellow-100 text-yellow-800',
      [ApprovalStatus.APPROVED]: 'bg-green-100 text-green-800',
      [ApprovalStatus.REJECTED]: 'bg-red-100 text-red-800',
      [ApprovalStatus.SENT_BACK]: 'bg-blue-100 text-blue-800',
      [ApprovalStatus.COMPLETED]: 'bg-indigo-100 text-indigo-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorClasses[status]}`}>
        {status}
      </span>
    );
  }, []);

  const handleRemind = (e: React.MouseEvent, req: Request) => {
    e.stopPropagation(); // Prevent modal from opening
    const currentApprover = req.approvalQueue[req.currentApproverIndex];
    if (!currentApprover) {
        alert('Could not determine the current approver.');
        return;
    }
    const approverUser = getUserById(currentApprover.userId);
    alert(`Reminder sent to ${approverUser?.email || 'the current approver'}.`);
  };

  const tabs: (ApprovalStatus | 'All')[] = currentUser?.role === UserRole.ADMIN 
    ? [ApprovalStatus.PENDING, ApprovalStatus.SENT_BACK, ApprovalStatus.APPROVED, ApprovalStatus.REJECTED, 'All']
    : [ApprovalStatus.PENDING, ApprovalStatus.APPROVED, ApprovalStatus.REJECTED, 'All'];

  const DetailItem = useCallback(({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number | undefined }) => {
      if (!value) return null;
      return (
        <div className="flex items-start text-sm">
            <span className="text-gray-400 mr-2 mt-0.5 shrink-0">{icon}</span>
            <span className="font-medium text-gray-500 w-28 shrink-0">{label}</span>
            <span className="text-gray-800 font-semibold truncate" title={String(value)}>{value}</span>
        </div>
      );
  }, []);

  const renderKeyDetails = useCallback((request: Request) => {
    switch (request.type) {
        case RequestType.DIESEL:
            return (
                <>
                    <DetailItem icon={<Droplets size={14} />} label="Volume" value={`${request.details?.volume || 0} L`} />
                    {request.details?.totalCost && <DetailItem icon={<Coins size={14} />} label="Total Cost" value={Number(request.details?.totalCost || 0).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })} />}
                </>
            );
        case RequestType.PROCUREMENT:
             return (
                <>
                    <DetailItem icon={<Hash size={14} />} label="Quantity" value={request.details?.quantity} />
                    {request.details?.totalCost && <DetailItem icon={<Coins size={14} />} label="Total Cost" value={Number(request.details?.totalCost || 0).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })} />}
                </>
            );
        case RequestType.LEAVE:
            const { applicantName, leaveDays } = request.details || {};
            return (
                <>
                     <DetailItem icon={<User size={14} />} label="Applicant" value={applicantName} />
                     <DetailItem icon={<CalendarDays size={14} />} label="Duration" value={`${leaveDays} day(s)`} />
                </>
            );
        case RequestType.ITEM:
            return (
                 <>
                    <DetailItem icon={<PackagePlus size={14} />} label="Item" value={request.details?.item} />
                    <DetailItem icon={<Hash size={14} />} label="Quantity" value={request.details?.quantity} />
                </>
            );
        case RequestType.STORE:
            const itemCount = request.details?.items?.length || 0;
            return (
                <>
                    <DetailItem icon={<Warehouse size={14} />} label="Items" value={`${itemCount} type(s)`} />
                    {request.details?.grandTotal && <DetailItem icon={<Coins size={14} />} label="Total Value" value={Number(request.details?.grandTotal || 0).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })} />}
                </>
            );
        default:
            return null;
    }
  }, [DetailItem]);

  const renderWorkflowStatus = useCallback((request: Request) => {
      const { status, approvalQueue, currentApproverIndex } = request;

      if (!approvalQueue || approvalQueue.length === 0) {
        return null;
      }

      let approverAction = null;
      let label = '';
      let icon: React.ReactNode = null;
      
      switch(status) {
          case ApprovalStatus.PENDING:
              approverAction = approvalQueue[currentApproverIndex];
              label = 'Next Approver';
              icon = <Hourglass size={14} className="text-yellow-600" />;
              break;
          case ApprovalStatus.APPROVED:
              approverAction = approvalQueue[approvalQueue.length -1];
              label = 'Final Approver';
              icon = <UserCheck size={14} className="text-green-600" />;
              break;
          case ApprovalStatus.REJECTED:
              approverAction = approvalQueue.find(a => a.status === ApprovalStatus.REJECTED);
              label = 'Rejected By';
              icon = <UserX size={14} className="text-red-600" />;
              break;
          case ApprovalStatus.SENT_BACK:
               approverAction = approvalQueue.find(a => a.status === ApprovalStatus.SENT_BACK);
               label = 'Sent Back By';
               icon = <Send size={14} className="text-blue-600" />;
               break;
          default:
              return null;
      }
      
      if (!approverAction) return null;
      
      const approverEmail = approverAction.userEmail;

      return (
         <div className="flex items-start text-sm">
            <span className="text-gray-400 mr-2 mt-0.5 shrink-0">{icon}</span>
            <span className="font-medium text-gray-500 w-28 shrink-0">{label}</span>
            <span className="text-gray-800 font-semibold truncate">{approverEmail || 'N/A'}</span>
        </div>
      );
  }, []);

  if(loading) {
      return (
          <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-zankli-orange-500" />
              <p className="ml-4 text-gray-600">Loading data...</p>
          </div>
      )
  }

  if (error) {
    return (
        <div className="text-center py-10 text-red-700 bg-red-50 p-6 rounded-lg shadow-sm border border-red-200">
            <div className="flex justify-center items-center mb-4">
                <AlertTriangle className="h-8 w-8 mr-3"/>
                <h3 className="text-xl font-bold">Failed to Load Requests</h3>
            </div>
            <p className="text-sm">{error}</p>
            <p className="text-xs mt-3 text-red-600">This might be due to a network issue or an ad-blocker. Please check your connection and refresh the page.</p>
        </div>
    );
  }

  return (
    <div>
       <div className="mb-4">
            <div className="relative">
                <input
                    type="text"
                    placeholder="Search by ID, subject, or requester name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full p-3 pl-10 border border-gray-300 rounded-lg shadow-sm focus:ring-zankli-orange-500 focus:border-zankli-orange-500"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            </div>
        </div>
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${
                tab === activeTab
                  ? 'border-zankli-orange-500 text-zankli-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredRequests.map(req => (
          <div key={req.id} onClick={() => onViewRequest(req)} className="bg-white p-5 rounded-lg shadow-md hover:shadow-xl transition-shadow cursor-pointer flex flex-col justify-between">
            <div className="flex flex-col space-y-3">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-semibold text-zankli-orange-700">{req.type}</p>
                        <p className="text-xs text-gray-400 mt-0.5">ID: {req.id}</p>
                    </div>
                    <StatusBadge status={req.status} />
                </div>

                {/* Main Info */}
                <div className="pt-2">
                    <h3 className="text-lg font-bold text-gray-800 truncate" title={req.details?.subject}>{req.details?.subject || 'No Subject'}</h3>
                    <p className="text-sm text-gray-500">
                        By: <span className="font-medium text-gray-700">{req.requesterName}</span> on {new Date(req.createdAt).toLocaleDateString()}
                    </p>
                </div>
                
                {/* Details & Workflow */}
                <div className="pt-3 border-t space-y-2">
                    <h4 className="text-xs font-bold uppercase text-gray-400">Details</h4>
                    {renderKeyDetails(req)}
                    <div className="pt-2">
                        <h4 className="text-xs font-bold uppercase text-gray-400">Status</h4>
                        {renderWorkflowStatus(req)}
                    </div>
                </div>
            </div>
            
            {/* Actions */}
            {currentUser?.role === UserRole.ADMIN && req.status === ApprovalStatus.PENDING && (
              <div className="mt-4 pt-3 border-t flex justify-end">
                <button
                  onClick={(e) => handleRemind(e, req)}
                  className="flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  <Bell className="h-4 w-4 mr-1" />
                  Remind Approver
                </button>
              </div>
            )}
          </div>
        ))}
        {filteredRequests.length === 0 && (
            <div className="col-span-full text-center py-10">
                <p className="text-gray-500">No requests found in this tab.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default RequestList;