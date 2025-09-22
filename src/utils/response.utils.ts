// Standard API Response Format
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  message?: string;
  timestamp: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// Success Response Helper
export const successResponse = <T = any>(
  data: T, 
  message?: string,
  meta?: any
): ApiResponse<T> => {
  return {
    success: true,
    data,
    message: message || 'Operation successful',
    timestamp: new Date().toISOString(),
    meta,
  };
};

// Error Response Helper
export const errorResponse = (
  code: string,
  message: string,
  details?: any
): ApiResponse<null> => {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
  };
};

// Pagination Helper
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export const paginate = async <T = any>(
  model: any,
  params: PaginationParams,
  where?: any,
  include?: any,
  orderBy?: any
): Promise<PaginatedResponse<T>> => {
  const { page, limit } = params;
  const skip = (page - 1) * limit;
  
  // Get total count
  const total = await model.count({ where });
  
  // Get items
  const items = await model.findMany({
    where,
    include,
    orderBy,
    skip,
    take: limit,
  });
  
  const totalPages = Math.ceil(total / limit);
  
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
};