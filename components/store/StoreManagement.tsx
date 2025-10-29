import React, { useState } from 'react';
import { useStore } from '../../hooks/useStore.ts';
import { Plus, X, AlertTriangle } from 'lucide-react';

const InputField = ({ label, name, type = 'text', required = false, onChange, value } : {label:string, name:string, type?:string, required?:boolean, onChange:(e: React.ChangeEvent<HTMLInputElement>)=>void, value?: string}) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
        <input
            type={type}
            name={name}
            id={name}
            value={value}
            required={required}
            onChange={onChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-zankli-orange-500 focus:border-zankli-orange-500 sm:text-sm"
        />
    </div>
);

const CreateItemModal = ({ isOpen, onClose, onSubmit, newItem, setNewItem, isSubmitting, error }: { 
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    newItem: any;
    setNewItem: (item: any) => void;
    isSubmitting: boolean;
    error: string | null;
}) => {
    if (!isOpen) return null;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        if (type === 'number') {
            const parsed = parseFloat(value);
            // Allow empty string to be typed, which will be stored as 0
            if (value === '') {
                setNewItem({ ...newItem, [name]: 0 });
            } 
            // Only update if it's a valid non-negative number
            else if (!isNaN(parsed) && parsed >= 0) {
                setNewItem({ ...newItem, [name]: parsed });
            }
        } else {
            setNewItem({ ...newItem, [name]: value });
        }
    };

    const getNumericValue = (val: number) => {
        // Show empty string if value is 0, otherwise show the number
        return val === 0 ? '' : String(val);
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Add New Store Item</h2>
                    <button onClick={onClose}><X className="text-gray-500"/></button>
                </div>
                <form onSubmit={onSubmit} className="space-y-4">
                    <InputField label="Item Name" name="name" value={newItem.name} onChange={handleInputChange} required />
                    <InputField label="Purpose" name="purpose" value={newItem.purpose} onChange={handleInputChange} required />
                    <InputField label="Quantity in Stock" name="quantityInStock" type="number" value={getNumericValue(newItem.quantityInStock)} onChange={handleInputChange} required />
                    <InputField label="Unit Cost (NGN)" name="unitCost" type="number" value={getNumericValue(newItem.unitCost)} onChange={handleInputChange} required />
                    <InputField label="Last Purchase Date" name="lastPurchaseDate" type="date" value={newItem.lastPurchaseDate} onChange={handleInputChange} required />
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-400 text-red-700 p-3 text-sm">
                            <p><span className="font-bold">Error:</span> {error}</p>
                        </div>
                    )}
                    <div className="flex justify-end pt-4">
                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="px-6 py-2 bg-zankli-orange-600 text-white font-semibold rounded-lg hover:bg-zankli-orange-700 disabled:bg-zankli-orange-300"
                        >
                            {isSubmitting ? 'Saving...' : 'Save Item'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const StoreManagement = () => {
    const { storeItems, addStoreItem, error: fetchError } = useStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionError, setSubmissionError] = useState<string | null>(null);
    const [newItem, setNewItem] = useState({ 
        name: '', 
        purpose: '', 
        quantityInStock: 0, 
        unitCost: 0,
        lastPurchaseDate: new Date().toISOString().split('T')[0] 
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmissionError(null);
        
        const itemToAdd = {
            ...newItem,
            quantityInStock: newItem.quantityInStock || 0,
            unitCost: newItem.unitCost || 0,
        };

        const result = await addStoreItem(itemToAdd);

        if (result.success) {
            setNewItem({ name: '', purpose: '', quantityInStock: 0, unitCost: 0, lastPurchaseDate: new Date().toISOString().split('T')[0] });
            setIsModalOpen(false);
        } else {
            setSubmissionError(result.error);
        }
        setIsSubmitting(false);
    };
    
    const openModal = () => {
        setSubmissionError(null);
        setNewItem({ name: '', purpose: '', quantityInStock: 0, unitCost: 0, lastPurchaseDate: new Date().toISOString().split('T')[0] });
        setIsModalOpen(true);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Store Inventory</h2>
                <button onClick={openModal} className="flex items-center px-4 py-2 bg-zankli-orange-600 text-white font-semibold rounded-lg hover:bg-zankli-orange-700">
                    <Plus size={18} className="mr-1" />
                    Add Item
                </button>
            </div>

            {fetchError && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg mb-4 flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-3" />
                    <div>
                        <p><span className="font-bold">Error:</span> Could not load store items.</p>
                        <p className="text-sm">{fetchError}</p>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-zankli-cream-100">
                        <tr>
                            <th scope="col" className="px-6 py-3">Item Name</th>
                            <th scope="col" className="px-6 py-3">Purpose</th>
                            <th scope="col" className="px-6 py-3">In Stock</th>
                            <th scope="col" className="px-6 py-3">Unit Cost</th>
                            <th scope="col" className="px-6 py-3">Last Purchase</th>
                        </tr>
                    </thead>
                    <tbody>
                        {storeItems.map(item => (
                            <tr key={item.id} className="bg-white border-b hover:bg-gray-50 last:border-0">
                                <td scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{item.name}</td>
                                <td className="px-6 py-4">{item.purpose}</td>
                                <td className="px-6 py-4">{item.quantityInStock}</td>
                                <td className="px-6 py-4">{(item.unitCost || 0).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}</td>
                                <td className="px-6 py-4">{new Date(item.lastPurchaseDate).toLocaleDateString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {storeItems.length === 0 && !fetchError && (
                    <div className="text-center text-gray-500 py-8">
                        <p>No items found in the store.</p>
                    </div>
                 )}
            </div>
            <CreateItemModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSubmit}
                newItem={newItem}
                setNewItem={setNewItem}
                isSubmitting={isSubmitting}
                error={submissionError}
            />
        </div>
    );
};

export default StoreManagement;