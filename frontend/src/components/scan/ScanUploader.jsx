import React, { useState } from 'react';
import { Upload, FolderArchive, Sparkles, FileCheck } from 'lucide-react';
import { useFields } from '../../context/FieldContext';
import { useLanguage } from '../../context/LanguageContext';

export default function ScanUploader({ onStartScan, onLaunchDemo }) {
  const { fields, selectedField, setSelectedField } = useFields();
  const { t } = useLanguage();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadMode, setUploadMode] = useState('images');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
      {/* Upload Mode Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            🚁 {t('newDroneScan')}
          </h2>
          <p className="text-xs text-slate-400">
            {t('uploadDesc')}
          </p>
        </div>

        {/* Option Tabs */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setUploadMode('images')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              uploadMode === 'images' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('optionImages')}
          </button>
          <button
            onClick={() => setUploadMode('batch')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              uploadMode === 'batch' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('optionBatch')}
          </button>
          <button
            onClick={() => setUploadMode('orthomosaic')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              uploadMode === 'orthomosaic' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('optionOrthomosaic')}
          </button>
        </div>
      </div>

      {/* Field Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">{t('targetField')}</label>
          <select
            value={selectedField ? selectedField._id : ''}
            onChange={(e) => {
              const found = fields.find((f) => f._id === e.target.value);
              if (found) setSelectedField(found);
            }}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            {fields.map((f) => (
              <option key={f._id} value={f._id}>
                {f.fieldName} ({f.cropType} - {f.area} ha)
              </option>
            ))}
          </select>
        </div>

        {/* Fast Demo Mode Card */}
        <div className="bg-gradient-to-r from-emerald-950/40 via-teal-950/40 to-slate-900 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> {t('instantDemoMode')}
            </span>
            <p className="text-[11px] text-slate-400">{t('uploadDesc')}</p>
          </div>
          <button
            onClick={onLaunchDemo}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs hover:brightness-110 shadow-md shadow-emerald-950 transition cursor-pointer shrink-0"
          >
            {t('instantDemoMode')}
          </button>
        </div>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
          dragActive
            ? 'border-emerald-400 bg-emerald-950/30 scale-[0.99]'
            : selectedFiles.length > 0
            ? 'border-emerald-800 bg-slate-900/60'
            : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
        }`}
      >
        <input
          type="file"
          id="fileInput"
          multiple={uploadMode !== 'orthomosaic'}
          accept=".jpg,.jpeg,.png,.webp,.tiff,.tif"
          onChange={handleFileChange}
          className="hidden"
        />

        <label htmlFor="fileInput" className="cursor-pointer flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 flex items-center justify-center">
            {uploadMode === 'batch' ? <FolderArchive className="w-7 h-7" /> : <Upload className="w-7 h-7" />}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-200">
              {t('dragDropImages')}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {t('supportedFormats')}
            </p>
          </div>
        </label>
      </div>

      {/* Selected Files Thumbnails */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <FileCheck className="w-4 h-4" /> {selectedFiles.length} {t('readyForScan')}
            </span>
            <button onClick={() => setSelectedFiles([])} className="text-slate-400 hover:text-red-400">
              {t('clearAll')}
            </button>
          </div>
        </div>
      )}

      {/* Start Scan Button */}
      <div className="flex justify-end">
        <button
          onClick={() => onStartScan(selectedFiles)}
          disabled={selectedFiles.length === 0}
          className={`px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition cursor-pointer ${
            selectedFiles.length > 0
              ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-950'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          {t('startPipeline')}
        </button>
      </div>
    </div>
  );
}
