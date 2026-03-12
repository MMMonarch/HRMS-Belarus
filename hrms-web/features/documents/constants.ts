/**
 * template_type numbers from the templates table.
 * Used to filter templates by their purpose.
 */
export const TEMPLATE_TYPE = {
  ORDER_HEADER: 1,
  ORDER_ITEM: 2,
  CONTRACT: 4,
  ORDER_VISA: 5,
} as const;

/**
 * item_type_number for order_items (matches order_item_types.number in DB).
 * Prefer these constants over raw numbers.
 */
export const ORDER_ITEM_TYPE_NUMBER = {
  HIRE: 1,
  TRANSFER: 2,
  LEAVE: 3,
  OTHER: 4,
  TERMINATION: 5,
} as const;
