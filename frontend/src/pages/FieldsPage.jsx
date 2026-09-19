import React, { useState } from 'react';
import { useFields } from '../context/FieldContext';
import api from '../services/api';
import { MapPin, Plus, Trash2, Sprout, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function FieldsPage() {
  const { fields, refreshAllData, setSelectedField } = useFields();
  const [showModal, setShowModal] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [cropType, setCropType] = useState('Tomato');
  const [area, setArea] = useState('5.2');
  const [location, setLocation] = useState('Coimbatore');
  const navigate = useNavigate();

  const handleCreateField = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/fields', {
        fieldName,
        cropType,
        area: Number(area),
        location,
        latitude: 11.0168,
        longitude: 76.9558,
      });
      if (res.data.success) {
        setShowModal(false);
        setFieldName('');
        await refreshAllData();
      }
    } catch (err) {
      console.warn('Field creation error:', err.message);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            🌱 Agricultural Fields Registry
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage field boundaries, crop types, GPS coordinates, and historical drone survey baselines.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-950 transition cursor-pointer flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add New Field
        </button>
      </div>

      {/* Fields Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {fields.map((field) => (
          <div
            key={field._id}
            className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 hover:border-emerald-500/40 transition group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center font-bold">
                  <Sprout className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-100 group-hover:text-emerald-400 transition">
                    {field.fieldName}
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">{field.location}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] block font-medium">Crop Type</span>
                <span className="font-bold text-slate-200 text-sm">{field.cropType}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] block font-medium">Field Area</span>
                <span className="font-bold text-emerald-400 text-sm font-mono">{field.area} Ha</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[11px] font-mono text-slate-500">
                GPS: {field.latitude?.toFixed(4)}° N, {field.longitude?.toFixed(4)}° E
              </span>

              <button
                onClick={() => {
                  setSelectedField(field);
                  navigate('/map');
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 font-bold text-xs transition cursor-pointer flex items-center gap-1"
              >
                Inspect Map <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Field Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-100">Add New Agricultural Field</h2>
            <form onSubmit={handleCreateField} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Field Name</label>
                <input
                  type="text"
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  required
                  placeholder="e.g. South Ridge Field B"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Crop Type</label>
                <input
                  type="text"
                  value={cropType}
                  onChange={(e) => setCropType(e.target.value)}
                  required
                  placeholder="e.g. Tomato, Corn, Wheat, Cotton"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Area (Hectares)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
                >
                  Save Field
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
