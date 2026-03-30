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
          className="w-full pl-12 pr-32 py-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-900 disabled:opacity-50 text-base"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="absolute inset-y-1 right-1 px-5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium text-sm transition-colors"
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
