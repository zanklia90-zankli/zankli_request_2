

import React, { useState, useEffect } from 'react';
import { LogOut, LayoutDashboard, FilePlus2, ChevronDown, ChevronUp, Droplets, ShoppingCart, CalendarOff, PackagePlus, UserCircle, Bell, Inbox, Building, Menu, Warehouse } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.ts';
import { useRequests } from '../../hooks/useRequests.ts';
import { Request, RequestType, UserRole, ApprovalStatus, Notification } from '../../types.ts';
import RequestList from './RequestList.tsx';
import RequestForm from '../requests/RequestForm.tsx';
import ItemRequestInbox from './ItemRequestInbox.tsx';
import VendorManagement from '../vendors/VendorManagement.tsx';
import RequestDetailsModal from '../requests/RequestDetailsModal.tsx';
import StoreManagement from '../store/StoreManagement.tsx';

const IconMap = {
    [RequestType.DIESEL]: <Droplets className="h-5 w-5 mr-3 text-zankli-orange-500" />,
    [RequestType.PROCUREMENT]: <ShoppingCart className="h-5 w-5 mr-3 text-zankli-orange-500" />,
    [RequestType.LEAVE]: <CalendarOff className="h-5 w-5 mr-3 text-zankli-orange-500" />,
    [RequestType.ITEM]: <PackagePlus className="h-5 w-5 mr-3 text-zankli-orange-500" />,
    [RequestType.STORE]: <Warehouse className="h-5 w-5 mr-3 text-zankli-orange-500" />,
};

