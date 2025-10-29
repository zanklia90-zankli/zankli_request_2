import React, { useState } from 'react';
import { useVendors } from '../../hooks/useVendors.ts';
import { Plus, X, AlertTriangle } from 'lucide-react';

// Moved InputField outside the main component to prevent re-rendering on state change.
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

// Moved CreateVendorModal outside the main component to prevent re-rendering and losing focus.
const CreateVendorModal = ({ isOpen, onClose, onSubmit, newVendor, handleInputChange, isSubmitting, error }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    newVendor: { name: string; contactPerson: string; contactEmail: string; };
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    isSubmitting: boolean;
    error: string | null;
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Create New Vendor</h2>
                    <button onClick={onClose}><X className="text-gray-500"/></button>
                </div>
                <form onSubmit={onSubmit} className="space-y-4">
                    <InputField label="Vendor Name" name="name" value={newVendor.name} onChange={handleInputChange} required />
                    <InputField label="Contact Person" name="contactPerson" value={newVendor.contactPerson} onChange={handleInputChange} required />
                    <InputField label="Contact Email" name="contactEmail" type="email" value={newVendor.contactEmail} onChange={handleInputChange} required />
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
                            {isSubmitting ? 'Saving...' : 'Save Vendor'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const VendorManagement = () => {
    const { vendors, addVendor, error: fetchError } = useVendors();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newVendor, setNewVendor] = useState({ name: '', contactPerson: '', contactEmail: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionError, setSubmissionError] = useState<string | null>(null);


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewVendor({ ...newVendor, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmissionError(null);
        
        const result = await addVendor(newVendor);

        if (result.success) {
            setNewVendor({ name: '', contactPerson: '', contactEmail: '' });
            setIsModalOpen(false);
        } else {
            setSubmissionError(result.error);
        }
        setIsSubmitting(false);
    };
    
    const openModal = () => {
        setSubmissionError(null);
        setNewVendor({ name: '', contactPerson: '', contactEmail: '' });
        setIsModalOpen(true);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Vendors</h2>
                <button onClick={openModal} className="flex items-center px-4 py-2 bg-zankli-orange-600 text-white font-semibold rounded-lg hover:bg-zankli-orange-700">
                    <Plus size={18} className="mr-1" />
                    Add Vendor
                </button>
            </div>

            {fetchError && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg mb-4 flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-3" />
                    <div>
                        <p><span className="font-bold">Error:</span> Could not load vendors.</p>
                        <p className="text-sm">{fetchError}</p>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-zankli-cream-100">
                        <tr>
                            <th scope="col" className="px-6 py-3">Vendor Name</th>
                            <th scope="col" className="px-6 py-3">Contact Person</th>
                            <th scope="col" className="px-6 py-3">Contact Email</th>
                        </tr>
                    </thead>
                    <tbody>
                        {vendors.map(vendor => (
                            <tr key={vendor.id} className="bg-white border-b hover:bg-gray-50">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{vendor.name}</th>
                                <td className="px-6 py-4">{vendor.contactPerson}</td>
                                <td className="px-6 py-4">{vendor.contactEmail}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {vendors.length === 0 && !fetchError && <p className="text-center text-gray-500 py-8">No vendors found.</p>}
            </div>
            <CreateVendorModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSubmit}
                newVendor={newVendor}
                handleInputChange={handleInputChange}
                isSubmitting={isSubmitting}
                error={submissionError}
            />
        </div>
    );
};

export default VendorManagement;