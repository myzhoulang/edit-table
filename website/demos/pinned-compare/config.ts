import { createQuotationConfig, createLargeRows } from '../../../examples/quotation/config';
export function createConfig(): ReturnType<typeof createQuotationConfig> {
  const config = createQuotationConfig();
  config.rowPinning = { maxRows: 3 };
  return config;
}
export const createRows = (): ReturnType<typeof createLargeRows> => createLargeRows(60);
