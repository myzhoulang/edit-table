/** 所有异步结果以会话代次校验，外部换数或销毁使旧结果失效。 */
export function createEpoch(): {
  current: () => number;
  bump: () => number;
  valid: (epoch: number) => boolean;
} {
  let value = 0;
  return { current: () => value, bump: () => ++value, valid: (epoch: number) => epoch === value };
}
