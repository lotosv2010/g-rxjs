import "./App.css";
import { useEffect, useState } from 'react'
import request, { createCancelToken } from "./utils/request";
import { CookieManager } from "./utils/cookie";

interface User {
  id: number;
  name: string;
  email: string;
  username: string;
}

interface Post {
  id: number;
  title: string;
  body: string;
}

function App() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cookies, setCookies] = useState<Record<string, string>>({});
  const [cached, setCached] = useState<boolean>(false);
  const [responseTime, setResponseTime] = useState<number>(0);

  // 演示基本请求
  async function fetchData() {
    setError(null);
    
    try {
      // 演示GET请求
      request.get<User[]>('/users')
        .subscribe({
          next(response) {
            console.log('用户数据:', response.data);
          },
          error(err) {
            console.error('获取用户数据失败:', err);
            setError('获取用户数据失败');
          },
          complete() {
            console.log('用户数据请求完成');
          }
        });
        
      // 演示带参数的GET请求
      request.get<Post[]>('/posts', {
        params: { userId: 1 }
      }).subscribe({
        next(response) {
          console.log('帖子数据:', response.data);
        },
        error(err) {
          console.error('获取帖子失败:', err);
        }
      });
    } catch (err) {
      console.error('请求错误:', err);
      setError('请求错误');
    }
  }
  
  // 演示取消请求
  async function demonstrateCancellation() {
    const { token, cancel } = createCancelToken();
    
    request.get('/users', { 
      cancelToken: token,
      timeout: 30000 // 设置超时为30秒
    }).subscribe({
      next() {
        console.log('这个不应该被执行，因为请求会被取消');
      },
      error(err) {
        console.log('请求被取消:', err);
      }
    });
    
    // 1秒后取消请求
    setTimeout(() => {
      cancel('用户手动取消了请求');
      console.log('请求已取消');
    }, 1000);
  }
  
  // 演示POST请求
  async function demonstratePost() {
    const newPost = {
      title: '新文章标题',
      body: '新文章内容',
      userId: 1
    };
    
    request.post<Post>('/posts', newPost)
      .subscribe({
        next(response) {
          console.log('创建的文章:', response.data);
        },
        error(err) {
          console.error('创建文章失败:', err);
        }
      });
  }

  // 演示Cookie功能
  function demonstrateCookies() {
    // 设置一些Cookie
    CookieManager.set('user_preference', 'dark_mode', { path: '/' });
    CookieManager.set('session_demo', '123456', { expires: 7 }); // 7天过期
    CookieManager.set('secure_cookie', 'secure_value', { secure: true, sameSite: 'strict' });
    
    // 获取所有Cookie并显示
    const allCookies = CookieManager.getAll();
    setCookies(allCookies);
    console.log('所有Cookie:', allCookies);
    
    // 使用携带Cookie的请求
    request.get('/posts', {
      withCredentials: true,
      cookies: { 'api_token': 'demo_token' } // 给请求添加特定Cookie
    }).subscribe({
      next(response) {
        console.log('带Cookie的请求:', response);
      }
    });
  }

  // 演示缓存功能
  function demonstrateCache() {
    setResponseTime(0);
    setCached(false);
    
    const startTime = Date.now();
    
    // 第一次请求 - 无缓存
    request.get('/posts', {
      cacheConfig: {
        ttl: 30000, // 30秒缓存
        useLocalStorage: false // 使用内存缓存
      }
    }).subscribe({
      next(response) {
        const time = Date.now() - startTime;
        setResponseTime(time);
        setCached(false);
        console.log(`首次请求响应时间: ${time}ms`, response);
        
        // 2秒后执行带缓存的第二次请求
        setTimeout(() => {
          const secondStart = Date.now();
          
          // 第二次请求 - 使用缓存
          request.get('/posts', {
            cacheConfig: true // 使用默认缓存设置
          }).subscribe({
            next(cachedResponse) {
              const cachedTime = Date.now() - secondStart;
              setResponseTime(cachedTime);
              setCached(true);
              console.log(`缓存请求响应时间: ${cachedTime}ms`, cachedResponse);
            }
          });
        }, 2000);
      }
    });
  }

  // 删除Cookie的示例
  function deleteCookie(name: string) {
    CookieManager.remove(name);
    // 更新显示
    setCookies(CookieManager.getAll());
  }

  // 清除缓存
  function clearAllCaches() {
    request.clearAllCache();
    console.log('所有缓存已清除');
  }

  const start = async () => {
    setLoading(true);
    await fetchData();
    await demonstrateCancellation();
    await demonstratePost();
    demonstrateCookies(); // 演示Cookie功能
    demonstrateCache(); // 演示缓存功能
    setLoading(false);
  };
  
  useEffect(() => {
    start();
  }, []);

  return (
    <div className="app-container">
      <h1>RxJS HTTP 客户端演示</h1>
      
      {loading && <p>加载中...</p>}
      {error && <p className="error">{error}</p>}
      
      <div className="sections-container">
        <div className="section">
          <h2>Cookie 管理</h2>
          {Object.keys(cookies).length > 0 ? (
            <div className="cookie-list">
              <h3>当前Cookie:</h3>
              <ul>
                {Object.entries(cookies).map(([name, value]) => (
                  <li key={name}>
                    <strong>{name}:</strong> {value}
                    <button 
                      className="delete-btn" 
                      onClick={() => deleteCookie(name)}
                    >
                      删除
                    </button>
                  </li>
                ))}
              </ul>
              <button 
                className="btn" 
                onClick={() => setCookies(CookieManager.getAll())}
              >
                刷新Cookie列表
              </button>
            </div>
          ) : (
            <p>没有Cookie</p>
          )}
          
          <div className="cookie-form">
            <h3>设置新Cookie</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              const name = formData.get('name') as string;
              const value = formData.get('value') as string;
              if (name && value) {
                CookieManager.set(name, value);
                setCookies(CookieManager.getAll());
                (e.target as HTMLFormElement).reset();
              }
            }}>
              <div className="form-group">
                <label>名称:</label>
                <input type="text" name="name" required />
              </div>
              <div className="form-group">
                <label>值:</label>
                <input type="text" name="value" required />
              </div>
              <button type="submit" className="btn">设置Cookie</button>
            </form>
          </div>
        </div>
        
        <div className="section">
          <h2>缓存功能</h2>
          <div className="cache-demo">
            <div className="cache-info">
              <div className="cache-status">
                <span>状态:</span>
                <span className={`status-badge ${cached ? 'cached' : 'network'}`}>
                  {cached ? '✓ 已缓存' : '🔄 网络请求'}
                </span>
              </div>
              <div className="response-time">
                <span>响应时间:</span>
                <span className="time-value">{responseTime}ms</span>
              </div>
            </div>
            
            <div className="cache-actions">
              <button className="btn" onClick={demonstrateCache}>
                测试缓存
              </button>
              <button className="btn btn-warning" onClick={clearAllCaches}>
                清除所有缓存
              </button>
            </div>
            
            <p className="cache-explanation">
              缓存演示说明: 点击"测试缓存"按钮将发出两个请求。第一个是正常网络请求，
              第二个（2秒后）使用缓存。您可以看到缓存请求的响应时间明显快于首次请求。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
