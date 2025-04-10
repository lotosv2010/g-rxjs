// request.ts
import { fromFetch } from 'rxjs/fetch';
import { 
  throwError, 
  catchError, 
  Observable, 
  timer, 
  timeout, 
  retry, 
  finalize,
  Subject,
  takeUntil,
  switchMap,
  of,
  share,
  tap,
  from
} from 'rxjs';
import { CookieManager } from './cookie';
import { CacheManager, CacheOptions } from './cache';
import { NetworkManager } from './network';
import { SecurityManager } from './security';
import { MiddlewareManager } from './middleware';

// 扩展的请求配置，不直接扩展RequestInit
export interface RequestConfig {
  // 基础RequestInit属性
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  mode?: RequestMode;
  credentials?: RequestCredentials;
  signal?: AbortSignal;
  referrer?: string;
  referrerPolicy?: ReferrerPolicy;
  window?: null;

  // 自定义属性
  timeout?: number; // 超时时间（毫秒）
  retry?: number; // 重试次数
  retryDelay?: number; // 重试延迟时间（毫秒）
  baseURL?: string; // 基础URL
  params?: Record<string, string | number | boolean>; // URL参数
  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer'; // 响应类型
  cancelToken?: CancelToken; // 取消令牌
  withCredentials?: boolean; // 是否携带凭证（Cookie）
  xsrfCookieName?: string; // XSRF Cookie名称
  xsrfHeaderName?: string; // XSRF Header名称
  cookies?: Record<string, string> | string; // 要设置的Cookie
  url?: string; // 请求URL，内部使用
  cacheConfig?: boolean | CacheOptions; // 缓存选项
  forceUpdate?: boolean; // 强制更新缓存
  enableCompression?: boolean; // 启用压缩
}

export interface ResponseData<T = any> {
  data: T; // 响应数据
  status: number; // HTTP状态码
  statusText: string; // 状态文本
  headers: Headers; // 响应头
  config: RequestConfig; // 请求配置
  request?: Request; // 请求对象
  cookies?: Record<string, string>; // 响应中的Cookie
}

export interface RequestInterceptor {
  onFulfilled: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
  onRejected?: (error: any) => any;
}

export interface ResponseInterceptor {
  onFulfilled: (response: ResponseData) => ResponseData | Promise<ResponseData>;
  onRejected?: (error: any) => any;
}

// 取消请求相关接口
export interface Canceler {
  (message?: string): void;
}

export interface CancelToken {
  promise: Promise<any>;
  reason?: any;
}

// 错误类
export class RequestError extends Error {
  config: RequestConfig;
  code?: string;
  request?: Request;
  response?: Response;
  isAxiosError: boolean;
  status?: number;

  constructor(
    message: string,
    config: RequestConfig,
    code?: string,
    request?: Request,
    response?: Response
  ) {
    super(message);
    this.config = config;
    this.code = code;
    this.request = request;
    this.response = response;
    this.isAxiosError = true;
    this.status = response?.status;
    Object.setPrototypeOf(this, RequestError.prototype);
  }
}

// 创建取消令牌函数
function createCancelToken(): { token: CancelToken; cancel: Canceler } {
  let cancel!: Canceler;
  const token: CancelToken = {
    promise: new Promise((resolve) => {
      cancel = (message = 'Request canceled') => {
        token.reason = { message };
        resolve(token.reason);
      };
    }),
  };
  
  return { token, cancel };
}

// 用于共享Observable的缓存
const observableCache = new Map<string, Observable<any>>();

class Request {
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private defaultConfig: RequestConfig;
  private networkManager: NetworkManager;
  private middlewareManager: MiddlewareManager;

  constructor(private baseURL: string = '', config: RequestConfig = {}) {
    this.defaultConfig = {
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br' // 支持压缩
      },
      timeout: 10000, // 默认超时10秒
      retry: 0, // 默认不重试
      retryDelay: 1000, // 重试延迟1秒
      withCredentials: true, // 默认携带凭证
      xsrfCookieName: 'XSRF-TOKEN',
      xsrfHeaderName: 'X-XSRF-TOKEN',
      cacheConfig: false, // 默认不使用缓存
      enableCompression: true, // 默认启用压缩
      ...config,
    };
    
    // 初始化网络管理器
    this.networkManager = NetworkManager.getInstance();
    
    // 初始化中间件管理器
    this.middlewareManager = MiddlewareManager.getInstance();
    
