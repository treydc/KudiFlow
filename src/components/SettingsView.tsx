import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Upload, X, Check, LogOut, Image as ImageIcon } from 'lucide-react';
import { getStoredBusinessProfile, saveStoredBusinessProfile, BusinessProfile, cleanBrandName } from '../utils/generatePdf';

const CURRENCIES = [
  { code: 'NGN', label: 'NGN - Nigerian Naira (₦)', symbol: '₦' },
  { code: 'USD', label: 'USD - US Dollar ($)', symbol: '$' },
  { code: 'EUR', label: 'EUR - Euro (€)', symbol: '€' },
  { code: 'GBP', label: 'GBP - British Pound (£)', symbol: '£' },
];

export const SettingsView: React.FC = () => {
  const { signOut } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bizProfile, setBizProfile] = useState<BusinessProfile>(() => {
    const stored = getStoredBusinessProfile();
    return {
      ...stored,
      name: cleanBrandName(stored.name),
      defaultCurrency: stored.defaultCurrency || 'NGN',
      bankName: stored.bankName || '',
      accountName: cleanBrandName(stored.accountName || stored.name),
      accountNumber: stored.accountNumber || '',
    };
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>(bizProfile.logoUrl || '');

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setLogoPreview(result);
      setBizProfile((prev) => ({ ...prev, logoUrl: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview('');
    setBizProfile((prev) => ({ ...prev, logoUrl: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredBusinessProfile({
      name: cleanBrandName(bizProfile.name.trim()),
      email: bizProfile.email.trim(),
      address: bizProfile.address.trim(),
      logoUrl: logoPreview,
      defaultCurrency: bizProfile.defaultCurrency || 'NGN',
      bankName: bizProfile.bankName?.trim() || '',
      accountName: cleanBrandName(bizProfile.accountName?.trim() || bizProfile.name.trim()),
      accountNumber: bizProfile.accountNumber?.trim() || '',
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-white tracking-tight">Settings</h1>
        <p className="text-xs text-neutral-400 mt-0.5">
          Manage your business details, branding, and payment information
        </p>
      </div>

      {/* Settings Form Container */}
      <form onSubmit={handleSaveSettings} className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 sm:p-6 space-y-5 shadow-xs">
        {/* Business Logo Upload */}
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1.5">
            Business Logo
          </label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-md bg-neutral-950 border border-neutral-800 flex items-center justify-center overflow-hidden shrink-0">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Business Logo Preview"
                  className="w-full h-full object-contain p-1.5"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-neutral-600">
                  <ImageIcon className="w-5 h-5 mb-0.5" />
                  <span className="text-[10px]">No logo</span>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleLogoUpload}
                className="hidden"
                id="logo-file-input"
              />
              <div className="flex items-center gap-2">
                <label
                  htmlFor="logo-file-input"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-md transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-neutral-300" />
                  <span>{logoPreview ? 'Change Logo' : 'Upload Logo'}</span>
                </label>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-neutral-400 hover:text-red-400 hover:bg-neutral-950 rounded-md transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-neutral-500">
                PNG, JPG, SVG or WebP. Appears on invoice PDFs.
              </p>
            </div>
          </div>
        </div>

        {/* Business Name */}
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1">
            Business Name <span className="text-neutral-500">*</span>
          </label>
          <input
            type="text"
            required
            value={bizProfile.name}
            onChange={(e) => setBizProfile({ ...bizProfile, name: e.target.value })}
            placeholder="e.g. KudiFlow"
            className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors"
          />
        </div>

        {/* Business Address */}
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1">
            Business Address <span className="text-neutral-500">*</span>
          </label>
          <textarea
            required
            rows={2}
            value={bizProfile.address}
            onChange={(e) => setBizProfile({ ...bizProfile, address: e.target.value })}
            placeholder="e.g. Plot 12, Commercial Corridor, Victoria Island, Lagos, Nigeria"
            className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1">
            Email Address <span className="text-neutral-500">*</span>
          </label>
          <input
            type="email"
            required
            value={bizProfile.email}
            onChange={(e) => setBizProfile({ ...bizProfile, email: e.target.value })}
            placeholder="e.g. billing@kudiflow.app"
            className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors"
          />
        </div>

        {/* Default Currency */}
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1">
            Default Currency
          </label>
          <select
            value={bizProfile.defaultCurrency || 'NGN'}
            onChange={(e) => setBizProfile({ ...bizProfile, defaultCurrency: e.target.value })}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-neutral-600 transition-colors"
          >
            {CURRENCIES.map((curr) => (
              <option key={curr.code} value={curr.code}>
                {curr.label}
              </option>
            ))}
          </select>
        </div>

        {/* Bank & Payment Details */}
        <div className="pt-2 border-t border-neutral-800 space-y-4">
          <div className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
            Bank Details (Payment Instructions)
          </div>

          {/* Bank Name */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Bank Name
            </label>
            <input
              type="text"
              value={bizProfile.bankName || ''}
              onChange={(e) => setBizProfile({ ...bizProfile, bankName: e.target.value })}
              placeholder="e.g. Zenith Bank PLC, Access Bank, GTBank"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors"
            />
          </div>

          {/* Account Name */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Account Name
            </label>
            <input
              type="text"
              value={bizProfile.accountName || ''}
              onChange={(e) => setBizProfile({ ...bizProfile, accountName: e.target.value })}
              placeholder="e.g. KudiFlow"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors"
            />
          </div>

          {/* Account Number */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Account Number
            </label>
            <input
              type="text"
              value={bizProfile.accountNumber || ''}
              onChange={(e) => setBizProfile({ ...bizProfile, accountNumber: e.target.value })}
              placeholder="e.g. 1018892341"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-xs text-neutral-100 tabular-nums placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors"
            />
          </div>
        </div>

        {/* Submit & Save */}
        <div className="pt-3 flex items-center justify-between border-t border-neutral-800">
          <button
            type="submit"
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium text-xs rounded-md transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>Save Settings</span>
          </button>

          {savedSuccess && (
            <span className="text-xs text-emerald-500 flex items-center gap-1 font-medium">
              <Check className="w-3.5 h-3.5" />
              <span>Settings saved successfully</span>
            </span>
          )}
        </div>
      </form>

      {/* Sign Out Section */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 sm:p-5 flex items-center justify-between">
        <div>
          <h2 className="text-xs font-medium text-white">Sign Out</h2>
          <p className="text-[11px] text-neutral-400 mt-0.5">End your current session</p>
        </div>

        <button
          type="button"
          onClick={() => signOut()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-red-900/40 rounded-md transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};
