# HTTP请求及缓存工具库优化

这个项目包含了一系列针对HTTP请求、缓存管理、网络状态监控和安全增强的工具类，基于RxJS实现了高效、可扩展的数据获取和管理功能。

## 优化项

### 性能优化

- **LRU缓存策略**：实现了基于最近最少使用原则的缓存淘汰机制
- **缓存大小限制**：对内存缓存和localStorage缓存进行智能大小管理
- **请求合并和订阅共享**：通过RxJS的share操作符合并相同的并发请求
- **并发请求限制**：允许设置最大并发请求数，防止过载
- **按域名节流请求**：支持按域名设置每秒和每分钟的请求限制

### 离线支持

- **网络状态监控**：实时检测网络连接状况，在线/离线处理
- **请求队列管理**：离线时自动将请求加入队列，网络恢复时自动重试
- **队列优先级**：支持设置请求优先级，确保重要请求优先处理
- **持久化队列**：将请求队列持久化到localStorage，防止页面刷新丢失

### 安全增强

- **安全HTTP头**：自动添加关键安全头，如CSP、HSTS等
- **CSRF保护**：内置CSRF令牌生成和验证机制
- **输入净化**：提供URL和HTML内容净化功能，防止XSS攻击
- **请求速率限制**：防止API滥用的速率限制机制
- **文件安全检查**：上传文件类型和大小验证

### 扩展功能

- **WebSocket支持**：提供完整的WebSocket连接管理，支持自动重连和心跳
- **插件系统**：可扩展的插件架构，允许添加自定义功能
- **中间件支持**：灵活的中间件链式处理请求和响应
- **转换器机制**：支持请求/响应/数据转换器，轻松处理数据格式

### 代码质量

- **类型安全**：全面的TypeScript类型定义和接口
- **统一错误处理**：标准化的错误处理机制
- **模块化设计**：高内聚低耦合的模块化架构
- **健壮性增强**：完善的异常处理和错误恢复机制

## 工具类概览

- **CacheManager**: 缓存管理，支持内存和localStorage存储
- **NetworkManager**: 网络状态监控和请求队列管理
- **SecurityManager**: 安全功能集合，CSRF保护和输入净化
- **MiddlewareManager**: 中间件系统，扩展请求和响应处理
- **WebSocketManager**: WebSocket连接管理
- **Request**: 主HTTP请求客户端，集成了上述所有功能

## 使用示例

```typescript
import { request } from './utils/request';
import { createWebSocket } from './utils/websocket';

// 基本GET请求
request.get('/api/users').subscribe({
  next: (response) => console.log(response.data),
  error: (error) => console.error(error)
});

// 带缓存的请求
request.get('/api/products', {}, { useCache: true, forceUpdate: false }).subscribe({
  next: (response) => console.log(response.data),
  error: (error) => console.error(error)
});

// WebSocket使用
const ws = createWebSocket({
  url: 'wss://example.com/socket',
  autoReconnect: true
});

ws.message$.subscribe(message => {
  console.log('收到消息:', message);
});

ws.sendMessage('chat', { text: '你好!' });
```

## 后续发展

- **全局状态管理**：与Redux或MobX集成
- **进一步性能优化**：请求批处理和资源绑定
- **更完善的测试覆盖**：单元测试和集成测试
- **国际化支持**：多语言错误消息
- **可观测性增强**：性能指标收集和监控
