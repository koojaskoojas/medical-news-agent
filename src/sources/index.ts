import { BaseSource } from './base';
import { WHOSource } from './who';
import { CDCSource } from './cdc';
import { NIHSource } from './nih';
import { PubMedSource } from './pubmed';
import { MedicalXpressSource } from './medicalxpress';
import { GoogleNewsSource } from './google-news';
import { ReutersSource } from './reuters';
import { KDCASource } from './kdca';

export const ALL_SOURCES: BaseSource[] = [
  new WHOSource(),
  new CDCSource(),
  new NIHSource(),
  new PubMedSource(),
  new MedicalXpressSource(),
  new GoogleNewsSource(),
  new ReutersSource(),
  new KDCASource(),
];

export type { RawArticle } from './base';
