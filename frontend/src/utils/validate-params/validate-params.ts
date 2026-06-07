import { z } from "zod";

import {
  PAGE_SIZES,
  SORT_ORDER,
  type SortOrder,
} from "../../constants/filters";
import { OBJECT_ID_REGEX } from "../../constants/validation";
import { isArray, isNumber } from "../is/is";

const MIN_PAGE = 1;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = PAGE_SIZES[0] ?? 10;

/**
 * Schema for validating page parameter
 * - Coerces string to number
 * - Must be a positive integer >= 1
 * - Defaults to 1 if invalid
 */
export const PageSchema = z.coerce
  .number()
  .int()
  .min(MIN_PAGE)
  .catch(DEFAULT_PAGE);

/**
 * Schema for validating limit parameter
 * - Coerces string to number
 * - Must be one of the allowed PAGE_SIZES: [10, 20, 50, 100]
 * - Defaults to 10 if invalid
 */
export const LimitSchema = z.coerce
  .number()
  .int()
  .refine((val) => PAGE_SIZES.includes(val as (typeof PAGE_SIZES)[number]), {
    message: `Limit must be one of: ${PAGE_SIZES.join(", ")}`,
  })
  .catch(DEFAULT_LIMIT);

/**
 * Schema for validating sort order parameter
 * - Must be "asc" or "desc"
 * - Defaults to "asc" if invalid
 */
export const SortOrderSchema = z
  .enum([SORT_ORDER.ASC, SORT_ORDER.DESC])
  .catch(SORT_ORDER.ASC);

/**
 * Schema for validating comma-separated MongoDB ObjectId arrays.
 *
 * - Accepts a comma-separated string (URL-facing shape).
 * - Trims whitespace around each id and drops empty entries.
 * - Validates that every remaining id matches {@link OBJECT_ID_REGEX}.
 * - Returns `string[]` when at least one valid id is present.
 * - Returns `undefined` when the resulting list is empty.
 * - Fails validation if any id is not a valid MongoDB ObjectId — pair with
 *   `.optional().catch(undefined)` at the call site to self-heal tampered URLs.
 */
export const ObjectIdsArraySchema = z
  .union([z.string().max(8000), z.array(z.string()).max(500)])
  .transform((val) =>
    (Array.isArray(val) ? val : val.split(","))
      .map((id) => id.trim())
      .filter(Boolean)
  )
  .refine((ids) => ids.every((id) => OBJECT_ID_REGEX.test(id)), {
    message: "Each id must be a valid MongoDB ObjectId",
  })
  .transform((ids) => (ids.length > 0 ? ids : undefined));

/**
 * Schema for validating an ISO 8601 datetime string (UTC `Z` form).
 * - Matches the output of `formatDateISO` (`Date.prototype.toISOString()`)
 * - Rejects any other format as URL tampering
 * - Pair with `.optional().catch(undefined)` at the call site for URL params
 */
export const IsoDateStringSchema = z.string().max(40).datetime();

/**
 * Schema for validating a `YYYY-MM` month string (e.g. `"2026-04"`).
 */
export const MonthSchema = z
  .string()
  .max(7)
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/);

/**
 * Schema for a URL-facing comma-separated list of 1-based page indexes
 * (e.g. `"1,3,5"`). Accepts either the URL string form or a pre-parsed
 * array of numbers/strings.
 */
export const SelectedPagesArraySchema = z
  .union([
    z.string().max(8000),
    z.array(z.union([z.string(), z.number()])).max(500),
  ])
  .transform((val) =>
    (Array.isArray(val) ? val : val.split(","))
      .map((entry) => (typeof entry === "number" ? entry : entry.trim()))
      .map(Number)
      .filter((n) => Number.isFinite(n) && Number.isInteger(n) && n >= 1)
  )
  .transform((arr) => (arr.length > 0 ? arr : undefined));

/**
 * Schema for a URL-facing `select_all` flag that is only meaningful when
 * truthy.
 */
export const SelectAllSchema = z
  .union([z.literal("true"), z.boolean()])
  .transform((v) =>
    v === true || v === "true" ? ("true" as const) : undefined
  );

/**
 * Creates a sort-by schema that validates against allowed values
 * @param allowedValues - Array of allowed sort field names
 * @param defaultValue - Default sort field if invalid
 */
export function createSortBySchema<T extends readonly string[]>(
  allowedValues: T,
  defaultValue: T[number]
) {
  return z
    .string()
    .refine((val): val is T[number] => allowedValues.includes(val as T[number]))
    .catch(defaultValue);
}

