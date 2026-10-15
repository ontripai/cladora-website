import { Language } from '@/types';

export interface GuideArticleSection {
  id: string;
  title: string;
  content: string[];
  subsections?: Array<{
    title: string;
    content: string[];
  }>;
}

export interface GuideArticleFaq {
  q: string;
  a: string;
}

export interface GuideArticleTable {
  caption: string;
  headers: string[];
  rows: string[][];
}

export interface GuideLegalSource {
  title: string;
  reference: string;
  accessDate: string;
  url?: string;
}

export type GuideClusterId =
  | 'cluster-a-associations'
  | 'cluster-b-operations'
  | 'cluster-c-property-managers'
  | 'cluster-platform';

export interface GuideArticleData {
  id: string;
  lang: Language;
  slug: string;
  title: string;
  seoTitle: string;
  description: string;
  category: string;
  clusterId: GuideClusterId;
  primaryQuery: string;
  supportingQueries: string[];
  searchIntent: 'informational' | 'commercial' | 'investigative';
  publicationDate: string;
  datePublished?: string;
  dateModified: string;
  author: string;
  authorName: string;
  authorUrl: string;
  reviewedBy: string;
  schemaType: 'TechArticle' | 'Article';
  readTime: string;
  directAnswer: string;
  disclaimer?: string;
  pillarHref: string;
  sections: GuideArticleSection[];
  table?: GuideArticleTable;
  faqs: GuideArticleFaq[];
  legalSources?: GuideLegalSource[];
  bridge: {
    title: string;
    description: string;
    buttonText: string;
    href: string;
  };
  relatedGuides: Array<{
    title: string;
    slug: string;
    lang: Language;
  }>;
}
