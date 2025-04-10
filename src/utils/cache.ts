// cache.ts - 缓存管理工具

export interface CacheOptions {
  /** 缓存过期时间（毫秒） */
  ttl?: number;
  /** 缓存键前缀 */
  prefix?: string;
  /** 是否使用本地存储而不是内存 */
  useLocalStorage?: boolean;
}

export interface CacheItem<T> {
  data: T;
  expiry: number;
}

/**
 * 缓存管理类
 * 提供基于内存或localStorage的数据缓存功能
 */
export class CacheManager {
  private static memoryCache: Map<string, CacheItem<any>> = new Map();
  private static defaultPrefix = 'http_cache:';
  private static defaultTTL = 5 * 60 * 1000; // 默认5分钟

  /**
   * 设置缓存
   * @param key 缓存键
   * @param value 要缓存的数据
   * @param options 缓存选项
   */
  static set<T>(key: string, value: T, options: CacheOptions = {}): void {
    const {
      ttl = this.defaultTTL,
      prefix = this.defaultPrefix,
      useLocalStorage = false
    } = options;

    const expiry = Date.now() + ttl;
    const prefixedKey = `${prefix}${key}`;
    const cacheItem: CacheItem<T> = { data: value, expiry };

    if (useLocalStorage) {
      try {
        localStorage.setItem(prefixedKey, JSON.stringify(cacheItem));
      } catch (error) {
        console.error('缓存到localStorage失败:', error);
      }
    } else {
      this.memoryCache.set(prefixedKey, cacheItem);
    }
  }

  /**
   * 获取缓存
   * @param key 缓存键
   * @param options 缓存选项
   * @returns 缓存的数据或undefined（如果缓存不存在或已过期）
   */
  static get<T>(key: string, options: CacheOptions = {}): T | undefined {
    const {
      prefix = this.defaultPrefix,
      useLocalStorage = false
    } = options;

    const prefixedKey = `${prefix}${key}`;
    let cacheItem: CacheItem<T> | undefined;

    if (useLocalStorage) {
      try {
        const cachedData = localStorage.getItem(prefixedKey);
        if (cachedData) {
          cacheItem = JSON.parse(cachedData);
        }
      } catch (error) {
        console.error('从localStorage获取缓存失败:', error);
        return undefined;
      }
    } else {
      cacheItem = this.memoryCache.get(prefixedKey) as CacheItem<T>;
    }

    if (!cacheItem) {
      return undefined;
    }

    // 检查缓存是否过期
    if (cacheItem.expiry < Date.now()) {
      this.remove(key, options);
      return undefined;
    }

    return cacheItem.data;
  }

  /**
   * 移除缓存
   * @param key 缓存键
   * @param options 缓存选项
   */
  static remove(key: string, options: CacheOptions = {}): void {
    const {
      prefix = this.defaultPrefix,
      useLocalStorage = false
    } = options;

    const prefixedKey = `${prefix}${key}`;

    if (useLocalStorage) {
      try {
        localStorage.removeItem(prefixedKey);
      } catch (error) {
        console.error('从localStorage删除缓存失败:', error);
      }
    } else {
      this.memoryCache.delete(prefixedKey);
    }
  }

  /**
   * 清除所有缓存
   * @param options 缓存选项
   */
  static clear(options: CacheOptions = {}): void {
    const {
      prefix = this.defaultPrefix,
      useLocalStorage = false
    } = options;

    if (useLocalStorage) {
      try {
        // 仅清除匹配前缀的缓存项
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(prefix)) {
            localStorage.removeItem(key);
          }
        });
      } catch (error) {
        console.error('清除localStorage缓存失败:', error);
      }
    } else {
      // 仅清除匹配前缀的内存缓存
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(prefix)) {
          this.memoryCache.delete(key);
        }
      }
    }
  }

  /**
   * 获取缓存键
   * @param url 请求URL
   * @param params 请求参数
   * @returns 缓存键
   */
  static getCacheKey(url: string, params?: Record<string, any>): string {
    if (!params || Object.keys(params).length === 0) {
      return url;
    }
    
    // 对参数进行排序，确保相同的参数生成相同的键
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result: Record<string, any>, key) => {
        result[key] = params[key];
        return result;
      }, {});
    
    return `${url}:${JSON.stringify(sortedParams)}`;
  }
}

export default CacheManager; 