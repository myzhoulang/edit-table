export * from './types';
export { createModel } from './model/model';
export { TableConfigError, CalculationError } from './model/config';
export { RowMetrics } from './view/metrics';
export { parseTSV, stringifyTSV } from './utils/clipboard';
export { createTable } from './dom/table';
import './styles/style.css';
