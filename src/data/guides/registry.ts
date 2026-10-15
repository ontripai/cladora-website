import { Language } from '@/types';
import { GuideArticleData, GuideClusterId } from './types';
import { CLUSTER_PLATFORM_ARTICLES } from './cluster-platform';
import { CLUSTER_A_ARTICLES } from './cluster-a-associations';
import { CLUSTER_B_ARTICLES } from './cluster-b-operations';
import { CLUSTER_C_ARTICLES } from './cluster-c-property-managers';

export const GUIDE_ARTICLES: Record<string, GuideArticleData> = {
  ...CLUSTER_PLATFORM_ARTICLES,
  ...CLUSTER_A_ARTICLES,
  ...CLUSTER_B_ARTICLES,
  ...CLUSTER_C_ARTICLES,
};

export function getGuideArticle(slug: string, lang?: Language): GuideArticleData | undefined {
  const article = GUIDE_ARTICLES[slug];
  if (!article) {
    return undefined;
  }
  if (lang && article.lang !== lang) {
    return undefined;
  }
  return article;
}

export function getAllGuideArticles(): GuideArticleData[] {
  return Object.values(GUIDE_ARTICLES);
}

export function getGuideArticlesForLang(lang: Language): GuideArticleData[] {
  return Object.values(GUIDE_ARTICLES).filter((a) => a.lang === lang);
}

export function getGuideArticlesByCluster(clusterId: GuideClusterId, lang?: Language): GuideArticleData[] {
  return Object.values(GUIDE_ARTICLES).filter((a) => {
    if (a.clusterId !== clusterId) return false;
    if (lang && a.lang !== lang) return false;
    return true;
  });
}
