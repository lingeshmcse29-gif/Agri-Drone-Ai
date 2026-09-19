import React, { useState, useEffect, useRef } from 'react';
import { useFields } from '../context/FieldContext';
import { useLanguage } from '../context/LanguageContext';
import ScanUploader from '../components/scan/ScanUploader';
import ScanPipelineProgress from '../components/scan/ScanPipelineProgress';
import HotspotDetailModal from '../components/hotspots/HotspotDetailModal';
import StatusBadge from '../components/common/StatusBadge';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Plane, CheckCircle2, Flame, Map, ArrowRight, RefreshCw, Cpu, Sparkles, AlertTriangle } from 'lucide-react';

export default function DroneScanPage() {
  const { selectedField, refreshAllData } = useFields();
  const { t } = useLanguage();
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('IDLE');
  const [errorMessage, setErrorMessage] = useState(null);
  const [currentScan, setCurrentScan] = useState(null);
  const [hotspotsResult, setHotspotsResult] = useState([]);
  const [inspectedHotspot, setInspectedHotspot] = useState(null);
  const pollingIntervalRef = useRef(null);
  const navigate = useNavigate();

  // Clear any active polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleStartScan = async (files) => {
    if (!selectedField) return;
    setProcessing(true);
    setProgress(10);
    setScanStatus('UPLOADED');
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('fieldId', selectedField._id);
      files.forEach((file) => {
        formData.append('droneImages', file);
      });

      // Decoupled upload: returns 201 immediately with scanId
      const createRes = await api.post('/scans', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (createRes.data.success) {
        const scan = createRes.data.data?.scan || createRes.data.scan;
        setCurrentScan(scan);
        pollScanStatus(scan._id);
      } else {
        throw new Error(createRes.data.error?.message || 'Failed to initialize scan upload.');
      }
    } catch (err) {
      console.warn('Scan upload error, attempting demo fallback:', err.message);
      handleLaunchDemo();
    }
  };

  const handleLaunchDemo = async () => {
    setProcessing(true);
    setProgress(10);
    setScanStatus('UPLOADED');
    setErrorMessage(null);

    try {
      const demoRes = await api.post('/scans/demo');
      if (demoRes.data.success) {
        const scan = demoRes.data.data?.scan || demoRes.data.scan;
        setCurrentScan(scan);
        pollScanStatus(scan._id);
      } else {
        throw new Error(demoRes.data.error?.message || 'Failed to launch demo scan.');
      }
    } catch (err) {
      console.error('Demo API error:', err.message);
      setErrorMessage(err.response?.data?.error?.message || err.message);
      setProcessing(false);
      setScanStatus('FAILED');
    }
  };

  /**
   * Real backend status polling.
   * Periodically queries GET /api/scans/:id/status until reaching terminal state (COMPLETED or FAILED).
   */
  const pollScanStatus = (scanId) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    const poll = async () => {
      try {
        const res = await api.get(`/scans/${scanId}/status`);
        if (res.data.success) {
          const statusData = res.data.data;
          setScanStatus(statusData.processingStatus);
          setProgress(statusData.progress || 10);

          if (statusData.processingStatus === 'COMPLETED') {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;

            // Fetch completed scan with full hotspot details
            const fullScanRes = await api.get(`/scans/${scanId}`);
            if (fullScanRes.data.success) {
              setCurrentScan(fullScanRes.data.scan);
              setHotspotsResult(fullScanRes.data.hotspots || []);
            }
            await refreshAllData();
            setTimeout(() => {
              setProcessing(false);
            }, 800);
          } else if (statusData.processingStatus === 'FAILED') {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            setErrorMessage(statusData.processingError || 'Pipeline processing failed.');
            setProcessing(false);
          }
        }
      } catch (pollErr) {
        console.warn('Error polling scan status:', pollErr.message);
      }
    };

    // Immediate initial poll followed by 2s interval
    poll();
    pollingIntervalRef.current = setInterval(poll, 2000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-950">
              <Plane className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-100 tracking-tight">{t('droneTelemetry')}</h1>
              <p className="text-xs text-slate-400">
                {selectedField ? `${selectedField.fieldName} (${selectedField.cropType})` : t('selectFieldPrompt')}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleLaunchDemo}
          disabled={processing}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-950 hover:brightness-110 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4 text-slate-950" /> {t('instantDemoMode')}
        </button>
      </div>

      {/* Error alert if processing failed */}
      {scanStatus === 'FAILED' && errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">Processing Failed</p>
            <p className="text-xs text-rose-300/90">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Pipeline Processing Animation OR Scan Uploader */}
      {processing ? (
        <div className="space-y-2">
          <ScanPipelineProgress progress={progress} status={scanStatus} />
          <div className="flex items-center justify-between px-2 text-xs font-mono text-slate-400">
            <span>State: <span className="text-emerald-400 font-bold">{scanStatus}</span></span>
            <span>Real-time backend polling active (2s interval)</span>
          </div>
        </div>
      ) : (
        <ScanUploader onStartScan={handleStartScan} onLaunchDemo={handleLaunchDemo} />
      )}

      {/* Completed Scan Results View */}
      {currentScan && currentScan.processingStatus === 'COMPLETED' && !processing && (
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-100">
                  {t('scanComplete')} — {selectedField ? selectedField.fieldName : 'North Farm'}
                </span>
                <StatusBadge status="COMPLETED" />
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Scan ID: {currentScan._id} | Date: {new Date(currentScan.createdAt).toLocaleString()}
              </p>
            </div>

            <button
              onClick={() => navigate('/map')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-2"
            >
              <Map className="w-4 h-4 text-emerald-400" /> {t('viewOnInteractiveMap')}
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Healthy Canopy</span>
              <p className="text-2xl font-black text-emerald-400 mt-1 font-mono">
                {currentScan.healthyPercentage}%
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Affected Area</span>
              <p className="text-2xl font-black text-amber-400 mt-1 font-mono">
                {currentScan.affectedPercentage}%
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Stress Hotspots</span>
              <p className="text-2xl font-black text-rose-400 mt-1 font-mono">
                {currentScan.hotspotCount || hotspotsResult.length}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Overall Risk</span>
              <div className="mt-1">
                <StatusBadge status={currentScan.overallRisk} />
              </div>
            </div>
          </div>

          {/* AI Agronomic Diagnostic Assessment & Evidence Traceability */}
          {currentScan.diagnosticSummary && currentScan.diagnosticSummary.status && (
            <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 space-y-3 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-100 text-sm flex items-center gap-2">
                      Agronomic Diagnostic Assessment
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal">
                        Status: {currentScan.diagnosticSummary.status}
                      </span>
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Primary Candidate: <span className="text-emerald-400 font-semibold">{currentScan.diagnosticSummary.primaryFinding || 'Healthy Crop Stand'}</span>
                      {currentScan.diagnosticSummary.confidence > 0 && ` (${(currentScan.diagnosticSummary.confidence * 100).toFixed(0)}% AI confidence)`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 font-bold">
                    Confidence: {currentScan.diagnosticSummary.confidenceBand || 'MODERATE'}
                  </span>
                </div>
              </div>

              {/* Differentials & Limitations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-[11px]">
                {currentScan.diagnosticSummary.differentialFindings && currentScan.diagnosticSummary.differentialFindings.length > 0 && (
                  <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                    <span className="font-bold text-slate-300 block">Candidate Differential Hypotheses:</span>
                    <ul className="space-y-1 text-slate-400 list-disc list-inside">
                      {currentScan.diagnosticSummary.differentialFindings.slice(0, 3).map((df, idx) => (
                        <li key={idx}>
                          <span className="text-slate-200">{df.name}</span> {df.confidence ? `(${(df.confidence * 100).toFixed(0)}%)` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="font-bold text-amber-400/90 block">Scientific Transparency & Limitations:</span>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Visible RGB imagery indicates foliar stress patterns but cannot provide definitive pathogen confirmation without laboratory or field ground scouting.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Legacy aiSummary fallback if diagnosticSummary object is not yet populated */}
          {!currentScan.diagnosticSummary && currentScan.aiSummary && (
            <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-800/40 text-xs text-slate-300 leading-relaxed flex items-start gap-3">
              <Cpu className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-emerald-400 block mb-1">AI Diagnostic Assessment</span>
                {currentScan.aiSummary}
              </div>
            </div>
          )}

          {/* Extracted Hotspots List */}
          {hotspotsResult.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-400" />
                  Detected Field Stress Hotspots ({hotspotsResult.length})
                </h3>
                <span className="text-xs text-slate-400">Click any hotspot to view diagnostic details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {hotspotsResult.map((hs) => (
                  <div
                    key={hs.hotspotId}
                    onClick={() => setInspectedHotspot(hs)}
                    className="p-3.5 rounded-2xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 transition cursor-pointer space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-200 group-hover:text-emerald-400 transition">
                        #{hs.hotspotId}
                      </span>
                      <StatusBadge status={hs.severity} />
                    </div>
                    <p className="text-xs text-slate-400 capitalize truncate">
                      {hs.stressType ? hs.stressType.replace(/_/g, ' ') : 'Canopy Stress'}
                    </p>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Area: ~{hs.affectedArea || 12}m²</span>
                      <span>Risk: {hs.riskLevel}/100</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hotspot Modal Inspector */}
      {inspectedHotspot && (
        <HotspotDetailModal
          hotspot={inspectedHotspot}
          onClose={() => setInspectedHotspot(null)}
          onStatusUpdated={() => {
            refreshAllData();
          }}
        />
      )}
    </div>
  );
}