/**
 * Options for creating a pagination schema
 */
export interface PaginationSchemaOptions<T extends readonly string[]> {
  allowedSortBy: T;
  defaultSortBy: T[number];
  defaultSortOrder?: SortOrder;
  customLimit?: number;
  customPageSizes?: number[];
}

/**
 * Create a custom schema for validating limit but allow custom limit
 * @internal Exported for test coverage only — prefer `createPaginationConfig` for public use.
 */
export const createCustomLimitSchema = (
  customLimit: number,
  customPageSizes: number[]
) => {
  const hasCustomPageSizes =
    isArray(customPageSizes) && customPageSizes.length > 0;

  const _customPageSizes: number[] = hasCustomPageSizes
    ? customPageSizes
    : [...PAGE_SIZES];

  const _customLimit: number =
    isNumber(customLimit) && _customPageSizes.includes(customLimit)
      ? customLimit
      : _customPageSizes[0]!;

  return z.coerce
    .number()
    .int()
    .min(1)
    .refine(
      (val) =>
        _customPageSizes.includes(val as (typeof _customPageSizes)[number]),
      {
        message: `Limit must be one of: ${_customPageSizes.join(", ")}`,
      }
    )
    .catch(_customLimit);
};
/**
 * Creates a complete pagination schema with entity-specific sort options
 * @param options - Pagination schema options
 *
 */
export const createPaginationSchema = <T extends readonly string[]>(
  options: PaginationSchemaOptions<T>
) => {
  if (!options || !options.allowedSortBy || !options.defaultSortBy) {
    throw new Error("allowedSortBy and defaultSortBy are required");
  }

  const {
    allowedSortBy,
    defaultSortBy,
    defaultSortOrder = SORT_ORDER.ASC,
    customLimit,
    customPageSizes = [],
  } = options;

  return z.object({
    page: PageSchema,
    limit:
      customLimit && customPageSizes.length
        ? createCustomLimitSchema(customLimit, customPageSizes)
        : LimitSchema,
    sortBy: createSortBySchema(allowedSortBy, defaultSortBy),
    sortOrder: z
      .enum([SORT_ORDER.ASC, SORT_ORDER.DESC])
      .catch(defaultSortOrder)
      .default(defaultSortOrder),
  });
};

/**
 * Creates a complete pagination schema with entity-specific sort options and optional search
 * @param options - Pagination schema options
 */
export const createPaginationSchemaWithSearch = <T extends readonly string[]>(
  options: PaginationSchemaOptions<T>
) => {
  return createPaginationSchema(options).extend({
    search: z.string().max(300).catch(""),
  });
};

/**
 * Result type for pagination config factories
 */
export interface PaginationConfig<TSchema extends z.ZodTypeAny> {
  schema: TSchema;
  pageSizes: number[];
  defaults: z.infer<TSchema>;
}

/**
 * Internal helper that contains the shared config logic for both
 * `createPaginationConfig` and `createPaginationConfigWithSearch`.
 */
const _createPaginationConfigInternal = <
  TSchema extends z.ZodTypeAny,
  TSort extends readonly string[],
>(
  options: PaginationSchemaOptions<TSort>,
  schemaFactory: (opts: PaginationSchemaOptions<TSort>) => TSchema
) => {
  const pageSizes =
    options.customPageSizes && options.customPageSizes.length > 0
      ? [...options.customPageSizes]
      : [...PAGE_SIZES];

  if (
    options.customLimit !== undefined &&
    !pageSizes.includes(options.customLimit)
  ) {
    throw new Error(
      `customLimit (${options.customLimit}) must be one of pageSizes: [${pageSizes.join(", ")}]`
    );
  }

  const schema = schemaFactory({
    ...options,
    customLimit: options.customLimit ?? pageSizes[0],
    customPageSizes: pageSizes,
  });

  const defaults = schema.parse({}) as z.infer<TSchema>;
  return { schema, pageSizes, defaults } as PaginationConfig<TSchema>;
};

/**
 * Creates a unified pagination config that returns schema, page sizes, and defaults
 *
 * @param options - Pagination schema options
 */
export const createPaginationConfig = <T extends readonly string[]>(
  options: PaginationSchemaOptions<T>
) => _createPaginationConfigInternal(options, createPaginationSchema);

/**
 * Creates a unified pagination config with search support.
 *
 * @param options - Pagination schema options
 */
export const createPaginationConfigWithSearch = <T extends readonly string[]>(
  options: PaginationSchemaOptions<T>
) => _createPaginationConfigInternal(options, createPaginationSchemaWithSearch);
