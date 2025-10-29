
import { useContext } from 'react';
import { VendorContext } from '../context/VendorContext.tsx';

export const useVendors = () => {
  const context = useContext(VendorContext);
  if (context === undefined) {
    throw new Error('useVendors must be used within a VendorProvider');
  }
  return context;
};