    // 添加默认安全头
    this.interceptors.request.use(config => {
      // 添加安全相关头
      config.headers = {
        ...config.headers,
        ...SecurityManager.getSecurityHeaders()
      };
      return config;
    });
  }

  // 请求拦截器
  interceptors = {
    request: {
      use: (
        onFulfilled: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>,
        onRejected?: (error: any) => any
      ) => {
        const interceptor: RequestInterceptor = { onFulfilled, onRejected };
        this.requestInterceptors.push(interceptor);
        return this.requestInterceptors.length - 1;
      },
      eject: (id: number) => {
        if (id >= 0) {
          this.requestInterceptors.splice(id, 1);
        }
      },
    },
    response: {
      use: (
        onFulfilled: (response: ResponseData) => ResponseData | Promise<ResponseData>,
        onRejected?: (error: any) => any
      ) => {
        const interceptor: ResponseInterceptor = { onFulfilled, onRejected };
        this.responseInterceptors.push(interceptor);
        return this.responseInterceptors.length - 1;
      },
      eject: (id: number) => {
        if (id >= 0) {
          this.responseInterceptors.splice(id, 1);
        }
      },
    },
  };

  // 设置单个cookie
  setCookie(name: string, value: string, options = {}): void {
    CookieManager.set(name, value, options);
  }

  // 获取单个cookie
  getCookie(name: string): string | undefined {
    return CookieManager.get(name);
  }

  // 删除单个cookie
  removeCookie(name: string, options = {}): void {
    CookieManager.remove(name, options);
  }

  // 获取所有cookie
  getAllCookies(): Record<string, string> {
    return CookieManager.getAll();
  }

  // 清除指定URL的缓存
  clearCache(url: string, params?: Record<string, any>, options: CacheOptions = {}): void {
    const cacheKey = CacheManager.getCacheKey(url, params);
    CacheManager.remove(cacheKey, options);
  }

  // 清除所有缓存
  clearAllCache(options: CacheOptions = {}): void {
    CacheManager.clear(options);
    observableCache.clear(); // 清除Observable缓存
  }

  // 构建URL (处理baseURL和params)
  private buildURL(url: string, config: RequestConfig): string {
    const baseURL = config.baseURL || this.baseURL;
    const fullURL = url.startsWith('http') ? url : `${baseURL}${url}`;
    
    // 处理URL参数
    if (config.params) {
      const searchParams = new URLSearchParams();
      Object.entries(config.params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      
      return `${fullURL}${fullURL.includes('?') ? '&' : '?'}${searchParams.toString()}`;
    }
    
    return fullURL;
  }

  // 处理XSRF Token
  private addXsrfToken(config: RequestConfig): RequestConfig {
    // 只有同源请求才需要处理XSRF Token
    const isRelativeURL = !config.url?.startsWith('http');
    const urlObj = !isRelativeURL && config.url ? new URL(config.url) : null;
    const isSameOrigin = isRelativeURL || urlObj?.origin === window.location.origin;

    if (
      isSameOrigin &&
      config.withCredentials !== false &&
      config.xsrfCookieName &&
      config.xsrfHeaderName
    ) {
      const xsrfToken = CookieManager.get(config.xsrfCookieName);
      
      if (xsrfToken) {
        config.headers = {
          ...config.headers,
          [config.xsrfHeaderName]: xsrfToken,
        };
      }
    }
    
    return config;
  }

  // 处理请求中的Cookie
  private processCookies(config: RequestConfig): RequestConfig {
    // 如果配置中包含cookies，处理它们
    if (config.cookies) {
      if (typeof config.cookies === 'string') {
        // 如果是字符串，直接设置到头中
        config.headers = {
          ...config.headers,
          'Cookie': config.cookies,
        };
      } else if (typeof config.cookies === 'object') {
        // 如果是对象，转换为字符串后设置
        const cookieString = CookieManager.stringify(config.cookies);
        config.headers = {
          ...config.headers,
          'Cookie': cookieString,
        };
      }
    }
    
    return config;
  }

  // 应用请求拦截器
  private async applyRequestInterceptors(config: RequestConfig): Promise<RequestConfig> {
    let currentConfig = { ...config };
    
    // 处理cookies和XSRF
    currentConfig = this.processCookies(currentConfig);
    currentConfig = this.addXsrfToken(currentConfig);
    
    for (const interceptor of this.requestInterceptors) {
      try {
        currentConfig = await interceptor.onFulfilled(currentConfig);
      } catch (error) {
        if (interceptor.onRejected) {
          currentConfig = await interceptor.onRejected(error);
        } else {
          throw error;
        }
      }
    }
    
    return currentConfig;
  }

  // 应用响应拦截器
  private async applyResponseInterceptors(response: ResponseData): Promise<ResponseData> {
    let currentResponse = { ...response };
    
    for (const interceptor of this.responseInterceptors) {
      try {
        currentResponse = await interceptor.onFulfilled(currentResponse);
      } catch (error) {
        if (interceptor.onRejected) {
          currentResponse = await interceptor.onRejected(error);
        } else {
          throw error;
        }
      }
    }
    
    return currentResponse;
  }

  // 处理响应数据
  private async processResponse<T>(
    response: Response, 
    config: RequestConfig
  ): Promise<ResponseData<T>> {
    // 根据responseType处理响应数据
    let data: any;
    const responseType = config.responseType || 'json';
    
    switch (responseType) {
      case 'text':
        data = await response.text();
        break;
      case 'blob':
        data = await response.blob();
        break;
      case 'arrayBuffer':
        data = await response.arrayBuffer();
        break;
      case 'json':
      default:
        try {
          data = await response.json();
        } catch {
          // 如果JSON解析失败但响应成功，返回空对象
          data = {};
        }
    }

    // 提取响应Cookie
    const cookies = CookieManager.extractFromHeaders(response.headers);

    const responseData: ResponseData<T> = {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      config,
      cookies
    };

    // 应用响应拦截器
    return this.applyResponseInterceptors(responseData) as Promise<ResponseData<T>>;
  }

  // 获取缓存的请求Observable
  private getCachedObservable<T>(
    cacheKey: string, 
    makeRequest: () => Observable<ResponseData<T>>, 
    cacheOptions: CacheOptions,
    forceUpdate: boolean
  ): Observable<ResponseData<T>> {
    // 如果强制更新或无缓存策略，直接请求
    if (forceUpdate) {
      return makeRequest().pipe(
        // 缓存结果
        tap(response => {
          CacheManager.set(cacheKey, response, cacheOptions);
        }),
        // 共享同一个Observable
        share()
      );
    }

    // 检查是否已有进行中的相同请求Observable
    const existingObservable = observableCache.get(cacheKey) as Observable<ResponseData<T>>;
    if (existingObservable) {
      return existingObservable;
    }

    // 检查缓存
    const cachedData = CacheManager.get<ResponseData<T>>(cacheKey, cacheOptions);
    if (cachedData) {
      return of(cachedData);
    }

    // 创建新的Observable并缓存它
    const newObservable = makeRequest().pipe(
      tap(response => {
        CacheManager.set(cacheKey, response, cacheOptions);
      }),
      // 使用share操作符以便多个订阅者共享同一结果
      share()
    );

    // 保存到Observable缓存
    observableCache.set(cacheKey, newObservable);

    // 请求完成后从缓存中移除
    setTimeout(() => {
      if (observableCache.get(cacheKey) === newObservable) {
        observableCache.delete(cacheKey);
      }
    }, 30000); // 30秒后移除，防止长时间挂起

    return newObservable;
  }

  // 核心请求方法
  request<T = any>(url: string, config: RequestConfig = {}): Observable<ResponseData<T>> {
    // 合并配置
    const mergedConfig: RequestConfig = { 
      ...this.defaultConfig, 
      ...config,
      url 
    };

    // 处理缓存选项
    const cache = mergedConfig.cacheConfig;
    const forceUpdate = mergedConfig.forceUpdate || false;
    const cacheOptions: CacheOptions = typeof cache === 'object' ? cache : {};
    const useCache = cache !== false;
    
    // 生成缓存键
    const fullURL = this.buildURL(url, mergedConfig);
    const cacheKey = CacheManager.getCacheKey(fullURL, mergedConfig.params);
    
    // 检查速率限制
    const domain = this.extractDomain(fullURL);
    const rateLimitKey = `rate_limit:${domain}`;
    if (!SecurityManager.checkRateLimit(rateLimitKey, 60)) { // 每分钟最多60个请求
      return throwError(() => new RequestError(
        'Rate limit exceeded',
        mergedConfig,
        'RATE_LIMIT_ERROR'
      ));
    }
    
    // 检查网络状态
    const networkStatus = this.networkManager.checkNetworkStatus();
    if (!networkStatus.online) {
      // 如果离线，添加到队列并返回错误
      if (mergedConfig.method === 'GET') {
        this.networkManager.enqueue({
          url: fullURL,
          priority: 0,
          execute: () => this.performRequest<T>(url, mergedConfig)
        });
      }
      
      return throwError(() => new RequestError(
        'Network is offline',
        mergedConfig,
        'NETWORK_ERROR'
      ));
    }
    
    // 如果启用了缓存且是GET请求
    if (useCache && (!mergedConfig.method || mergedConfig.method === 'GET')) {
      // 使用缓存机制
      return this.getCachedObservable<T>(
        cacheKey,
        () => this.performRequest<T>(url, mergedConfig),
        cacheOptions,
        forceUpdate
      );
    }
    
    // 正常执行请求
    return this.performRequest<T>(url, mergedConfig);
  }

  // 执行实际的HTTP请求
  private performRequest<T = any>(url: string, config: RequestConfig): Observable<ResponseData<T>> {
    return new Observable<ResponseData<T>>(subscriber => {
      const abortController = new AbortController();
      const signal = abortController.signal;
      
      // 创建取消机制
      const cancelSource$ = new Subject<void>();
      
      // 如果提供了cancelToken，则设置取消机制
      if (config.cancelToken) {
        config.cancelToken.promise.then(reason => {
          abortController.abort(reason.message);
          cancelSource$.next();
          cancelSource$.complete();
        });
      }
      
      // 异步处理请求拦截器和发送请求
      (async () => {
        try {
          // 应用请求拦截器
          const processedConfig = await this.applyRequestInterceptors(config);
          
          // 应用中间件链处理请求配置
          from(this.middlewareManager.applyRequestMiddlewareChain(processedConfig)).subscribe({
            next: async (finalConfig) => {
              try {
                const fullURL = this.buildURL(url, finalConfig);
                
                // 添加信号到请求配置
                finalConfig.signal = signal;
                
                // 处理压缩
                if (finalConfig.enableCompression) {
                  finalConfig.headers = {
                    ...finalConfig.headers,
                    'Accept-Encoding': 'gzip, deflate, br'
                  };
                }
                
                // 准备给fromFetch的请求配置，过滤掉自定义属性
                const fetchConfig: RequestInit = {
                  method: finalConfig.method,
                  headers: finalConfig.headers,
                  body: finalConfig.body,
                  mode: finalConfig.mode,
                  credentials: finalConfig.withCredentials ? 'include' : 'same-origin',
                  signal: finalConfig.signal,
                  referrer: finalConfig.referrer,
                  referrerPolicy: finalConfig.referrerPolicy,
                  window: finalConfig.window
                };
                
                // 发送请求
                of(null).pipe(
                  switchMap(() => fromFetch(fullURL, fetchConfig)),
                  // 添加超时处理
                  timeout(finalConfig.timeout || 10000),
                  // 添加重试机制
                  retry({
                    count: finalConfig.retry || 0,
                    delay: (error, retryCount) => {
                      // 如果是网络错误或服务器错误(5xx)才重试
                      const shouldRetry = !error.status || (error.status >= 500 && error.status < 600);
                      if (!shouldRetry) {
                        return throwError(() => error);
                      }
                      console.log(`重试 #${retryCount}，延迟 ${finalConfig.retryDelay || 1000}ms`);
                      return timer((finalConfig.retryDelay || 1000) * retryCount);
                    }
                  }),
                  // 请求取消机制
                  takeUntil(cancelSource$),
                  // 处理错误
                  catchError(error => {
                    let requestError: RequestError;
                    
                    if (error.name === 'TimeoutError') {
                      requestError = new RequestError(
                        `Timeout of ${finalConfig.timeout}ms exceeded`,
                        finalConfig,
                        'ECONNABORTED'
                      );
                    } else if (error instanceof Response) {
                      requestError = new RequestError(
                        `Request failed with status code ${error.status}`,
                        finalConfig,
                        'ERR_BAD_RESPONSE',
                        undefined,
                        error
                      );
                    } else {
                      requestError = new RequestError(
                        error.message || 'Network Error',
                        finalConfig,
                        'ERR_NETWORK'
                      );
                    }
                    
                    // 使用中间件链处理错误
                    return this.middlewareManager.applyErrorMiddlewareChain(requestError).pipe(
                      catchError(processedError => throwError(() => processedError))
                    );
                  }),
                  // 清理资源
                  finalize(() => {
                    cancelSource$.complete();
                  })
                ).subscribe({
                  next: (value: unknown) => {
                    const response = value as Response;
                    (async () => {
                      try {
                        // 处理非2xx响应
                        if (!response.ok) {
                          const error = new RequestError(
                            `Request failed with status code ${response.status}`,
                            finalConfig,
                            'ERR_BAD_RESPONSE',
                            undefined,
                            response
                          );
                          subscriber.error(error);
                          return;
                        }
                        
                        // 处理响应数据
                        const initialResponseData = await this.processResponse<T>(response, finalConfig);
                        
                        // 使用中间件链处理响应
                        this.middlewareManager.applyResponseMiddlewareChain(initialResponseData).subscribe({
                          next: (finalResponseData) => {
                            subscriber.next(finalResponseData);
                            subscriber.complete();
                          },
                          error: (error) => {
                            subscriber.error(error);
                          }
                        });
                      } catch (error: any) {
                        subscriber.error(error);
                      }
                    })();
                  },
                  error: (error) => {
                    subscriber.error(error);
                  }
                });
              } catch (error: any) {
                subscriber.error(error);
              }
            },
            error: (error) => {
              subscriber.error(error);
            }
          });
        } catch (error: any) {
          subscriber.error(error);
        }
      })();
      
      // 返回清理函数
      return () => {
        abortController.abort('Observable unsubscribed');
        cancelSource$.next();
        cancelSource$.complete();
      };
    });
  }

  // 从URL中提取域名
  private extractDomain(url: string): string {
    try {
      // 对于完整URL
      if (url.startsWith('http')) {
        const urlObj = new URL(url);
        return urlObj.hostname;
      }
      
      // 对于相对URL，使用当前域名
      return window.location.hostname;
    } catch {
      // 解析失败时返回默认值
      return 'unknown';
    }
  }

  // HTTP方法简写
  get<T = any>(
    url: string, 
    config?: RequestConfig, 
    cacheOptions?: { useCache?: boolean; forceUpdate?: boolean }
  ): Observable<ResponseData<T>> {
    return this.request<T>(url, { 
      ...config, 
      method: 'GET',
      cacheConfig: cacheOptions?.useCache !== false ? (config?.cacheConfig || true) : false,
      forceUpdate: cacheOptions?.forceUpdate
    });
  }

  post<T = any>(url: string, data?: any, config?: RequestConfig): Observable<ResponseData<T>> {
    return this.request<T>(url, {
      ...config,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  put<T = any>(url: string, data?: any, config?: RequestConfig): Observable<ResponseData<T>> {
    return this.request<T>(url, {
      ...config,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  delete<T = any>(url: string, config?: RequestConfig): Observable<ResponseData<T>> {
    return this.request<T>(url, {
      ...config,
      method: 'DELETE',
    });
  }

  patch<T = any>(url: string, data?: any, config?: RequestConfig): Observable<ResponseData<T>> {
    return this.request<T>(url, {
      ...config,
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // 封装文件上传
  upload<T = any>(
    url: string, 
    formData: FormData, 
    onProgress?: (progressEvent: ProgressEvent) => void,
    config?: RequestConfig
  ): Observable<ResponseData<T>> {
    return this.request<T>(url, {
      ...config,
      method: 'POST',
      body: formData,
      headers: {
        // 移除Content-Type，让浏览器自动设置
        ...config?.headers,
        'Content-Type': null as unknown as string,
      },
    });
  }
}

// 创建默认实例
const request = new Request('https://jsonplaceholder.typicode.com', {
  timeout: 10000,
  retry: 1,
  retryDelay: 1000,
  withCredentials: true,
});

// 配置网络管理器
NetworkManager.getInstance().setMaxConcurrentRequests(6);
NetworkManager.getInstance().setDomainThrottle('jsonplaceholder.typicode.com', {
  perSecond: 10,
  perMinute: 100
});

// 添加默认请求拦截器
request.interceptors.request.use((config) => {
  // 添加身份验证
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`
    };
  }
  
  // 如果存在CSRF令牌，添加到请求头
  const csrfToken = SecurityManager.getCSRFToken();
  if (csrfToken && config.method !== 'GET') {
    config.headers = {
      ...config.headers,
      'X-CSRF-Token': csrfToken
    };
  }
  
  return config;
});

// 添加默认响应拦截器
request.interceptors.response.use(
  (response) => {
    // 可以在这里全局处理响应
    console.log('API Response:', response);
    
    // 处理响应中的Cookie
    if (response.cookies && Object.keys(response.cookies).length > 0) {
      console.log('响应Cookie:', response.cookies);
      // 可以在这里处理特定的Cookie，例如保存到Cookie存储
    }
    
    return response;
  },
  (error) => {
    // 全局错误处理
    console.error('API Error:', error);
    // 可以根据错误代码进行不同处理
    if (error.status === 401) {
      // 处理未授权错误，例如跳转到登录页
      console.log('未授权，请重新登录');
    }
    return Promise.reject(error);
  }
);

export { createCancelToken, request };
export default request;