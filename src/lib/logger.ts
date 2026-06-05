type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function minLevel(): Level {
  const env = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  return (Object.keys(ORDER).includes(env) ? env : 'info') as Level;
}

const ICONS: Record<Level, string> = {
  debug: '🔍',
  info: '✅',
  warn: '⚠️',
  error: '❌',
};

function emit(level: Level, msg: string): void {
  if (ORDER[level] < ORDER[minLevel()]) return;
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const line = `${ts} ${ICONS[level]} [${level.toUpperCase()}] ${msg}`;
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (msg: string) => emit('debug', msg),
  info: (msg: string) => emit('info', msg),
  warn: (msg: string) => emit('warn', msg),
  error: (msg: string) => emit('error', msg),
};
