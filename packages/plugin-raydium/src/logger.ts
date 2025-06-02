// Simple logger for Raydium plugin
export const elizaLogger = {
  info: (...args: any[]) => console.log('[Raydium]', ...args),
  error: (...args: any[]) => console.error('[Raydium Error]', ...args),
  warn: (...args: any[]) => console.warn('[Raydium Warning]', ...args),
  debug: (...args: any[]) => console.log('[Raydium Debug]', ...args)
};