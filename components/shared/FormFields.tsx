import React from 'react';

export const InputField = ({ label, name, type = 'text', required = false, onChange, value, readOnly = false }: { label: string, name: string, type?: string, required?: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, value?: string | number, readOnly?: boolean }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}{required && ' *'}</label>
        <input
            type={type} name={name} id={name} value={value} required={required} onChange={onChange} readOnly={readOnly}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-zankli-orange-500 focus:border-zankli-orange-500 sm:text-sm read-only:bg-gray-100"
        />
    </div>
);

export const TextAreaField = ({ label, name, required = false, onChange, value }: { label: string, name: string, required?: boolean, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, value?: string }) => (
    <div className="md:col-span-2">
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}{required && ' *'}</label>
        <textarea
            name={name} id={name} value={value} required={required} onChange={onChange} rows={3}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-zankli-orange-500 focus:border-zankli-orange-500 sm:text-sm"
        />
    </div>
);

export const SelectField = ({ label, value, onChange, options, required = false, placeholder = "Select an option" }: { label: string, value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, options: { value: string, label: string }[], required?: boolean, placeholder?: string }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700">{label}{required && ' *'}</label>
        <select value={value} onChange={onChange} required={required} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-zankli-orange-500 focus:border-zankli-orange-500 sm:text-sm">
            <option value="">{placeholder}</option>
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    </div>
);
