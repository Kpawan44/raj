import React, { useState } from 'react';
import { JobCard, MaterialMovement } from '../types';
import { Brain, Sparkles, Loader2, RotateCcw } from 'lucide-react';

interface ForecastViewProps {
  jobCards: JobCard[];
  movements: MaterialMovement[];
}

export default function ForecastView({ jobCards, movements }: ForecastViewProps) {
  const [forecast, setForecast] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleForecast = async () => {
    setLoading(true);
    setForecast([]);
    try {
      const response = await fetch('/api/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          jobCards, 
          movements: movements.slice(-50) // Send recent movements to keep prompt size reasonable
        })
      });
      const data = await response.json();
      setForecast(data);
    } catch (err) {
      console.error(err);
      alert('Forecast generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForecast([]);
  };

  return (
    <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
               <Brain className="h-6 w-6 text-purple-500" />
               AI Production Forecast
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Analyze historical patterns to estimate job completion dates.</p>
        </div>
        <div className="flex items-center gap-2">
          {forecast.length > 0 && !loading && (
            <button 
              onClick={handleReset}
              className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-lg cursor-pointer flex items-center gap-2 transition-all text-sm"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          )}
          <button 
            onClick={handleForecast}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm py-2.5 px-5 rounded-lg cursor-pointer flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </div>
      </div>
      
      {forecast.length > 0 ? (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {forecast.map((f: any) => (
             <div key={f.jobCardNo} className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-xl border border-purple-100 dark:border-purple-900/30 flex flex-col justify-between">
                <div>
                   <div className="text-purple-800 dark:text-purple-300 font-bold text-sm mb-2">{f.jobCardNo}</div>
                   <div className="text-xs text-slate-500 dark:text-slate-400">Estimated Completion:</div>
                   <div className="text-base font-bold text-slate-900 dark:text-slate-200 mt-1 mb-3">{f.estimatedCompletionDate}</div>
                </div>
                {f.reasoning && (
                  <div className="mt-2 pt-2 border-t border-purple-100/50 dark:border-purple-950/50 text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic bg-white/50 dark:bg-slate-900/30 p-2 rounded-lg">
                    {f.reasoning}
                  </div>
                )}
             </div>
           ))}
         </div>
      ) : !loading && (
          <div className="text-center py-12 text-slate-500 text-sm italic">
            Click 'Run Analysis' to see AI-powered production timelines.
          </div>
      )}
    </div>
  );
}
