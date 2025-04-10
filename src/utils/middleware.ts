// middleware.ts - 中间件和插件系统

import { Observable, of, throwError } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { RequestConfig, ResponseData } from './request';

// 中间件函数类型
export type RequestMiddleware = (
  config: RequestConfig,
  next: (config: RequestConfig) => Observable<RequestConfig>
) => Observable<RequestConfig>;

export type ResponseMiddleware = <T>(
  response: ResponseData<T>,
  next: (response: ResponseData<T>) => Observable<ResponseData<T>>
) => Observable<ResponseData<T>>;

export type ErrorMiddleware = (
  error: any,
  next: (error: any) => Observable<any>
) => Observable<any>;

// 转换器类型
export type RequestTransformer = (config: RequestConfig) => RequestConfig;
export type ResponseTransformer = <T>(response: ResponseData<T>) => ResponseData<T>;
export type DataTransformer = <T>(data: T) => any;

// 插件接口
export interface Plugin {
  name: string;
  version: string;
  requestMiddlewares?: RequestMiddleware[];
  responseMiddlewares?: ResponseMiddleware[];
  errorMiddlewares?: ErrorMiddleware[];
  requestTransformers?: RequestTransformer[];
  responseTransformers?: ResponseTransformer[];
  dataTransformers?: DataTransformer[];
  activate?: () => void;
  deactivate?: () => void;
}

/**
 * 中间件管理器
 * 管理HTTP请求和响应的中间件和转换器
 */
export class MiddlewareManager {
  private static instance: MiddlewareManager;
  
  // 中间件链
  private requestMiddlewares: RequestMiddleware[] = [];
  private responseMiddlewares: ResponseMiddleware[] = [];
  private errorMiddlewares: ErrorMiddleware[] = [];
  
  // 转换器链
  private requestTransformers: RequestTransformer[] = [];
  private responseTransformers: ResponseTransformer[] = [];
  private dataTransformers: DataTransformer[] = [];
  
  // 已安装的插件
  private plugins: Record<string, Plugin> = {};
  
  /**
   * 构造函数
   * @private 使用单例模式
   */
  private constructor() {}
  
  /**
   * 获取单例实例
   */
  static getInstance(): MiddlewareManager {
    if (!MiddlewareManager.instance) {
      MiddlewareManager.instance = new MiddlewareManager();
    }
    return MiddlewareManager.instance;
  }
  
  /**
   * 添加请求中间件
   * @param middleware 请求中间件函数
   */
  addRequestMiddleware(middleware: RequestMiddleware): void {
    this.requestMiddlewares.push(middleware);
  }
  
  /**
   * 添加响应中间件
   * @param middleware 响应中间件函数
   */
  addResponseMiddleware(middleware: ResponseMiddleware): void {
    this.responseMiddlewares.push(middleware);
  }
  
  /**
   * 添加错误中间件
   * @param middleware 错误中间件函数
   */
  addErrorMiddleware(middleware: ErrorMiddleware): void {
    this.errorMiddlewares.push(middleware);
  }
  
  /**
   * 添加请求转换器
   * @param transformer 请求转换器函数
   */
  addRequestTransformer(transformer: RequestTransformer): void {
    this.requestTransformers.push(transformer);
  }
  
  /**
   * 添加响应转换器
   * @param transformer 响应转换器函数
   */
  addResponseTransformer(transformer: ResponseTransformer): void {
    this.responseTransformers.push(transformer);
  }
  
  /**
   * 添加数据转换器
   * @param transformer 数据转换器函数
   */
  addDataTransformer(transformer: DataTransformer): void {
    this.dataTransformers.push(transformer);
  }
  
  /**
   * 安装插件
   * @param plugin 插件对象
   * @returns 是否安装成功
   */
  installPlugin(plugin: Plugin): boolean {
    // 检查是否已安装
    if (this.plugins[plugin.name]) {
      console.warn(`插件 "${plugin.name}" 已安装`);
      return false;
    }
    
    // 添加插件提供的中间件和转换器
    if (plugin.requestMiddlewares) {
      plugin.requestMiddlewares.forEach(middleware => {
        this.addRequestMiddleware(middleware);
      });
    }
    
    if (plugin.responseMiddlewares) {
      plugin.responseMiddlewares.forEach(middleware => {
        this.addResponseMiddleware(middleware);
      });
    }
    
    if (plugin.errorMiddlewares) {
      plugin.errorMiddlewares.forEach(middleware => {
        this.addErrorMiddleware(middleware);
      });
    }
    
    if (plugin.requestTransformers) {
      plugin.requestTransformers.forEach(transformer => {
        this.addRequestTransformer(transformer);
      });
    }
    
    if (plugin.responseTransformers) {
      plugin.responseTransformers.forEach(transformer => {
        this.addResponseTransformer(transformer);
      });
    }
    
    if (plugin.dataTransformers) {
      plugin.dataTransformers.forEach(transformer => {
        this.addDataTransformer(transformer);
      });
    }
    
    // 存储插件
    this.plugins[plugin.name] = plugin;
    
    // 激活插件
    if (plugin.activate) {
      plugin.activate();
    }
    
    console.log(`插件 "${plugin.name}" v${plugin.version} 已安装`);
    return true;
  }
  
