

import React, { createContext, useState, ReactNode, useCallback, useEffect, useMemo } from 'react';
import { StoreItem } from '../types.ts';
import { supabase } from '../lib/supabaseClient.ts';
import { useAuth } from '../hooks/useAuth.ts';

interface StoreContextType {
  storeItems: StoreItem[];
  error: string | null;
  addStoreItem: (item: Omit<StoreItem, 'id'>) => Promise<{ success: boolean; error: string | null }>;
  getStoreItemById: (id: string) => StoreItem | undefined;
}

export const StoreContext = createContext<StoreContextType | undefined>(undefined);

interface StoreProviderProps {
  children?: ReactNode;
}

export const StoreProvider = ({ children }: StoreProviderProps) => {
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useAuth();

  const fetchStoreItems = useCallback(async () => {
    setError(null);
    try {
        const { data, error: supabaseError } = await supabase.from('store_items').select('*');
        if (supabaseError) {
            const errorMessage = `Supabase error fetching store items: ${supabaseError.message}`;
            console.error(errorMessage, supabaseError);
            setError(errorMessage);
        } else if (data) {
            const formattedItems = data.map(item => ({
                id: item.id,
                name: item.name,
                purpose: item.purpose,
                quantityInStock: item.quantity_in_stock,
                lastPurchaseDate: item.last_purchase_date,
                unitCost: item.unit_cost,
            }));
            setStoreItems(formattedItems as StoreItem[]);
        }
    } catch (e: any) {
        let detailedMessage = `Details: ${e.message}`;
        if (e.message === 'Failed to fetch' && typeof navigator !== 'undefined' && !navigator.onLine) {
            detailedMessage = "It appears you are offline. Please check your internet connection.";
        }
        const errorMessage = `A network or unexpected error occurred while fetching store items. ${detailedMessage}`;
        console.error(errorMessage, e);
        setError(errorMessage);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
        fetchStoreItems();
    }
  }, [currentUser, fetchStoreItems]);

  const addStoreItem = useCallback(async (itemData: Omit<StoreItem, 'id'>): Promise<{ success: boolean; error: string | null }> => {
    try {
        const itemForDb = {
            name: itemData.name,
            purpose: itemData.purpose,
            quantity_in_stock: itemData.quantityInStock,
            unit_cost: itemData.unitCost,
            last_purchase_date: itemData.lastPurchaseDate,
        };

        const { error: insertError } = await supabase.from('store_items').insert([itemForDb]);
        if (insertError) {
            console.error('Failed to add store item:', insertError);
            return { success: false, error: `Failed to add store item: ${insertError.message}` };
        }
        fetchStoreItems();
        return { success: true, error: null };
    } catch (e: any) {
        console.error('Network/unknown error adding store item:', e);
        if (e.message === 'Failed to fetch' && typeof navigator !== 'undefined' && !navigator.onLine) {
            return { success: false, error: "You appear to be offline. Please check your internet connection." };
        }
        return { success: false, error: `A network error occurred. Please check your connection. Details: ${e.message}` };
    }
  }, [fetchStoreItems]);
  
  const getStoreItemById = useCallback((id: string) => {
    return storeItems.find(i => i.id === id);
  }, [storeItems]);
  
  const value = useMemo(() => ({ 
    storeItems, 
    error, 
    addStoreItem, 
    getStoreItemById 
  }), [storeItems, error, addStoreItem, getStoreItemById]);

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
};