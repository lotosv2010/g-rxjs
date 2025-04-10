// network.ts - 网络状态监控和请求队列管理工具

import { BehaviorSubject, Observable, Subject, from, defer, timer } from 'rxjs';
import { 
  filter, 
  map, 
  takeUntil, 
  tap, 
  scan, 
  concatMap, 
  debounceTime
} from 'rxjs/operators';

// 网络状态接口
export interface NetworkStatus {
  online: boolean;          // 是否在线
  type?: string;            // 网络类型 (wifi, cellular, etc.)
  downlink?: number;        // 估计下行速度 (Mbps)
  rtt?: number;             // 往返时间 (ms)
  effectiveType?: string;   // 有效网络类型 (4g, 3g, 2g, slow-2g)
  saveData?: boolean;       // 是否启用数据节省模式
  lastCheck: number;        // 上次检查时间
}

// 域名限流配置
export interface ThrottleConfig {
  perSecond: number;      // 每秒请求数
  perMinute?: number;     // 每分钟请求数
  quota?: number;         // 总配额（用于特殊API）
  recoveryTime?: number;  // 配额恢复时间（毫秒）
}

// 队列中的请求项
export interface QueuedRequest<T = any> {
  id: string;
  url: string;
  domain: string;
  priority: number;
  timestamp: number;
  execute: () => Observable<T>;
  retry?: number;
  retryDelay?: number;
  retryCount?: number;
}

/**
 * 网络状态管理器
 * 监控网络状态并管理请求队列
 */
export class NetworkManager {
  private static instance: NetworkManager;
  
  // 网络状态
  private _networkStatus$ = new BehaviorSubject<NetworkStatus>({
    online: navigator.onLine,
    lastCheck: Date.now()
  });
  
  // 请求队列
  private _requestQueue$ = new BehaviorSubject<QueuedRequest[]>([]);
  
  // 活跃请求计数
  private _activeRequests$ = new BehaviorSubject<number>(0);
  
  // 域名请求计数，用于限流
  private _domainCounters: Record<string, {
    second: { count: number, timestamp: number },
    minute: { count: number, timestamp: number }
  }> = {};
  
  // 域名限流配置
  private _domainThrottles: Record<string, ThrottleConfig> = {};
  
  // 最大并发请求数
  private _maxConcurrentRequests = 6;
  
  // 优先级队列处理器
  private _queueProcessor$!: Observable<any>;
  
  // 停止队列处理的信号
  private _stopQueue$ = new Subject<void>();
  
  // 持久化队列的键
  private _persistenceKey = 'network_request_queue';

  /**
   * 构造函数
   * @private 使用单例模式，通过getInstance()获取实例
   */
  private constructor() {
    // 初始化网络监听
    this._initNetworkListeners();
    
    // 初始化队列处理器
    this._initQueueProcessor();
    
    // 从localStorage恢复队列
    this._restoreQueue();
    
    // 每分钟更新一次网络状态
    setInterval(() => this.checkNetworkStatus(), 60000);
  }

  /**
   * 获取单例实例
   */
  static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  /**
   * 初始化网络状态监听器
   */
  private _initNetworkListeners(): void {
    // 监听在线状态变化
    window.addEventListener('online', () => {
      console.log('网络已连接');
      this.checkNetworkStatus();
      this._processQueue(); // 恢复在线后处理队列
    });
    
    window.addEventListener('offline', () => {
      console.log('网络已断开');
      this._networkStatus$.next({
        ...this._networkStatus$.value,
        online: false,
        lastCheck: Date.now()
      });
    });
    
    // 初始检查网络状态
    this.checkNetworkStatus();
  }

  /**
   * 初始化请求队列处理器
   */
  private _initQueueProcessor(): void {
    // 队列处理逻辑
    this._queueProcessor$ = this._requestQueue$.pipe(
      // 当队列发生变化时处理
      map(queue => {
        // 按优先级排序
        return [...queue].sort((a, b) => b.priority - a.priority);
      }),
      // 处理队列中的请求
      scan((processed, queue) => {
        // 只处理未处理的项
        const toProcess = queue.filter(item => !processed.includes(item.id));
        return [...processed, ...toProcess.map(item => item.id)];
      }, [] as string[]),
      // 过滤掉已处理的请求
      filter(ids => ids.length > 0),
      // 当有新的请求进入队列时执行
      tap(() => this._processQueue()),
      // 取消订阅时停止
      takeUntil(this._stopQueue$)
    );
    
    // 订阅队列处理器
    this._queueProcessor$.subscribe();
  }

