import { Prisma } from '@prisma/client';

/**
 * Soft Delete Middleware for Prisma
 * 
 * This middleware intercepts delete operations and converts them to soft deletes
 * by setting the deletedAt field instead of actually deleting the record.
 * 
 * It also automatically filters out soft-deleted records from queries.
 */

// Models that support soft delete (have deletedAt field)
const SOFT_DELETE_MODELS = [
  'DevIntegration',
  'DevApiKey',
  'DevWebhook',
  'DevPaymentGateway',
  'DevPaymentTransaction',
  'DevMessageProvider',
  'DevIotDevice',
  'DevAiModel',
];

/**
 * Middleware to convert delete to soft delete
 */
export function softDeleteMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    // Check if this model supports soft delete
    if (!SOFT_DELETE_MODELS.includes(params.model || '')) {
      return next(params);
    }

    // Handle delete operations
    if (params.action === 'delete') {
      // Change action to update
      params.action = 'update';
      params.args['data'] = { deletedAt: new Date() };
    }

    if (params.action === 'deleteMany') {
      // Change action to updateMany
      params.action = 'updateMany';
      if (params.args.data !== undefined) {
        params.args.data['deletedAt'] = new Date();
      } else {
        params.args['data'] = { deletedAt: new Date() };
      }
    }

    return next(params);
  };
}

/**
 * Middleware to filter out soft-deleted records from queries
 */
export function softDeleteFilterMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    // Check if this model supports soft delete
    if (!SOFT_DELETE_MODELS.includes(params.model || '')) {
      return next(params);
    }

    // Handle find operations
    if (params.action === 'findUnique' || params.action === 'findFirst') {
      // Change to findFirst to allow adding where clause
      params.action = 'findFirst';
      // Add deletedAt filter
      params.args.where = {
        ...params.args.where,
        deletedAt: null,
      };
    }

    if (params.action === 'findMany') {
      // Add deletedAt filter if not explicitly querying deleted records
      if (params.args.where) {
        if (params.args.where.deletedAt === undefined) {
          params.args.where.deletedAt = null;
        }
      } else {
        params.args['where'] = { deletedAt: null };
      }
    }

    if (params.action === 'count') {
      // Add deletedAt filter
      if (params.args.where) {
        if (params.args.where.deletedAt === undefined) {
          params.args.where.deletedAt = null;
        }
      } else {
        params.args['where'] = { deletedAt: null };
      }
    }

    if (params.action === 'update') {
      // Ensure we're not updating a deleted record
      params.args.where = {
        ...params.args.where,
        deletedAt: null,
      };
    }

    if (params.action === 'updateMany') {
      // Add deletedAt filter
      if (params.args.where !== undefined) {
        params.args.where.deletedAt = null;
      } else {
        params.args['where'] = { deletedAt: null };
      }
    }

    return next(params);
  };
}

/**
 * Helper function to include deleted records in a query
 * Use this when you need to query soft-deleted records
 * 
 * @example
 * const allRecords = await prisma.devIntegration.findMany({
 *   where: includeDeleted({ status: 'active' }),
 * });
 */
export function includeDeleted<T extends object>(where: T): T & { deletedAt?: any } {
  return {
    ...where,
    deletedAt: undefined, // This will bypass the filter
  };
}

/**
 * Helper function to query only deleted records
 * 
 * @example
 * const deletedRecords = await prisma.devIntegration.findMany({
 *   where: onlyDeleted({ status: 'active' }),
 * });
 */
export function onlyDeleted<T extends object>(where: T): T & { deletedAt: { not: null } } {
  return {
    ...where,
    deletedAt: { not: null },
  };
}
