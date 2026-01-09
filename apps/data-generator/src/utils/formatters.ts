const formatters = {
  timeElapsed: (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }

    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }

    return `${seconds}s (${ms}ms)`;
  },

  fileSize: (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  },

  number: (num: number, locale = 'en-US'): string => {
    return num.toLocaleString(locale);
  },

  percentage: (value: number, total: number): string => {
    const percent = (value / total) * 100;
    return `${percent.toFixed(1)}%`;
  },

  truncate: (str: string, maxLength = 50): string => {
    if (str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength - 3) + '...';
  }
};

export default formatters;