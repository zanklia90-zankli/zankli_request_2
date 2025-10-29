

import React, { createContext, useState, ReactNode, useCallback, useEffect, useMemo } from 'react';
import { Vendor } from '../types.ts';
import { supabase } from '../lib/supabaseClient.ts';
import { useAuth } from '../hooks/useAuth.ts';

interface VendorContextType {
  vendors: Vendor[];
  error: string | null;
  addVendor: (vendor: Omit<Vendor, 'id'>) => Promise<{ success: boolean; error: string | null }>;
  getVendorById: (id: string) => Vendor | undefined;
}

export const VendorContext = createContext<VendorContextType | undefined>(undefined);

interface VendorProviderProps {
  children?: ReactNode;
}

export const VendorProvider = ({ children }: VendorProviderProps) => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useAuth();

  const fetchVendors = useCallback(async () => {
    setError(null);
    try {
        const { data, error: supabaseError } = await supabase.from('vendors').select('*');
        if (supabaseError) {
            const errorMessage = `Supabase error fetching vendors: ${supabaseError.message}`;
            console.error(errorMessage, supabaseError);
            setError(errorMessage);
        } else if (data) {
            const formattedVendors = data.map(vendor => ({
                id: vendor.id,
                name: vendor.name,
                contactPerson: vendor.contact_person,
                contactEmail: vendor.contact_email,
            }));
            setVendors(formattedVendors as Vendor[]);
        }
    } catch (e: any) {
        let detailedMessage = `Details: ${e.message}`;
        if (e.message === 'Failed to fetch' && typeof navigator !== 'undefined' && !navigator.onLine) {
            detailedMessage = "It appears you are offline. Please check your internet connection.";
        }
        const errorMessage = `A network or unexpected error occurred while fetching vendors. ${detailedMessage}`;
        console.error(errorMessage, e);
        setError(errorMessage);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
        fetchVendors();
    }
  }, [currentUser, fetchVendors]);

  const addVendor = useCallback(async (vendorData: Omit<Vendor, 'id'>): Promise<{ success: boolean; error: string | null }> => {
    try {
        const vendorForDb = {
            name: vendorData.name,
            contact_person: vendorData.contactPerson,
            contact_email: vendorData.contactEmail,
        };
        const { error: insertError } = await supabase.from('vendors').insert([vendorForDb]);
        if (insertError) {
            console.error('Failed to add vendor:', insertError);
            return { success: false, error: `Failed to add vendor: ${insertError.message}` };
        }
        fetchVendors();
        return { success: true, error: null };
    } catch (e: any) {
        console.error('Network/unknown error adding vendor:', e);
        if (e.message === 'Failed to fetch' && typeof navigator !== 'undefined' && !navigator.onLine) {
            return { success: false, error: "You appear to be offline. Please check your internet connection." };
        }
        return { success: false, error: `A network error occurred. Please check your connection. Details: ${e.message}` };
    }
  }, [fetchVendors]);
  
  const getVendorById = useCallback((id: string) => {
    return vendors.find(v => v.id === id);
  }, [vendors]);

  const value = useMemo(() => ({ 
    vendors, 
    error, 
    addVendor, 
    getVendorById 
  }), [vendors, error, addVendor, getVendorById]);

  return (
    <VendorContext.Provider value={value}>
      {children}
    </VendorContext.Provider>
  );
};