  /**
   * 检查并更新网络状态
   */
  checkNetworkStatus(): NetworkStatus {
    const online = navigator.onLine;
    const now = Date.now();
    let networkInfo: Partial<NetworkStatus> = { online, lastCheck: now };
    
    // 如果支持Navigator.connection API，获取更多信息
    const connection = (navigator as any).connection;
    if (connection) {
      networkInfo = {
        ...networkInfo,
        type: connection.type,
        downlink: connection.downlink,
        rtt: connection.rtt,
        effectiveType: connection.effectiveType,
        saveData: connection.saveData
      };
    }
    
    const newStatus = {
      ...this._networkStatus$.value,
      ...networkInfo
    };
    
    this._networkStatus$.next(newStatus);
    return newStatus;
  }

  /**
   * 获取网络状态Observable
   */
  getNetworkStatus$(): Observable<NetworkStatus> {
    return this._networkStatus$.asObservable();
  }

  /**
   * 设置最大并发请求数
   */
  setMaxConcurrentRequests(max: number): void {
    this._maxConcurrentRequests = max;
  }

  /**
   * 设置域名限流配置
   */
  setDomainThrottle(domain: string, config: ThrottleConfig): void {
    this._domainThrottles[domain] = config;
  }

  /**
   * 添加请求到队列
   */
  enqueue<T>(request: Omit<QueuedRequest<T>, 'id' | 'timestamp' | 'domain'>): string {
    const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const domain = this._extractDomain(request.url);
    const timestamp = Date.now();
    
    const queuedRequest: QueuedRequest<T> = {
      ...request,
      id,
      domain,
      timestamp,
      priority: request.priority || 0
    };
    
    // 添加到队列
    const currentQueue = this._requestQueue$.value;
    this._requestQueue$.next([...currentQueue, queuedRequest]);
    
    // 持久化队列
    this._persistQueue();
    
    return id;
  }

  /**
   * 从队列中移除请求
   */
  dequeue(id: string): boolean {
    const currentQueue = this._requestQueue$.value;
    const newQueue = currentQueue.filter(req => req.id !== id);
    
    if (newQueue.length !== currentQueue.length) {
      this._requestQueue$.next(newQueue);
      this._persistQueue();
      return true;
    }
    return false;
  }

  /**
   * 处理队列中的请求
   */
  private _processQueue(): void {
    // 如果离线，不处理队列
    if (!this._networkStatus$.value.online) {
      return;
    }
    
    const currentQueue = this._requestQueue$.value;
    if (currentQueue.length === 0) {
      return;
    }
    
    const activeRequests = this._activeRequests$.value;
    if (activeRequests >= this._maxConcurrentRequests) {
      return;
    }
    
    // 按优先级排序
    const prioritizedQueue = [...currentQueue].sort((a, b) => b.priority - a.priority);
    
    // 计算可以执行的请求数
    const available = this._maxConcurrentRequests - activeRequests;
    
    // 获取可执行的请求
    const toExecute = prioritizedQueue.slice(0, available);
    
    // 为每个请求创建可观察对象并执行
    from(toExecute).pipe(
      // 一个接一个地处理请求
      concatMap(request => {
        // 检查域名限流
        if (!this._canProcessDomain(request.domain)) {
          // 如果域名限流，延迟处理
          const throttleConfig = this._domainThrottles[request.domain];
          const delayTime = throttleConfig ? (1000 / throttleConfig.perSecond) : 1000;
          
          return timer(delayTime).pipe(
            tap(() => {
              // 重新入队，但降低优先级防止饥饿
              this.enqueue({
                ...request,
                priority: request.priority - 1
              });
              // 从当前队列中移除
              this.dequeue(request.id);
            }),
            map(() => null) // 不返回结果
          );
        }
        
        // 增加活跃请求计数
        this._activeRequests$.next(this._activeRequests$.value + 1);
        
        // 增加域名计数
        this._incrementDomainCounter(request.domain);
        
        return defer(() => request.execute()).pipe(
          // 请求完成后处理
          tap({
            next: () => {
              // 请求成功，从队列中移除
              this.dequeue(request.id);
            },
            error: (error) => {
              // 处理错误
              console.error(`请求错误: ${error.message}`);
              
              // 如果需要重试
              if (request.retry && (request.retryCount || 0) < request.retry) {
                const retryCount = (request.retryCount || 0) + 1;
                const delayTime = request.retryDelay || 1000;
                
                // 延迟后重新入队
                timer(delayTime).subscribe(() => {
                  this.enqueue({
                    ...request,
                    retryCount,
                    // 增加优先级以更快重试
                    priority: request.priority + 1
                  });
                });
              }
              
              // 从队列中移除
              this.dequeue(request.id);
            },
            complete: () => {
              // 减少活跃请求计数
              this._activeRequests$.next(this._activeRequests$.value - 1);
              
              // 继续处理队列
              setTimeout(() => this._processQueue(), 0);
            }
          }),
          // 超时后自动继续处理队列
          debounceTime(30000)
        );
      }),
      // 收集所有结果，但不返回
      tap((result) => {
        // 输出调试信息
        if (result) {
          console.log(`队列请求完成: ${JSON.stringify(result)}`);
        }
      })
    ).subscribe();
  }

