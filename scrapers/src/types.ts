export interface ScrapedItem {
  source: 'homedepot' | 'lowes' | 'menards' | 'grainger';
  source_sku: string;
  name: string;
  category: string;
  subcategory?: string;
  price: number;
  unit: string;
  url: string;
  scraped_at: string;
}

export interface CategoryConfig {
  name: string;
  url: string;
  blitzCategory: 'materials' | 'equipment' | 'fees';
}
