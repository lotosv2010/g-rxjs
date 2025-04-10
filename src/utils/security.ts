// security.ts - 安全工具类

/**
 * 安全工具类
 * 提供输入净化、CSRF保护和请求速率限制功能
 */
export class SecurityManager {
  // CSRF令牌存储键
  private static readonly CSRF_TOKEN_KEY = 'csrf_token';
  
  // 请求速率限制
  private static rateLimits: Record<string, { count: number, timestamp: number }> = {};
  
  /**
   * 生成CSRF令牌
   * @returns CSRF令牌
   */
  static generateCSRFToken(): string {
    // 生成随机令牌
    const random = Math.random().toString(36).substring(2);
    const timestamp = Date.now().toString(36);
    const token = `${random}${timestamp}`;
    
    // 存储令牌
    try {
      localStorage.setItem(this.CSRF_TOKEN_KEY, token);
    } catch {
      // 如果localStorage不可用，使用cookie
      document.cookie = `${this.CSRF_TOKEN_KEY}=${token}; path=/; SameSite=Strict; Secure`;
    }
    
    return token;
  }
  
  /**
   * 获取CSRF令牌
   * @returns 存储的CSRF令牌或undefined
   */
  static getCSRFToken(): string | undefined {
    try {
      // 尝试从localStorage获取
      const token = localStorage.getItem(this.CSRF_TOKEN_KEY);
      if (token) return token;
      
      // 如果localStorage中没有，尝试从cookie获取
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === this.CSRF_TOKEN_KEY) {
          return value;
        }
      }
    } catch {
      // 忽略错误
    }
    
    return undefined;
  }
  
  /**
   * 验证CSRF令牌
   * @param token 要验证的令牌
   * @returns 是否有效
   */
  static validateCSRFToken(token: string): boolean {
    const storedToken = this.getCSRFToken();
    return storedToken === token;
  }
  
  /**
   * 净化HTML字符串，防止XSS攻击
   * @param html HTML字符串
   * @returns 净化后的字符串
   */
  static sanitizeHTML(html: string): string {
    const element = document.createElement('div');
    element.textContent = html;
    return element.innerHTML;
  }
  
  /**
   * 净化URL，防止恶意URL
   * @param url 输入URL
   * @returns 净化后的URL或空字符串（如果URL无效）
   */
  static sanitizeURL(url: string): string {
    try {
      const parsedURL = new URL(url, window.location.origin);
      
      // 只允许http和https协议
      if (parsedURL.protocol !== 'http:' && parsedURL.protocol !== 'https:') {
        return '';
      }
      
      return parsedURL.toString();
    } catch {
      return '';
    }
  }
  
  /**
   * 检查并限制请求速率
   * @param key 限制键（如API端点或用户ID）
   * @param limit 时间窗口内的最大请求数
   * @param windowMs 时间窗口（毫秒）
   * @returns 是否允许请求
   */
  static checkRateLimit(key: string, limit: number, windowMs: number = 60000): boolean {
    const now = Date.now();
    const rateLimit = this.rateLimits[key] || { count: 0, timestamp: now };
    
    // 检查是否在窗口期内
    if (now - rateLimit.timestamp > windowMs) {
      // 重置计数
      rateLimit.count = 1;
      rateLimit.timestamp = now;
      this.rateLimits[key] = rateLimit;
      return true;
    }
    
    // 检查是否超过限制
    if (rateLimit.count >= limit) {
      return false;
    }
    
    // 增加计数
    rateLimit.count++;
    this.rateLimits[key] = rateLimit;
    return true;
  }
  
  /**
   * 获取安全HTTP头
   * @returns 安全HTTP头对象
   */
  static getSecurityHeaders(): Record<string, string> {
    return {
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; object-src 'none'; upgrade-insecure-requests;",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };
  }
  
  /**
   * 验证文件类型是否安全
   * @param file 文件对象
   * @param allowedTypes 允许的MIME类型数组
   * @returns 是否是安全文件类型
   */
  static isSecureFileType(file: File, allowedTypes: string[]): boolean {
    return allowedTypes.includes(file.type);
  }
  
  /**
   * 验证文件大小是否在限制内
   * @param file 文件对象
   * @param maxSizeBytes 最大字节数
   * @returns 是否在大小限制内
   */
  static isValidFileSize(file: File, maxSizeBytes: number): boolean {
    return file.size <= maxSizeBytes;
  }
}

export default SecurityManager; 