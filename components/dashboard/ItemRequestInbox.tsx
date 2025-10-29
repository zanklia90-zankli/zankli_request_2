
import React, { useState, useMemo } from 'react';
import { useRequests } from '../../hooks/useRequests.ts';
import { Request, ApprovalStatus, RequestType } from '../../types.ts';

interface ItemRequestInboxProps {
  onCreateProcurement: (request: Request) => void;
  onViewRequest: (request: Request) => void;
}

const ItemRequestInbox = ({ onCreateProcurement, onViewRequest }: ItemRequestInboxProps) => {
  const { requests, updateItemRequestStatus } = useRequests();
  const [activeTab, setActiveTab] = useState(ApprovalStatus.PENDING);

  const itemRequests = useMemo(() => {
    return requests.filter(req => req.type === RequestType.ITEM);
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return itemRequests.filter(req => req.status === activeTab);
  }, [itemRequests, activeTab]);

  const tabs = [ApprovalStatus.PENDING, ApprovalStatus.COMPLETED];

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Item Requests</h2>
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
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
              {tab === ApprovalStatus.PENDING ? 'New' : 'Completed'}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6 space-y-4">
        {filteredRequests.length > 0 ? filteredRequests.map(req => (
          <div key={req.id} className="bg-zankli-cream-50 p-4 rounded-lg flex items-center justify-between hover:bg-zankli-cream-100 transition-colors">
            <div>
              <p className="font-bold text-gray-800">{req.details?.subject || 'No Subject'}</p>
              <p className="text-sm text-gray-600">Requester: {req.requesterName} | Created: {new Date(req.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center space-x-3">
              <button onClick={() => onViewRequest(req)} className="text-sm text-zankli-orange-600 hover:underline">View Details</button>
              {req.status === ApprovalStatus.PENDING && (
                <button onClick={() => onCreateProcurement(req)} className="px-3 py-1 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">
                  Create Procurement
                </button>
              )}
            </div>
          </div>
        )) : (
            <div className="text-center py-10">
                <p className="text-gray-500">No requests in this category.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default ItemRequestInbox;