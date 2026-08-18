import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Sparkles, 
  Upload, 
  Printer, 
  Download, 
  Palette, 
  Eraser, 
  Brush, 
  Crop, 
  Sliders, 
  RotateCcw, 
  Check, 
  ZoomIn, 
  ZoomOut,
  Send,
  Eye,
  Globe,
  Settings,
  RefreshCw
} from 'lucide-react';
import { STUDIO_BG_COLORS, PHOTO_PRESETS, StudioBgColor } from '../types';
import { 
  removeBackgroundAuto,
  compositeCutoutWithColor,
  applyFiltersToCanvas, 
  loadImage, 
  downloadDataUrl, 
  mmToPx 
} from '../utils/imageProcessing';
import { PrintPreviewModal } from './PrintPreviewModal';
import { InteractiveCropperModal } from './InteractiveCropperModal';

interface BackgroundRemoverProps {
  onSendToPrintSheet?: (imageUrl: string, type: 'passport' | 'stamp') => void;
}

export const BackgroundRemover: React.FC<BackgroundRemoverProps> = ({ onSendToPrintSheet }) => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [cutoutImage, setCutoutImage] = useState<string | null>(null); // Pure transparent PNG
  const [selectedBgColor, setSelectedBgColor] = useState<string>('#5B92E5'); // BD Passport Sky Blue default
  const [tolerance, setTolerance] = useState<number>(40);
  const [isTransparent, setIsTransparent] = useState<boolean>(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('PASSPORT_BD');
  const [selectedService, setSelectedService] = useState<'auto' | 'remove_bg' | 'cutout_pro'>('auto');
  const [isRemovingBg, setIsRemovingBg] = useState<boolean>(false);
  const [apiSourceInfo, setApiSourceInfo] = useState<string | null>(null);

  // Manual Cropper state
  const [isCropping, setIsCropping] = useState<boolean>(false);

  // Brush Mode
  const [brushMode, setBrushMode] = useState<'none' | 'erase' | 'restore'>('none');
  const [brushSize, setBrushSize] = useState<number>(20);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  // Filters
  const [brightness, setBrightness] = useState<number>(5);
  const [contrast, setContrast] = useState<number>(8);
  const [zoom, setZoom] = useState<number>(100);
  const [isProcessingAI, setIsProcessingAI] = useState<boolean>(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);

  // Print Preview
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Canvas Refs
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sample portrait for instant test
  const loadDemoPhoto = () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
        <rect width="100%" height="100%" fill="#cbd5e1"/>
        <circle cx="200" cy="180" r="85" fill="#fbcfe8"/>
        <!-- Hair -->
        <path d="M 115 170 Q 200 80 285 170 Q 290 120 200 90 Q 110 120 115 170" fill="#1e293b"/>
        <!-- Eyes & Face details -->
        <circle cx="170" cy="170" r="8" fill="#1e293b"/>
        <circle cx="230" cy="170" r="8" fill="#1e293b"/>
        <path d="M 190 195 Q 200 205 210 195" stroke="#94a3b8" stroke-width="3" fill="none"/>
        <path d="M 180 220 Q 200 235 220 220" stroke="#be185d" stroke-width="4" fill="none"/>
        <!-- Neck -->
        <rect x="175" y="250" width="50" height="50" fill="#fbcfe8"/>
        <!-- Suit / Shirt -->
        <path d="M 90 500 L 140 300 L 260 300 L 310 500 Z" fill="#0f172a"/>
        <polygon points="175,300 225,300 200,380" fill="#ffffff"/>
        <polygon points="195,300 205,300 200,420" fill="#dc2626"/>
      </svg>
    `;
    const demoUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    setOriginalImage(demoUrl);
    setCutoutImage(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setOriginalImage(url);
      setCutoutImage(null);
    };
    reader.readAsDataURL(file);
  };

  // Perform background cutout via remove.bg / cutout.pro / studio AI
  const executeBackgroundRemoval = useCallback(async (sourceImgUrl: string) => {
    setIsRemovingBg(true);
    try {
      const result = await removeBackgroundAuto(sourceImgUrl, {
        targetBgColor: isTransparent ? null : selectedBgColor,
        service: selectedService,
        tolerance,
      });

      setCutoutImage(result.transparentDataUrl);
      if (result.source === 'remove.bg') {
        setApiSourceInfo('Remove.bg API দ্বারা নিখুঁত ব্যাকগ্রাউন্ড রিমুভ হয়েছে।');
      } else if (result.source === 'cutout.pro') {
        setApiSourceInfo('Cutout.pro API দ্বারা ব্যাকগ্রাউন্ড রিমুভ হয়েছে।');
      } else {
        setApiSourceInfo('স্টুডিও স্মার্ট এআই ইঞ্জিন দ্বারা ব্যাকগ্রাউন্ড প্রসেস হয়েছে।');
      }
    } catch (err) {
      console.error('BG removal error:', err);
    } finally {
      setIsRemovingBg(false);
    }
  }, [isTransparent, selectedBgColor, selectedService, tolerance]);

  // When original image is loaded or changed, perform auto background removal
  useEffect(() => {
    if (originalImage && !cutoutImage) {
      executeBackgroundRemoval(originalImage);
    }
  }, [originalImage, cutoutImage, executeBackgroundRemoval]);

  // Real-time Composite: whenever selectedBgColor, filters, or cutout changes
  useEffect(() => {
    if (!originalImage) return;

    let isMounted = true;
    const sourceToUse = cutoutImage || originalImage;

    loadImage(sourceToUse).then((img) => {
      if (!isMounted) return;
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;

      // 1. Fill chosen background color if not transparent
      if (!isTransparent && cutoutImage) {
        ctx.fillStyle = selectedBgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // 2. Draw cutout subject
      ctx.drawImage(img, 0, 0);

      // 3. Apply brightness & contrast filters
      const filtered = applyFiltersToCanvas(canvas, { brightness, contrast });

      // 4. Render to display canvas
      const displayCanvas = displayCanvasRef.current;
      if (displayCanvas) {
        displayCanvas.width = filtered.width;
        displayCanvas.height = filtered.height;
        const dCtx = displayCanvas.getContext('2d')!;
        dCtx.drawImage(filtered, 0, 0);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [originalImage, cutoutImage, selectedBgColor, isTransparent, brightness, contrast]);

  // AI Portrait Enhancement / Advice using server-side Gemini
  const handleAiAnalyze = async () => {
    if (!originalImage) return;
    setIsProcessingAI(true);
    setAiAdvice(null);

    try {
      const res = await fetch('/api/ai/analyze-portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: originalImage }),
      });

      const json = await res.json();
      if (json.data) {
        if (json.data.recommendedBgColor) {
          setSelectedBgColor(json.data.recommendedBgColor);
          setIsTransparent(false);
        }
        if (json.data.enhancementAdvice) {
          setAiAdvice(json.data.enhancementAdvice);
        } else {
          setAiAdvice('AI অ্যানালাইসিস সম্পন্ন: ব্যাকগ্রাউন্ড সঠিক স্কাই ব্লুতে অ্যাডজাস্ট করা হয়েছে।');
        }
      }
    } catch (err) {
      console.error('AI analyze err:', err);
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Brush Erase / Restore Canvas Interactivity
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (brushMode === 'none') return;
    setIsDrawing(true);
    applyBrushAtEvent(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || brushMode === 'none') return;
    applyBrushAtEvent(e);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const applyBrushAtEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const ctx = canvas.getContext('2d')!;
    ctx.save();
    if (brushMode === 'erase') {
      ctx.fillStyle = selectedBgColor;
      ctx.beginPath();
      ctx.arc(x, y, brushSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  // Export current cropped/enhanced photo
  const getProcessedDataUrl = (format: 'image/jpeg' | 'image/png' = 'image/jpeg'): string => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return '';
    return canvas.toDataURL(format, 0.98);
  };

  const handleDownload = (format: 'jpg' | 'png') => {
    const url = getProcessedDataUrl(format === 'png' ? 'image/png' : 'image/jpeg');
    if (url) {
      downloadDataUrl(url, `Studio_Photo_${selectedPreset}.${format}`);
    }
  };

  // Render for Automatic Print Preview Modal (4R sheet or single passport)
  const renderPrintPage = (
    ctx: CanvasRenderingContext2D,
    widthPx: number,
    heightPx: number,
    dpi = 300
  ) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, widthPx, heightPx);

    const canvas = displayCanvasRef.current;
    if (!canvas) return;

    // Draw 4 Passport copies onto 4R paper
    const preset = PHOTO_PRESETS[selectedPreset] || PHOTO_PRESETS.PASSPORT_BD;
    const photoWPx = mmToPx(preset.widthMm, dpi);
    const photoHPx = mmToPx(preset.heightMm, dpi);
    const gapPx = mmToPx(5, dpi);

    const cols = 2;
    const rows = 2;
    const totalW = cols * photoWPx + (cols - 1) * gapPx;
    const totalH = rows * photoHPx + (rows - 1) * gapPx;
    const startX = (widthPx - totalW) / 2;
    const startY = (heightPx - totalH) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * (photoWPx + gapPx);
        const y = startY + r * (photoHPx + gapPx);

        ctx.drawImage(canvas, x, y, photoWPx, photoHPx);
        
        // 0.5pt cut border
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, photoWPx, photoHPx);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 font-bold">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              পাসপোর্ট ফটো ও ব্যাকগ্রাউন্ড স্টুডিও (Passport Studio)
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                REMOVE.BG / CUTOUT.PRO
              </span>
            </h2>
            <p className="text-[11px] text-slate-500">
              ব্যাকগ্রাউন্ড রিমুভ করে সরাসরি যেকোনো কালার (স্কাই ব্লু, অফিশিয়াল ব্লু, সাদা) সেট করুন।
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadDemoPhoto}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
          >
            ডেমো ছবি লোড
          </button>

          <button
            onClick={() => setShowPrintModal(true)}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
          >
            <Printer className="w-3.5 h-3.5" />
            অটো প্রিন্ট প্রিভিউ
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Side: Controls & Color Palette */}
        <div className="lg:col-span-5 space-y-4">
          {/* 1. Upload box & Cropper trigger */}
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800">কাস্টমারের ছবি আপলোড</span>
              {originalImage && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsCropping(true)}
                    className="text-[11px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <Crop className="w-3.5 h-3.5" />
                    ম্যানুয়াল ক্রপ
                  </button>
                  <button
                    onClick={() => {
                      setOriginalImage(null);
                      setCutoutImage(null);
                    }}
                    className="text-[11px] text-red-600 font-medium hover:underline"
                  >
                    নতুন ছবি দিন
                  </button>
                </div>
              )}
            </div>

            <label className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded flex flex-col items-center justify-center p-4 cursor-pointer bg-slate-50 hover:bg-blue-50/30 transition">
              <Upload className="w-5 h-5 text-slate-400 mb-1" />
              <span className="text-xs text-slate-700 font-semibold">ছবি বেছে নিন বা ড্র্যাগ করুন</span>
              <span className="text-[10px] text-slate-400">যেকোনো সাইজ / JPG, PNG, WebP</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>

            {/* Service engine selection */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px] font-semibold flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                ইঞ্জিন:
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setSelectedService('auto');
                    if (originalImage) executeBackgroundRemoval(originalImage);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    selectedService === 'auto'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  অটো (Auto)
                </button>
                <button
                  onClick={() => {
                    setSelectedService('remove_bg');
                    if (originalImage) executeBackgroundRemoval(originalImage);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    selectedService === 'remove_bg'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Remove.bg
                </button>
                <button
                  onClick={() => {
                    setSelectedService('cutout_pro');
                    if (originalImage) executeBackgroundRemoval(originalImage);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    selectedService === 'cutout_pro'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Cutout.pro
                </button>
              </div>
            </div>
          </div>

          {/* 2. Studio Background Colors */}
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase text-slate-500 tracking-tight flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-blue-600" />
                যে কালার দিবেন ব্যাকগ্রাউন্ড এ ওই কালার সেট হবে
              </span>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTransparent}
                  onChange={(e) => setIsTransparent(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span className="font-medium text-xs">স্বচ্ছ (PNG)</span>
              </label>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {STUDIO_BG_COLORS.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => {
                    setSelectedBgColor(bg.hex);
                    setIsTransparent(false);
                  }}
                  className={`p-2 rounded border flex flex-col items-center gap-1.5 transition ${
                    selectedBgColor === bg.hex && !isTransparent
                      ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500/30'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded-full border border-slate-300 shadow-xs"
                    style={{ backgroundColor: bg.hex }}
                  />
                  <span className="text-[10px] text-slate-700 text-center font-bold leading-tight">
                    {bg.nameBn.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>

            {/* Custom Color Input */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-600">কাস্টম কালার বেছে নিন:</span>
              <input
                type="color"
                value={selectedBgColor}
                onChange={(e) => {
                  setSelectedBgColor(e.target.value);
                  setIsTransparent(false);
                }}
                className="w-7 h-7 rounded border border-slate-200 bg-transparent cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-slate-700">{selectedBgColor.toUpperCase()}</span>
            </div>
          </div>

          {/* 3. Refinement & Magic Tools */}
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-3 text-xs shadow-xs">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <h3 className="text-[11px] font-bold uppercase text-slate-500 tracking-tight flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-600" />
                কাটআউট সংবেদনশীলতা ও কালার টিউন
              </h3>
              {originalImage && (
                <button
                  onClick={() => executeBackgroundRemoval(originalImage)}
                  disabled={isRemovingBg}
                  className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isRemovingBg ? 'animate-spin' : ''}`} />
                  পুনরায় কাটআউট
                </button>
              )}
            </div>

            {/* Tolerance */}
            <div>
              <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                <span>ব্যাকগ্রাউন্ড সেন্সিটিভিটি (Tolerance)</span>
                <span className="font-mono text-slate-800 font-bold">{tolerance}</span>
              </div>
              <input
                type="range"
                min="10"
                max="80"
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            {/* Brightness & Contrast */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>উজ্জ্বলতা (Brightness)</span>
                  <span className="font-mono text-slate-800 font-bold">{brightness}</span>
                </div>
                <input
                  type="range"
                  min="-40"
                  max="40"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>কনট্রাস্ট (Contrast)</span>
                  <span className="font-mono text-slate-800 font-bold">{contrast}</span>
                </div>
                <input
                  type="range"
                  min="-40"
                  max="40"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
            </div>

            {/* Magic Touch Up Brush */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-semibold text-[11px] flex items-center gap-1.5">
                  <Eraser className="w-3.5 h-3.5 text-amber-500" />
                  ম্যানুয়াল ব্রাশ (Touch-up Brush)
                </span>
                <span className="text-[10px] text-slate-400">ছবিতে ড্র্যাগ করে মুছুন</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBrushMode(brushMode === 'erase' ? 'none' : 'erase')}
                  className={`px-3 py-1.5 rounded border text-xs font-semibold flex items-center gap-1.5 transition ${
                    brushMode === 'erase'
                      ? 'bg-amber-50 border-amber-500 text-amber-900 ring-1 ring-amber-500/30'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Eraser className="w-3.5 h-3.5" />
                  মুছুন ব্রাশ (Erase BG)
                </button>

                {brushMode !== 'none' && (
                  <div className="flex items-center gap-2 flex-1 ml-2">
                    <span className="text-[10px] text-slate-500 font-medium">সাইজ:</span>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* AI Portrait Assist */}
            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={handleAiAnalyze}
                disabled={isProcessingAI || !originalImage}
                className="w-full py-1.5 rounded bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                {isProcessingAI ? 'AI অ্যানালাইসিস চলছে...' : 'AI স্মার্ট ব্যাকগ্রাউন্ড সাজেস্ট'}
              </button>

              {aiAdvice && (
                <div className="mt-2 p-2 rounded bg-blue-50/60 border border-blue-200 text-blue-900 text-xs font-medium">
                  {aiAdvice}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Live Canvas Preview & Studio Output */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden shadow-xs">
            <div className="bg-slate-50 border-b border-slate-200 p-3 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-600 uppercase flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  লাইভ প্রিভিউ (Live Subject Canvas)
                </span>
                {isRemovingBg && (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded animate-pulse">
                    ব্যাকগ্রাউন্ড রিমুভ হচ্ছে...
                  </span>
                )}
              </div>

              {/* Photo Preset Switcher */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500 font-semibold">মাপ:</span>
                <select
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-700"
                >
                  <option value="PASSPORT_BD">BD পাসপোর্ট (45×35 mm)</option>
                  <option value="STAMP_BD">স্ট্যাম্প সাইজ (25×20 mm)</option>
                  <option value="US_VISA">ইউএস ভিসা (50×50 mm)</option>
                  <option value="CUSTOM">ফ্রি-হ্যান্ড / অরিজিনাল</option>
                </select>
              </div>
            </div>

            {/* Canvas Viewport */}
            <div 
              className="p-6 bg-slate-900/90 flex items-center justify-center relative min-h-[420px] overflow-auto select-none"
              style={{
                backgroundImage: isTransparent
                  ? 'radial-gradient(#334155 1px, transparent 1px)'
                  : 'none',
                backgroundSize: '16px 16px',
              }}
            >
              {originalImage ? (
                <div className="relative">
                  <canvas
                    ref={displayCanvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    className={`max-w-full max-h-[420px] object-contain shadow-2xl rounded border border-white/20 ${
                      brushMode !== 'none' ? 'cursor-crosshair' : 'cursor-default'
                    }`}
                  />
                  {isRemovingBg && (
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs rounded flex flex-col items-center justify-center text-white gap-2">
                      <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs font-bold">ব্যাকগ্রাউন্ড রিমুভ ও কালার সেট হচ্ছে...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-slate-400 space-y-2">
                  <Palette className="w-10 h-10 mx-auto text-slate-500 opacity-50" />
                  <p className="text-xs font-medium">বাম পাশ থেকে কাস্টমারের ছবি দিন বা ডেমো লোড করুন</p>
                </div>
              )}

              {/* Resolution Tag */}
              <div className="absolute bottom-2 right-2 text-[10px] text-slate-300 font-mono bg-slate-800/80 px-2 py-0.5 rounded">
                300 DPI • Passport Quality
              </div>
            </div>

            {/* Quick Action Footer */}
            <div className="p-3.5 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload('jpg')}
                  disabled={!originalImage}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  ডাউনলোড JPG
                </button>

                <button
                  onClick={() => handleDownload('png')}
                  disabled={!originalImage}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  ট্রান্সপারেন্ট PNG
                </button>

                {onSendToPrintSheet && (
                  <button
                    onClick={() => {
                      const url = getProcessedDataUrl('image/jpeg');
                      if (url) onSendToPrintSheet(url, 'passport');
                    }}
                    disabled={!originalImage}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-bold transition disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    প্রিন্ট শীটে পাঠান
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowPrintModal(true)}
                disabled={!originalImage}
                className="inline-flex items-center gap-2 px-5 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                অটো প্রিন্ট প্রিভিউ (4R Sheet)
              </button>
            </div>
          </div>

          {/* Helper Tips */}
          {apiSourceInfo && (
            <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{apiSourceInfo}</span>
            </div>
          )}
        </div>
      </div>

      {/* Manual Cropper Modal */}
      {isCropping && originalImage && (
        <InteractiveCropperModal
          isOpen={isCropping}
          onClose={() => setIsCropping(false)}
          imageSrc={originalImage}
          title="পাসপোর্ট ফটো ম্যানুয়াল ক্রপ (Passport Framing)"
          aspectRatioOptions={[
            { id: 'passport', label: 'BD পাসপোর্ট (৪৫ × ৩৫ mm)', ratio: 35 / 45 },
            { id: 'stamp', label: 'স্ট্যাম্প সাইজ (২৫ × ২০ mm)', ratio: 20 / 25 },
            { id: 'square', label: '১:১ ভিসা (৫০ × ৫০ mm)', ratio: 1 },
            { id: 'free', label: 'ফ্রি-হ্যান্ড / কাস্টম', ratio: null },
          ]}
          onCropComplete={(croppedUrl) => {
            setOriginalImage(croppedUrl);
            setCutoutImage(null); // Re-trigger background removal for newly cropped framing
          }}
        />
      )}

      {/* Print Preview Modal */}
      <PrintPreviewModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="পাসপোর্ট ফটো ৪R প্রিন্ট প্রিভিউ"
        renderCanvasContent={renderPrintPage}
        paperSize="4R"
        orientation="portrait"
      />
    </div>
  );
};
