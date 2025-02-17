export interface CategoryProgress {
  categoria: string;
  total_respondidas: number;
  total_corretas: number;
  percentual_acerto: string;
}
  
export type TimeRange = 'day' | 'week' | 'month' | 'year' | 'custom';

export interface StatsFilters {
  range: TimeRange;
  startDate?: Date;
  endDate?: Date;
}

  export type TimeProgress = {
    data: string;
    percentual: number;
  };
  