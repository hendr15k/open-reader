import { useState, useEffect } from 'react';
import { Article } from '../lib/types';
import { getAllArticles, saveArticle, deleteArticle, isArticleSaved } from '../lib/storage';

export function useArticleStorage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    setLoading(true);
    try {
      const saved = await getAllArticles();
      setArticles(saved.sort((a, b) => b.savedAt - a.savedAt));
    } catch (error) {
      console.error('Error loading articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const addArticle = async (article: Article) => {
    try {
      await saveArticle(article);
      await loadArticles();
    } catch (error) {
      console.error('Error saving article:', error);
      throw error;
    }
  };

  const removeArticle = async (id: string) => {
    try {
      await deleteArticle(id);
      await loadArticles();
    } catch (error) {
      console.error('Error deleting article:', error);
      throw error;
    }
  };

  const checkSaved = async (url: string): Promise<boolean> => {
    try {
      return await isArticleSaved(url);
    } catch (error) {
      console.error('Error checking if article saved:', error);
      return false;
    }
  };

  return {
    articles,
    loading,
    addArticle,
    removeArticle,
    checkSaved,
    reload: loadArticles,
  };
}