  /**
   * 检查域名是否可以处理（限流）
   */
  private _canProcessDomain(domain: string): boolean {
    // 获取当前时间
    const now = Date.now();
    
    // 如果没有此域名的限流配置，允许处理
    const throttleConfig = this._domainThrottles[domain];
    if (!throttleConfig) return true;
    
    // 初始化计数器
    if (!this._domainCounters[domain]) {
      this._domainCounters[domain] = {
        second: { count: 0, timestamp: now },
        minute: { count: 0, timestamp: now }
      };
    }
    
    const counter = this._domainCounters[domain];
    
    // 检查秒级限流
    const secondElapsed = (now - counter.second.timestamp) / 1000;
    if (secondElapsed >= 1) {
      // 重置秒计数器
      counter.second = { count: 0, timestamp: now };
    } else if (counter.second.count >= throttleConfig.perSecond) {
      // 每秒请求数超限
      return false;
    }
    
    // 检查分钟级限流
    if (throttleConfig.perMinute) {
      const minuteElapsed = (now - counter.minute.timestamp) / 60000;
      if (minuteElapsed >= 1) {
        // 重置分钟计数器
        counter.minute = { count: 0, timestamp: now };
      } else if (counter.minute.count >= throttleConfig.perMinute) {
        // 每分钟请求数超限
        return false;
      }
    }
    
    return true;
  }

  /**
   * 增加域名计数器
   */
  private _incrementDomainCounter(domain: string): void {
    const now = Date.now();
    
    // 初始化计数器
    if (!this._domainCounters[domain]) {
      this._domainCounters[domain] = {
        second: { count: 0, timestamp: now },
        minute: { count: 0, timestamp: now }
      };
    }
    
    const counter = this._domainCounters[domain];
    counter.second.count++;
    counter.minute.count++;
  }

  /**
   * 从URL中提取域名
   */
  private _extractDomain(url: string): string {
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

  /**
   * 持久化请求队列到localStorage
   */
  private _persistQueue(): void {
    try {
      // 只保存必要的信息，不保存execute函数
      const simplifiedQueue = this._requestQueue$.value.map(({ id, url, domain, priority, timestamp, retry, retryDelay, retryCount }) => ({
        id,
        url,
        domain,
        priority,
        timestamp,
        retry,
        retryDelay,
        retryCount
      }));
      
      localStorage.setItem(this._persistenceKey, JSON.stringify(simplifiedQueue));
    } catch {
      // 忽略存储错误
    }
  }

  /**
   * 从localStorage恢复请求队列
   * 注意：由于无法序列化函数，恢复的请求需要重新提供execute函数
   */
  private _restoreQueue(): void {
    try {
      const queueData = localStorage.getItem(this._persistenceKey);
      if (queueData) {
        // 清除数据，避免重复恢复
        localStorage.removeItem(this._persistenceKey);
        
        // 解析数据，但注意这些请求没有execute函数
        // 实际应用中需要通过其他方式重建请求
        console.log('从持久化存储恢复了请求队列，但需要重新提供execute函数');
      }
    } catch {
      // 忽略恢复错误
    }
  }
} 