const Dashboard = () => {
    const { currentUser, logout } = useAuth();
    const { requests, updateItemRequestStatus, getUserById } = useRequests();
    const [activeView, setActiveView] = useState('dashboard');
    const [requestType, setRequestType] = useState<RequestType | null>(null);
    const [requestToEdit, setRequestToEdit] = useState<Request | null>(null);
    const [procurementInitialDetails, setProcurementInitialDetails] = useState<{[key: string]: any} | null>(null);
    const [isRequestMenuOpen, setIsRequestMenuOpen] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [requestInModal, setRequestInModal] = useState<Request | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

    useEffect(() => {
        if (requestInModal) {
            const updatedRequestInModal = requests.find(r => r.id === requestInModal.id);
            if (updatedRequestInModal) {
                if (JSON.stringify(requestInModal) !== JSON.stringify(updatedRequestInModal)) {
                    setRequestInModal(updatedRequestInModal);
                }
            } else {
                setRequestInModal(null);
            }
        }
    }, [requests, requestInModal]);

    useEffect(() => {
        if (!currentUser) return;
        
        const readNotifIds = JSON.parse(localStorage.getItem(`zmc-read-notifs-${currentUser.id}`) || '[]');
        const generatedNotifs: Notification[] = [];

        requests.forEach(req => {
            const baseNotifId = `notif-${req.id}-${req.status}`;
            
            if (currentUser.role === UserRole.APPROVER && req.status === ApprovalStatus.PENDING && req.approvalQueue && req.approvalQueue.length > req.currentApproverIndex) {
                const isTheirTurn = req.approvalQueue[req.currentApproverIndex]?.userId === currentUser.id;
                if (isTheirTurn) {
                    const notifId = `${baseNotifId}-${currentUser.id}`;
                    generatedNotifs.push({
                        id: notifId,
                        requestId: req.id,
                        message: `New request awaiting your approval: ${req.id}`,
                        isRead: readNotifIds.includes(notifId),
                        createdAt: req.createdAt,
                    });
                }
            }

            if (currentUser.role === UserRole.ADMIN) {
                if ([ApprovalStatus.SENT_BACK, ApprovalStatus.REJECTED, ApprovalStatus.COMPLETED].includes(req.status)) {
                    generatedNotifs.push({
                        id: baseNotifId,
                        requestId: req.id,
                        message: `Request ${req.id} has been ${req.status}.`,
                        isRead: readNotifIds.includes(baseNotifId),
                        createdAt: req.createdAt,
                    });
                }
                
                if (req.pdfComments?.length) {
                    req.pdfComments.forEach(comment => {
                        if (comment.userId === currentUser.id) return;

                        const notifId = `notif-comment-${req.id}-${comment.createdAt}`;
                        const commenterName = comment.userEmail?.split('@')[0] || getUserById(comment.userId)?.email?.split('@')[0] || 'a user';
                        const message = `New comment on ${req.id} from ${commenterName}: "${comment.comment?.substring(0, 40) || ''}..."`;

                        generatedNotifs.push({
                            id: notifId,
                            requestId: req.id,
                            message: message,
                            isRead: readNotifIds.includes(notifId),
                            createdAt: comment.createdAt,
                        });
                    });
                }
            }
        });
        
        setNotifications(generatedNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        
    }, [requests, currentUser, getUserById]);

    const handleNotificationClick = (notification: Notification) => {
        if(!currentUser) return;
        const readNotifIds = JSON.parse(localStorage.getItem(`zmc-read-notifs-${currentUser.id}`) || '[]');
        if (!readNotifIds.includes(notification.id)) {
            const newReadIds = [...readNotifIds, notification.id];
            localStorage.setItem(`zmc-read-notifs-${currentUser.id}`, JSON.stringify(newReadIds));
            setNotifications(prev => prev.map(n => n.id === notification.id ? {...n, isRead: true} : n));
        }

        const requestToView = requests.find(r => r.id === notification.requestId);
        if (requestToView) {
            setRequestInModal(requestToView);
        }
        setIsNotificationsOpen(false);
    };


    const handleNavigation = (view: string, type: RequestType | null = null) => {
        setActiveView(view);
        setRequestType(type);
        setRequestToEdit(null);
        setProcurementInitialDetails(null);
        if (window.innerWidth < 1024) {
            setIsSidebarOpen(false);
        }
    };
    
    const handleEditRequest = (request: Request) => {
        setRequestToEdit(request);
        setActiveView('edit-request');
        if (window.innerWidth < 1024) {
            setIsSidebarOpen(false);
        }
    };

    const handleCreateProcurementFromItemRequest = async (itemRequest: Request) => {
        const result = await updateItemRequestStatus(itemRequest.id, ApprovalStatus.COMPLETED);
        
        if (result.success) {
            const initialData = {
                subject: `Procurement for: ${itemRequest.details?.item || 'Item Request'}`,
                quantity: itemRequest.details?.quantity || 1,
                justification: itemRequest.details?.justification || '',
                department: '',
            };
            setProcurementInitialDetails(initialData);
            setActiveView('create-request');
            setRequestType(RequestType.PROCUREMENT);
            if (window.innerWidth < 1024) {
                setIsSidebarOpen(false);
            }
        } else {
             alert(`Failed to update item request status: ${result.error}`);
        }
    };

    const isAdmin = currentUser?.role === UserRole.ADMIN;
    const isApprover = currentUser?.role === UserRole.APPROVER;

    const getPageTitle = () => {
        switch(activeView) {
            case 'dashboard': return 'Requests Dashboard';
            case 'create-request': return `Create: ${requestType}`;
            case 'edit-request': return `Editing Request: ${requestToEdit?.details?.subject || requestToEdit?.id}`;
            case 'item-inbox': return 'Item Request Inbox';
            case 'vendor-management': return 'Vendor Management';
            case 'store-management': return 'Store Management';
            default: return 'Dashboard';
        }
    }

    const Sidebar = () => (
        <>
            <div
                className={`fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden ${isSidebarOpen ? 'block' : 'hidden'}`}
                onClick={() => setIsSidebarOpen(false)}
            />
            <div className={`w-64 bg-white h-screen fixed top-0 left-0 flex flex-col shadow-lg z-30 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                <div className="p-4 border-b border-zankli-cream-200">
                    <h1 className="text-xl font-bold text-zankli-orange-800">Zankli Medical</h1>
                    <p className="text-xs text-zankli-cream-900">Internal Portal</p>
                </div>
                <nav className="flex-grow p-4 space-y-2">
                    <button onClick={() => handleNavigation('dashboard')} className={`w-full flex items-center p-2 rounded-lg transition-colors ${activeView === 'dashboard' ? 'bg-zankli-orange-100 text-zankli-orange-800' : 'text-gray-700 hover:bg-zankli-cream-100'}`}>
                        <LayoutDashboard className="h-5 w-5 mr-3" />
                        Dashboard
                    </button>
                    {isAdmin && (
                        <>
                            <button onClick={() => handleNavigation('item-inbox')} className={`w-full flex items-center p-2 rounded-lg transition-colors ${activeView === 'item-inbox' ? 'bg-zankli-orange-100 text-zankli-orange-800' : 'text-gray-700 hover:bg-zankli-cream-100'}`}>
                                <Inbox className="h-5 w-5 mr-3" />
                                Item Request Inbox
                            </button>
                             <button onClick={() => handleNavigation('store-management')} className={`w-full flex items-center p-2 rounded-lg transition-colors ${activeView === 'store-management' ? 'bg-zankli-orange-100 text-zankli-orange-800' : 'text-gray-700 hover:bg-zankli-cream-100'}`}>
                                <Warehouse className="h-5 w-5 mr-3" />
                                Store Management
                            </button>
                            <button onClick={() => handleNavigation('vendor-management')} className={`w-full flex items-center p-2 rounded-lg transition-colors ${activeView === 'vendor-management' ? 'bg-zankli-orange-100 text-zankli-orange-800' : 'text-gray-700 hover:bg-zankli-cream-100'}`}>
                                <Building className="h-5 w-5 mr-3" />
                                Vendor Management
                            </button>
                        </>
                    )}

                    <div>
                        <button onClick={() => setIsRequestMenuOpen(!isRequestMenuOpen)} className="w-full flex items-center justify-between p-2 rounded-lg text-gray-700 hover:bg-zankli-cream-100">
                            <div className="flex items-center">
                                <FilePlus2 className="h-5 w-5 mr-3" />
                                Create Request
                            </div>
                            {isRequestMenuOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        {isRequestMenuOpen && (
                            <ul className="pl-6 mt-1">
                                {Object.values(RequestType).map(type => {
                                    const canAdminCreate = isAdmin && [RequestType.DIESEL, RequestType.PROCUREMENT, RequestType.LEAVE, RequestType.STORE].includes(type);
                                    const canApproverCreate = isApprover && type === RequestType.ITEM;

                                    if (!canAdminCreate && !canApproverCreate) return null;
                                    
                                    return (
                                    <li key={type} className="mt-1">
                                        <button onClick={() => handleNavigation('create-request', type)} className={`w-full text-left flex items-center p-2 rounded-lg text-sm transition-colors ${activeView === 'create-request' && requestType === type ? 'bg-zankli-orange-100 text-zankli-orange-800' : 'text-gray-600 hover:bg-zankli-cream-100'}`}>
                                            {IconMap[type]}
                                            {type}
                                        </button>
                                    </li>
                                )})}
                            </ul>
                        )}
                    </div>
                </nav>
                <div className="p-4 border-t border-zankli-cream-200">
                    <button onClick={logout} className="w-full flex items-center p-2 rounded-lg text-gray-700 hover:bg-zankli-cream-100">
                        <LogOut className="h-5 w-5 mr-3" />
                        Logout
                    </button>
                </div>
            </div>
        </>
    );
    
    const Header = () => {
        const unreadCount = notifications.filter(n => !n.isRead).length;
        
        return (
         <header className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 p-4 border-b border-zankli-cream-200 flex justify-between items-center">
             <div className="flex items-center">
                <button className="lg:hidden mr-4 text-gray-600" onClick={() => setIsSidebarOpen(true)}>
                    <Menu className="h-6 w-6"/>
                </button>
                <h2 className="text-xl md:text-2xl font-semibold text-gray-800 truncate">{getPageTitle()}</h2>
             </div>
             <div className="flex items-center space-x-4">
                <div className="relative">
                    <button onClick={() => setIsNotificationsOpen(prev => !prev)} className="relative">
                        <Bell className="h-6 w-6 text-gray-500 cursor-pointer hover:text-zankli-orange-600"/>
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                                {unreadCount}
                            </span>
                        )}
                    </button>
                    {isNotificationsOpen && (
                        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl z-20 border">
                            <div className="p-3 font-bold text-gray-700 border-b">Notifications</div>
                            <ul className="max-h-96 overflow-y-auto">
                                {notifications.length > 0 ? notifications.map(notif => (
                                    <li key={notif.id} onClick={() => handleNotificationClick(notif)} className={`p-3 text-sm border-b hover:bg-gray-100 cursor-pointer ${!notif.isRead ? 'bg-zankli-orange-50' : ''}`}>
                                        <p className={`${!notif.isRead ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{notif.message}</p>
                                        <p className="text-xs text-gray-400 mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
                                    </li>
                                )) : <li className="p-4 text-sm text-gray-500 text-center">No new notifications.</li>}
                            </ul>
                        </div>
                    )}
                </div>
                <div className="flex items-center space-x-2">
                    <UserCircle className="h-8 w-8 text-gray-400"/>
                    <div className="hidden sm:block">
                        <p className="text-sm font-medium text-gray-700 truncate">{currentUser?.email}</p>
                        <p className="text-xs text-gray-500 capitalize">{currentUser?.role}</p>
                    </div>
                </div>
             </div>
         </header>
        );
    };

    return (
        <div className="bg-zankli-cream-100 min-h-screen">
            <Sidebar />
            <main className="flex-1 lg:ml-64">
                <Header />
                <div className="p-4 sm:p-6">
                    {activeView === 'dashboard' && <RequestList onEditRequest={handleEditRequest} onViewRequest={setRequestInModal} />}
                    {activeView === 'create-request' && requestType && (
                        <RequestForm 
                            requestType={requestType} 
                            onFormSubmit={() => handleNavigation('dashboard')} 
                            initialDetails={requestType === RequestType.PROCUREMENT ? procurementInitialDetails : null}
                        />
                    )}
                    {activeView === 'edit-request' && requestToEdit && (
                        <RequestForm 
                          requestType={requestToEdit.type} 
                          onFormSubmit={() => handleNavigation('dashboard')}
                          requestToEdit={requestToEdit}
                        />
                    )}
                    {activeView === 'item-inbox' && <ItemRequestInbox onCreateProcurement={handleCreateProcurementFromItemRequest} onViewRequest={setRequestInModal} />}
                    {activeView === 'vendor-management' && <VendorManagement />}
                    {activeView === 'store-management' && <StoreManagement />}
                </div>
            </main>
            {requestInModal && (
                 <RequestDetailsModal 
                    request={requestInModal}
                    onClose={() => setRequestInModal(null)}
                    onEdit={(req) => {
                        setRequestInModal(null);
                        handleEditRequest(req);
                    }}
                    onCreateProcurement={(req) => {
                        setRequestInModal(null);
                        handleCreateProcurementFromItemRequest(req);
                    }}
                 />
            )}
        </div>
    );
};

export default Dashboard;