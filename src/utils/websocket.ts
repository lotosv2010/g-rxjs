// websocket.ts - WebSocket支持

import { BehaviorSubject, Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { NetworkManager } from './network';

// 连接状态枚举
export enum ConnectionStatus {
  CONNECTING = 'connecting',
  OPEN = 'open',
  CLOSING = 'closing',
  CLOSED = 'closed',
  ERROR = 'error'
}

// 消息类型枚举
export enum MessageType {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  MESSAGE = 'message',
  ERROR = 'error',
  CUSTOM = 'custom'
}

// 消息接口
export interface WebSocketMessage<T = any> {
  type: MessageType | string;
  data?: T;
  timestamp: number;
  id?: string;
  target?: string;
  error?: string;
}

// WebSocket配置
export interface WebSocketConfig {
  url: string;
  protocols?: string | string[];
  autoConnect?: boolean;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  reconnectBackoffFactor?: number;
  heartbeatInterval?: number;
  heartbeatMessage?: any;
  serializer?: (data: any) => string;
  deserializer?: (message: any) => any;
}

/**
 * WebSocket管理器
 * 提供WebSocket连接管理、自动重连和消息处理
 */
export class WebSocketManager {
  // 连接状态
  private _status$ = new BehaviorSubject<ConnectionStatus>(ConnectionStatus.CLOSED);
  
  // 消息主题
  private _message$ = new Subject<WebSocketMessage>();
  
  // 原始消息主题
  private _rawMessage$ = new Subject<MessageEvent>();
  
  // WebSocket实例
  private _socket: WebSocket | null = null;
  
  // 重连计数器
  private _reconnectAttempts = 0;
  
  // 停止信号
  private _stop$ = new Subject<void>();
  
  // 重连定时器
  private _reconnectTimer: any;
  
  // 心跳定时器
  private _heartbeatTimer: any;
  
  // 默认配置
  private _defaultConfig: WebSocketConfig = {
    url: '',
    autoConnect: true,
    autoReconnect: true,
    reconnectInterval: 1000,
    maxReconnectAttempts: 5,
    reconnectBackoffFactor: 1.5,
    heartbeatInterval: 30000,
    heartbeatMessage: { type: 'ping' },
    serializer: (data: any) => JSON.stringify(data),
    deserializer: (message: MessageEvent) => {
      try {
        return JSON.parse(message.data);
      } catch {
        return message.data;
      }
    }
  };
  
  // 当前配置
  private _config: WebSocketConfig;
  
  /**
   * 构造函数
   * @param config WebSocket配置
   */
  constructor(config: WebSocketConfig) {
    this._config = { ...this._defaultConfig, ...config };
    
    // 如果设置了自动连接，立即连接
    if (this._config.autoConnect) {
      this.connect();
    }
  }
  
  /**
   * 获取连接状态Observable
   */
  get status$(): Observable<ConnectionStatus> {
    return this._status$.asObservable();
  }
  
  /**
   * 获取当前连接状态
   */
  get status(): ConnectionStatus {
    return this._status$.value;
  }
  
  /**
   * 获取消息Observable
   */
  get message$(): Observable<WebSocketMessage> {
    return this._message$.asObservable();
  }
  
  /**
   * 获取原始消息Observable
   */
  get rawMessage$(): Observable<MessageEvent> {
    return this._rawMessage$.asObservable();
  }
  
  /**
   * 根据消息类型过滤消息
   * @param type 消息类型
   * @returns 过滤后的消息Observable
   */
  getMessageByType<T = any>(type: MessageType | string): Observable<WebSocketMessage<T>> {
    return this._message$.pipe(
      filter(message => message.type === type),
      map(message => message as WebSocketMessage<T>)
    );
  }
  
  /**
   * 连接WebSocket
   */
  connect(): void {
    // 如果已经连接或正在连接，不重复连接
    if (this._socket && (this.status === ConnectionStatus.OPEN || this.status === ConnectionStatus.CONNECTING)) {
      return;
    }
    
    // 设置状态为连接中
    this._status$.next(ConnectionStatus.CONNECTING);
    
    try {
      // 创建WebSocket
      this._socket = new WebSocket(this._config.url, this._config.protocols);
      
      // 设置事件处理器
      this._setupEventHandlers();
      
      // 清除重连计数
      this._reconnectAttempts = 0;
    } catch (error) {
      console.error('WebSocket连接错误:', error);
      this._status$.next(ConnectionStatus.ERROR);
      
      // 尝试重连
      this._tryReconnect();
    }
  }
  
  /**
   * 断开WebSocket连接
   * @param code 关闭代码
   * @param reason 关闭原因
   */
  disconnect(code?: number, reason?: string): void {
    // 如果没有连接，直接返回
    if (!this._socket) {
      return;
    }
    
    // 清除定时器
    this._clearTimers();
    
    // 停止重连
    this._stop$.next();
    
    try {
      // 设置状态为关闭中
      this._status$.next(ConnectionStatus.CLOSING);
      
      // 关闭连接
      this._socket.close(code || 1000, reason || 'Normal closure');
    } catch (error) {
      console.error('WebSocket关闭错误:', error);
      
      // 强制设置状态为已关闭
      this._status$.next(ConnectionStatus.CLOSED);
      
      // 清除WebSocket引用
      this._socket = null;
    }
  }
  
  /**
   * 发送消息
   * @param message 消息内容
   * @returns 是否发送成功
   */
  send(message: any): boolean {
    // 检查连接状态
    if (!this._socket || this.status !== ConnectionStatus.OPEN) {
      console.error('WebSocket未连接，无法发送消息');
      return false;
    }
    
    try {
      // 序列化消息
      const serialized = this._config.serializer ? this._config.serializer(message) : JSON.stringify(message);
      
      // 发送消息
      this._socket.send(serialized);
      return true;
    } catch (error) {
      console.error('WebSocket发送消息错误:', error);
      return false;
    }
  }
  
  /**
   * 发送特定类型的消息
   * @param type 消息类型
   * @param data 消息数据
   * @returns 是否发送成功
   */
  sendMessage<T = any>(type: MessageType | string, data?: T): boolean {
    const message: WebSocketMessage<T> = {
      type,
      data,
      timestamp: Date.now(),
      id: Math.random().toString(36).substring(2, 15)
    };
    
    return this.send(message);
  }
  
  /**
   * 检查网络状态并自动重连
   */
  checkConnection(): void {
    // 获取网络状态
    const networkManager = NetworkManager.getInstance();
    const networkStatus = networkManager.checkNetworkStatus();
    
    // 如果在线且WebSocket已关闭，尝试重连
    if (networkStatus.online && (!this._socket || this.status === ConnectionStatus.CLOSED)) {
      console.log('网络已恢复，重新连接WebSocket');
      this.connect();
    }
  }
  
  /**
   * 设置事件处理器
   */
  private _setupEventHandlers(): void {
    if (!this._socket) return;
    
    // 连接打开事件
    this._socket.onopen = () => {
      console.log('WebSocket已连接');
      this._status$.next(ConnectionStatus.OPEN);
      
      // 发送连接消息
      this._message$.next({
        type: MessageType.CONNECT,
        timestamp: Date.now()
      });
      
      // 启动心跳
      this._startHeartbeat();
    };
    
    // 消息接收事件
    this._socket.onmessage = (event: MessageEvent) => {
      // 发送原始消息
      this._rawMessage$.next(event);
      
      // 反序列化消息
      try {
        const parsedData = this._config.deserializer ? this._config.deserializer(event) : JSON.parse(event.data);
        
        // 如果是心跳响应，不处理
        if (parsedData.type === 'pong') return;
        
        // 构造消息对象
        const message: WebSocketMessage = {
          type: parsedData.type || MessageType.MESSAGE,
          data: parsedData.data || parsedData,
          timestamp: Date.now(),
          id: parsedData.id
        };
        
        // 发送消息
        this._message$.next(message);
      } catch (error) {
        console.error('WebSocket消息解析错误:', error);
        
        // 发送原始数据
        this._message$.next({
          type: MessageType.MESSAGE,
          data: event.data,
          timestamp: Date.now()
        });
      }
    };
    
    // 连接关闭事件
    this._socket.onclose = (event: CloseEvent) => {
      console.log(`WebSocket已关闭: ${event.code} - ${event.reason}`);
      this._status$.next(ConnectionStatus.CLOSED);
      
      // 发送断开消息
      this._message$.next({
        type: MessageType.DISCONNECT,
        data: { code: event.code, reason: event.reason },
        timestamp: Date.now()
      });
      
      // 清除WebSocket引用
      this._socket = null;
      
      // 清除定时器
      this._clearTimers();
      
      // 如果不是正常关闭且允许重连，尝试重连
      if (event.code !== 1000 && this._config.autoReconnect) {
        this._tryReconnect();
      }
    };
    
    // 连接错误事件
    this._socket.onerror = (event: Event) => {
      console.error('WebSocket错误:', event);
      this._status$.next(ConnectionStatus.ERROR);
      
      // 发送错误消息
      this._message$.next({
        type: MessageType.ERROR,
        data: event,
        timestamp: Date.now(),
        error: 'WebSocket connection error'
      });
    };
  }
  
  /**
   * 尝试重连
   */
  private _tryReconnect(): void {
    // 如果不允许重连或已达到最大重连次数，不再尝试
    if (!this._config.autoReconnect || (this._config.maxReconnectAttempts !== undefined && this._reconnectAttempts >= this._config.maxReconnectAttempts)) {
      console.log('已达到最大重连次数，停止重连');
      return;
    }
    
    // 清除之前的重连定时器
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
    }
    
    // 计算重连延迟（使用退避算法）
    const delay = this._config.reconnectInterval! * Math.pow(this._config.reconnectBackoffFactor!, this._reconnectAttempts);
    
    console.log(`将在 ${delay}ms 后重连 (尝试 ${this._reconnectAttempts + 1}/${this._config.maxReconnectAttempts || 'unlimited'})`);
    
    // 设置重连定时器
    this._reconnectTimer = setTimeout(() => {
      this._reconnectAttempts++;
      this.connect();
    }, delay);
  }
  
  /**
   * 启动心跳
   */
  private _startHeartbeat(): void {
    // 如果没有配置心跳或间隔为0，不启动心跳
    if (!this._config.heartbeatMessage || !this._config.heartbeatInterval) {
      return;
    }
    
    // 清除之前的心跳定时器
    this._clearHeartbeat();
    
    // 设置心跳定时器
    this._heartbeatTimer = setInterval(() => {
      if (this.status === ConnectionStatus.OPEN) {
        this.send(this._config.heartbeatMessage);
      }
    }, this._config.heartbeatInterval);
  }
  
  /**
   * 清除心跳定时器
   */
  private _clearHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }
  
  /**
   * 清除所有定时器
   */
  private _clearTimers(): void {
    // 清除心跳定时器
    this._clearHeartbeat();
    
    // 清除重连定时器
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }
}

/**
 * 创建WebSocket
 * @param config WebSocket配置
 * @returns WebSocketManager实例
 */
export function createWebSocket(config: WebSocketConfig): WebSocketManager {
  return new WebSocketManager(config);
}

export default WebSocketManager; 