import { useState } from 'react';
import { Link2, Loader2 } from 'lucide-react';

interface URLInputProps {
  onFetch: (url: string) => void;
  loading: boolean;
}

export default function URLInput({ onFetch, loading }: URLInputProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onFetch(url.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Link2 className="w-5 h-5 text-gray-400" />
        </div>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste any article URL to start reading..."
          disabled={loading}
          className="w-full pl-12 pr-32 py-4 rounded-2xl border-2 border-transparent bg-white dark:bg-gray-800 shadow-sm hover:shadow-md text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white dark:focus:bg-gray-800 disabled:opacity-50 text-base transition-all duration-300"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="absolute inset-y-1 right-1 px-5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center gap-2 font-medium text-sm transition-all duration-300"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading...</span>
            </>
          ) : (
            <span>Read</span>
          )}
        </button>
      </div>
    </form>
  );
}