  /**
   * 卸载插件
   * @param pluginName 插件名称
   * @returns 是否卸载成功
   */
  uninstallPlugin(pluginName: string): boolean {
    const plugin = this.plugins[pluginName];
    if (!plugin) {
      console.warn(`插件 "${pluginName}" 未安装`);
      return false;
    }
    
    // 使用过滤器移除插件的中间件和转换器
    if (plugin.requestMiddlewares) {
      this.requestMiddlewares = this.requestMiddlewares.filter(
        middleware => !plugin.requestMiddlewares?.includes(middleware)
      );
    }
    
    if (plugin.responseMiddlewares) {
      this.responseMiddlewares = this.responseMiddlewares.filter(
        middleware => !plugin.responseMiddlewares?.includes(middleware)
      );
    }
    
    if (plugin.errorMiddlewares) {
      this.errorMiddlewares = this.errorMiddlewares.filter(
        middleware => !plugin.errorMiddlewares?.includes(middleware)
      );
    }
    
    if (plugin.requestTransformers) {
      this.requestTransformers = this.requestTransformers.filter(
        transformer => !plugin.requestTransformers?.includes(transformer)
      );
    }
    
    if (plugin.responseTransformers) {
      this.responseTransformers = this.responseTransformers.filter(
        transformer => !plugin.responseTransformers?.includes(transformer)
      );
    }
    
    if (plugin.dataTransformers) {
      this.dataTransformers = this.dataTransformers.filter(
        transformer => !plugin.dataTransformers?.includes(transformer)
      );
    }
    
    // 停用插件
    if (plugin.deactivate) {
      plugin.deactivate();
    }
    
    // 移除插件
    delete this.plugins[pluginName];
    
    console.log(`插件 "${pluginName}" 已卸载`);
    return true;
  }
  
  /**
   * 列出已安装的插件
   * @returns 已安装的插件信息
   */
  listPlugins(): { name: string; version: string }[] {
    return Object.values(this.plugins).map(plugin => ({
      name: plugin.name,
      version: plugin.version
    }));
  }
  
  /**
   * 应用请求中间件链
   * @param config 请求配置
   * @returns 处理后的请求配置Observable
   */
  applyRequestMiddlewareChain(config: RequestConfig): Observable<RequestConfig> {
    // 应用请求转换器
    let transformedConfig = { ...config };
    for (const transformer of this.requestTransformers) {
      transformedConfig = transformer(transformedConfig);
    }
    
    // 如果没有中间件，直接返回配置
    if (this.requestMiddlewares.length === 0) {
      return of(transformedConfig);
    }
    
    // 创建中间件链
    return this.createRequestMiddlewareChain(transformedConfig, 0);
  }
  
  /**
   * 创建请求中间件处理链
   * @param config 请求配置
   * @param index 当前中间件索引
   * @returns 处理后的请求配置Observable
   */
  private createRequestMiddlewareChain(config: RequestConfig, index: number): Observable<RequestConfig> {
    // 如果已经处理完所有中间件，返回配置
    if (index >= this.requestMiddlewares.length) {
      return of(config);
    }
    
    // 获取当前中间件
    const middleware = this.requestMiddlewares[index];
    
    // 创建下一个处理函数
    const next = (nextConfig: RequestConfig) => {
      return this.createRequestMiddlewareChain(nextConfig, index + 1);
    };
    
    // 执行中间件
    return middleware(config, next);
  }
  
  /**
   * 应用响应中间件链
   * @param response 响应数据
   * @returns 处理后的响应数据Observable
   */
  applyResponseMiddlewareChain<T>(response: ResponseData<T>): Observable<ResponseData<T>> {
    // 应用数据转换器
    let transformedData = response.data;
    for (const transformer of this.dataTransformers) {
      transformedData = transformer(transformedData);
    }
    
    // 应用响应转换器
    let transformedResponse = { ...response, data: transformedData };
    for (const transformer of this.responseTransformers) {
      transformedResponse = transformer(transformedResponse);
    }
    
    // 如果没有中间件，直接返回响应
    if (this.responseMiddlewares.length === 0) {
      return of(transformedResponse);
    }
    
    // 创建中间件链
    return this.createResponseMiddlewareChain(transformedResponse, 0);
  }
  
  /**
   * 创建响应中间件处理链
   * @param response 响应数据
   * @param index 当前中间件索引
   * @returns 处理后的响应数据Observable
   */
  private createResponseMiddlewareChain<T>(response: ResponseData<T>, index: number): Observable<ResponseData<T>> {
    // 如果已经处理完所有中间件，返回响应
    if (index >= this.responseMiddlewares.length) {
      return of(response);
    }
    
    // 获取当前中间件
    const middleware = this.responseMiddlewares[index];
    
    // 创建下一个处理函数
    const next = (nextResponse: ResponseData<T>) => {
      return this.createResponseMiddlewareChain(nextResponse, index + 1);
    };
    
    // 执行中间件
    return middleware(response, next);
  }
  
  /**
   * 应用错误中间件链
   * @param error 错误对象
   * @returns 处理后的错误Observable或恢复的数据Observable
   */
  applyErrorMiddlewareChain<T>(error: any): Observable<T> {
    // 如果没有错误中间件，直接返回错误
    if (this.errorMiddlewares.length === 0) {
      return throwError(() => error);
    }
    
    // 创建中间件链
    return this.createErrorMiddlewareChain<T>(error, 0).pipe(
      mergeMap(result => {
        // 如果是正常响应，返回它
        return of(result as T);
      })
    );
  }
  
  /**
   * 创建错误中间件处理链
   * @param error 错误对象
   * @param index 当前中间件索引
   * @returns 处理后的错误Observable或恢复的数据Observable
   */
  private createErrorMiddlewareChain<T>(error: any, index: number): Observable<any> {
    // 如果已经处理完所有中间件，返回错误
    if (index >= this.errorMiddlewares.length) {
      return throwError(() => error);
    }
    
    // 获取当前中间件
    const middleware = this.errorMiddlewares[index];
    
    // 创建下一个处理函数
    const next = (nextError: any) => {
      return this.createErrorMiddlewareChain<T>(nextError, index + 1);
    };
    
    // 执行中间件
    return middleware(error, next);
  }
}

export default MiddlewareManager; 