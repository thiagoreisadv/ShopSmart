import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import { ScanBarcode, X } from 'lucide-react';

// --- MODAL: LEITOR DE CÓDIGO DE BARRAS ---
// Lê o código pela câmera (funciona em qualquer navegador, incluindo Safari/iPhone,
// pois decodifica em JS puro em vez de depender da BarcodeDetector nativa) e busca
// o nome do produto na Open Food Facts, uma base pública e gratuita.
export default function BarcodeScannerModal({ onClose, onDetected }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [status, setStatus] = useState('starting'); // starting | scanning | looking-up | not-found | error
  const [errorMessage, setErrorMessage] = useState('');
  const [scannedCode, setScannedCode] = useState('');

  useEffect(() => {
    let cancelled = false;
    const codeReader = new BrowserMultiFormatReader();

    const lookupProduct = async (code) => {
      setStatus('looking-up');
      setScannedCode(code);
      try {
        const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
        const data = await res.json();
        const name = data?.product?.product_name_pt || data?.product?.product_name || data?.product?.generic_name;
        if (cancelled) return;
        if (name) {
          onDetected(name);
        } else {
          setStatus('not-found');
        }
      } catch {
        if (!cancelled) setStatus('not-found');
      }
    };

    codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
      if (cancelled) return;
      if (result) {
        controlsRef.current?.stop();
        lookupProduct(result.getText());
      } else if (err && !(err instanceof NotFoundException)) {
        setStatus('error');
        setErrorMessage('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
      }
    }).then(controls => {
      if (cancelled) { controls.stop(); return; }
      controlsRef.current = controls;
      setStatus('scanning');
    }).catch(() => {
      if (!cancelled) {
        setStatus('error');
        setErrorMessage('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
      }
    });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-5 animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 w-full max-w-sm shadow-2xl space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <ScanBarcode className="w-5 h-5 text-indigo-500" /> Escanear Produto
          </h3>
          <button onClick={onClose} className="text-slate-300 dark:text-slate-600 hover:text-slate-500 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="relative bg-slate-900 rounded-3xl overflow-hidden aspect-square flex items-center justify-center">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          {status === 'scanning' && (
            <div className="absolute inset-8 border-2 border-emerald-400/70 rounded-2xl pointer-events-none" />
          )}
          {(status === 'starting' || status === 'looking-up') && (
            <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center">
              <span className="text-white text-xs font-bold uppercase tracking-widest">
                {status === 'starting' ? 'Abrindo câmera...' : 'Buscando produto...'}
              </span>
            </div>
          )}
        </div>

        {status === 'error' && (
          <p className="text-sm text-rose-500 font-medium text-center">{errorMessage}</p>
        )}

        {status === 'not-found' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium text-center">
              Código {scannedCode} lido, mas o produto não foi encontrado na base pública.
            </p>
            <button
              onClick={() => onDetected(scannedCode)}
              className="w-full bg-indigo-600 text-white font-bold py-3 rounded-2xl hover:bg-indigo-700 active:scale-95 transition-all"
            >
              Usar código como nome
            </button>
          </div>
        )}

        {status === 'scanning' && (
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium text-center">Aponte a câmera para o código de barras do produto.</p>
        )}
      </div>
    </div>
  );
}
