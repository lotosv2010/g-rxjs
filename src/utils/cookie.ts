// cookie.ts - Cookie处理工具

/**
 * Cookie管理类
 * 提供Cookie的设置、获取、删除和解析等功能
 */
export class CookieManager {
  // 获取所有Cookie并解析为对象
  static getAll(): Record<string, string> {
    return document.cookie
      .split(';')
      .reduce((cookies: Record<string, string>, cookie) => {
        const [name, value] = cookie.trim().split('=').map(decodeURIComponent);
        if (name) cookies[name] = value || '';
        return cookies;
      }, {});
  }

  // 获取指定名称的Cookie
  static get(name: string): string | undefined {
    const cookies = this.getAll();
    return cookies[name];
  }

  // 设置Cookie
  static set(
    name: string, 
    value: string, 
    options: {
      expires?: Date | number;
      path?: string;
      domain?: string;
      secure?: boolean;
      sameSite?: 'strict' | 'lax' | 'none';
      httpOnly?: boolean;
    } = {}
  ): void {
    let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    
    if (options.expires) {
      if (typeof options.expires === 'number') {
        const days = options.expires;
        const date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        cookieString += `; expires=${date.toUTCString()}`;
      } else {
        cookieString += `; expires=${options.expires.toUTCString()}`;
      }
    }
    
    if (options.path) cookieString += `; path=${options.path}`;
    if (options.domain) cookieString += `; domain=${options.domain}`;
    if (options.secure) cookieString += '; secure';
    if (options.sameSite) cookieString += `; samesite=${options.sameSite}`;
    if (options.httpOnly) cookieString += '; httponly';
    
    document.cookie = cookieString;
  }

  // 删除Cookie
  static remove(name: string, options: { path?: string; domain?: string } = {}): void {
    this.set(name, '', { 
      ...options, 
      expires: new Date(0) 
    });
  }

  // 解析Cookie字符串
  static parse(cookieString: string): Record<string, string> {
    if (!cookieString) return {};
    
    return cookieString
      .split(';')
      .reduce((cookies: Record<string, string>, cookie) => {
        const [name, value] = cookie.trim().split('=').map(decodeURIComponent);
        if (name) cookies[name] = value || '';
        return cookies;
      }, {});
  }

  // 序列化Cookie对象为字符串
  static stringify(cookies: Record<string, string>): string {
    return Object.entries(cookies)
      .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
      .join('; ');
  }

  // 从响应头中提取Cookie
  static extractFromHeaders(headers: Headers): Record<string, string> {
    const cookies: Record<string, string> = {};
    const cookieHeader = headers.get('set-cookie');
    
    if (cookieHeader) {
      // 可能有多个Set-Cookie头
      cookieHeader.split(',').forEach(cookie => {
        const [cookiePart] = cookie.split(';');
        const [name, value] = cookiePart.trim().split('=');
        if (name) cookies[name] = value || '';
      });
    }
    
    return cookies;
  }
}

export default CookieManager; 