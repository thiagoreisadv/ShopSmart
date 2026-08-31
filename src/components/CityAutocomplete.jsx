import { useEffect, useState } from 'react';
import { LocateFixed, Loader2 } from 'lucide-react';

// Busca de cidade/endereço via Nominatim (OpenStreetMap) — serviço público e
// gratuito, sem conta nem chave de API. Debounce de 700ms para respeitar o
// limite de uso deles (no máx. ~1 requisição por segundo).
export default function CityAutocomplete({ label, placeholder, onPlaceSelected, allowCurrentLocation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (selected || query.trim().length < 3) return;
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`)
        .then(res => res.json())
        .then(data => setResults(Array.isArray(data) ? data : []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 700);
    return () => clearTimeout(timer);
  }, [query, selected]);

  const handleSelect = (item) => {
    const place = { label: item.display_name, lat: parseFloat(item.lat), lon: parseFloat(item.lon) };
    setSelected(place);
    setQuery(item.display_name);
    setResults([]);
    onPlaceSelected(place);
  };

  const handleQueryChange = (value) => {
    setQuery(value);
    if (selected) { setSelected(null); onPlaceSelected(null); }
    if (value.trim().length < 3) setResults([]);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let label = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const data = await res.json();
          if (data?.display_name) label = data.display_name;
        } catch {
          // sem descrição legível, mantém as coordenadas como label
        }
        const place = { label, lat: latitude, lon: longitude };
        setSelected(place);
        setQuery(label);
        setResults([]);
        setLocating(false);
        onPlaceSelected(place);
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  };

  return (
    <div className="relative space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black text-indigo-200 uppercase ml-1">{label}</label>
        {allowCurrentLocation && (
          <button
            type="button"
            onClick={useCurrentLocation}
            className="text-[10px] font-bold text-indigo-200 hover:text-white flex items-center gap-1 mr-1 transition-colors"
          >
            {locating ? <Loader2 className="w-3 h-3 animate-spin" /> : <LocateFixed className="w-3 h-3" />} Local atual
          </button>
        )}
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 font-bold text-white placeholder:text-indigo-300 outline-none focus:bg-white/20 transition-all"
      />
      {(results.length > 0 || loading) && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden max-h-56 overflow-y-auto">
          {loading && <div className="px-4 py-2.5 text-xs font-bold text-slate-400">Buscando...</div>}
          {results.map((item) => (
            <button
              key={item.place_id}
              type="button"
              onClick={() => handleSelect(item)}
              className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-colors border-b border-slate-50 dark:border-slate-700 last:border-0"
            >
              {item.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
