# Baja-Lite-Axios

[![npm version](https://img.shields.io/npm/v/baja-lite-axios.svg)](https://www.npmjs.com/package/baja-lite-axios)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

基于 Axios 的 HTTP 客户端工具库，提供类型安全的 API 调用和统一的错误处理。

## 📋 目录

- [特性](#特性)
- [架构](#架构)
- [安装](#安装)
- [快速开始](#快速开始)
- [API 文档](#api-文档)
- [高级用法](#高级用法)

## ✨ 特性

- 🎯 **类型安全**: 完整的 TypeScript 类型支持
- 🔄 **请求/响应拦截**: 统一处理请求和响应
- 🔒 **错误处理**: 统一的错误处理机制
- 🔑 **认证支持**: 内置 Token 认证
- 📦 **请求封装**: RESTful API 风格封装
- ⏱️ **超时控制**: 灵活的超时配置
- 🔄 **重试机制**: 自动重试失败请求
- 📊 **请求日志**: 详细的请求日志记录
- 🌐 **多环境**: 支持多环境配置
- 🔧 **可扩展**: 易于扩展和定制

## 🏗️ 架构

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│                   (API Service Calls)                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  HTTP Client Wrapper                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Request Methods                                 │   │
│  │  - get(url, params, config)                      │   │
│  │  - post(url, data, config)                       │   │
│  │  - put(url, data, config)                        │   │
│  │  - delete(url, config)                           │   │
│  │  - patch(url, data, config)                      │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Interceptor Layer                       │
│  ┌──────────────────┬──────────────────────────────┐    │
│  │ Request          │ Response                     │    │
│  │ Interceptor      │ Interceptor                  │    │
│  │ - Add Token      │ - Parse Response             │    │
│  │ - Add Headers    │ - Handle Errors              │    │
│  │ - Transform Data │ - Extract Data               │    │
│  └──────────────────┴──────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                      Axios Core                          │
│  - HTTP Request/Response                                 │
│  - Network Communication                                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Backend Server                        │
│                    (REST API)                            │
└─────────────────────────────────────────────────────────┘
```

### 核心组件

1. **HttpClient**
   - 封装 Axios 实例
   - 提供统一的请求方法
   - 管理全局配置

2. **Interceptors**
   - 请求拦截器：添加认证、转换数据
   - 响应拦截器：解析响应、处理错误

3. **Error Handler**
   - 统一错误处理
   - 错误分类和转换
   - 错误日志记录

4. **Config Manager**
   - 环境配置管理
   - 动态配置切换
   - 默认配置合并

## 📦 安装

```bash
npm install baja-lite-axios axios
```

## 🚀 快速开始

### 1. 创建 HTTP 客户端

```typescript
import { createHttpClient } from 'baja-lite-axios';

const http = createHttpClient({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});
```

### 2. 发送请求

```typescript
// GET 请求
const users = await http.get('/users', {
  params: { page: 1, size: 10 }
});

// POST 请求
const newUser = await http.post('/users', {
  username: 'john',
  email: 'john@example.com'
});

// PUT 请求
const updatedUser = await http.put('/users/123', {
  username: 'john_updated'
});

// DELETE 请求
await http.delete('/users/123');

// PATCH 请求
await http.patch('/users/123', {
  status: 'active'
});
```

### 3. 添加拦截器

```typescript
// 请求拦截器
http.interceptors.request.use(
  (config) => {
    // 添加 Token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
http.interceptors.response.use(
  (response) => {
    // 提取数据
    return response.data;
  },
  (error) => {
    // 统一错误处理
    if (error.response?.status === 401) {
      // 跳转到登录页
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

## 📚 API 文档

### createHttpClient(config)

创建 HTTP 客户端实例

```typescript
function createHttpClient(config?: HttpClientConfig): HttpClient;

interface HttpClientConfig {
  baseURL?: string;              // 基础 URL
  timeout?: number;              // 超时时间（毫秒）
  headers?: Record<string, string>; // 默认请求头
  withCredentials?: boolean;     // 是否携带凭证
  responseType?: ResponseType;   // 响应类型
  maxRedirects?: number;         // 最大重定向次数
  validateStatus?: (status: number) => boolean; // 状态验证
}
```

### HttpClient 方法

#### get<T>(url, config?)

发送 GET 请求

```typescript
get<T = any>(
  url: string,
  config?: RequestConfig
): Promise<T>;

interface RequestConfig {
  params?: Record<string, any>;  // URL 参数
  headers?: Record<string, string>; // 请求头
  timeout?: number;              // 超时时间
  responseType?: ResponseType;   // 响应类型
  signal?: AbortSignal;          // 取消信号
}

// 示例
const users = await http.get<User[]>('/users', {
  params: { status: 'active' }
});
```

#### post<T>(url, data?, config?)

发送 POST 请求

```typescript
post<T = any>(
  url: string,
  data?: any,
  config?: RequestConfig
): Promise<T>;

// 示例
const user = await http.post<User>('/users', {
  username: 'john',
  email: 'john@example.com'
});
```

#### put<T>(url, data?, config?)

发送 PUT 请求

```typescript
put<T = any>(
  url: string,
  data?: any,
  config?: RequestConfig
): Promise<T>;

// 示例
const user = await http.put<User>('/users/123', {
  username: 'john_updated'
});
```

#### delete<T>(url, config?)

发送 DELETE 请求

```typescript
delete<T = any>(
  url: string,
  config?: RequestConfig
): Promise<T>;

// 示例
await http.delete('/users/123');
```

#### patch<T>(url, data?, config?)

发送 PATCH 请求

```typescript
patch<T = any>(
  url: string,
  data?: any,
  config?: RequestConfig
): Promise<T>;

// 示例
await http.patch('/users/123', {
  status: 'inactive'
});
```

#### request<T>(config)

通用请求方法

```typescript
request<T = any>(config: AxiosRequestConfig): Promise<T>;

// 示例
const response = await http.request({
  method: 'GET',
  url: '/users',
  params: { page: 1 }
});
```

### 拦截器

#### 请求拦截器

```typescript
http.interceptors.request.use(
  onFulfilled?: (config: AxiosRequestConfig) => AxiosRequestConfig | Promise<AxiosRequestConfig>,
  onRejected?: (error: any) => any
): number;

// 返回拦截器 ID，用于移除
const interceptorId = http.interceptors.request.use(
  (config) => {
    // 修改配置
    return config;
  }
);

// 移除拦截器
http.interceptors.request.eject(interceptorId);
```

#### 响应拦截器

```typescript
http.interceptors.response.use(
  onFulfilled?: (response: AxiosResponse) => any,
  onRejected?: (error: any) => any
): number;

// 示例
http.interceptors.response.use(
  (response) => {
    // 处理响应
    return response.data;
  },
  (error) => {
    // 处理错误
    return Promise.reject(error);
  }
);
```

## 🔧 高级用法

### 1. 多环境配置

```typescript
// config/http.config.ts
const configs = {
  development: {
    baseURL: 'http://localhost:3000/api',
    timeout: 10000
  },
  production: {
    baseURL: 'https://api.example.com',
    timeout: 5000
  },
  test: {
    baseURL: 'https://test-api.example.com',
    timeout: 10000
  }
};

const env = process.env.NODE_ENV || 'development';
export const httpConfig = configs[env];

// 使用
const http = createHttpClient(httpConfig);
```

### 2. Token 认证

```typescript
import { createHttpClient } from 'baja-lite-axios';

const http = createHttpClient({
  baseURL: 'https://api.example.com'
});

// Token 管理
class TokenManager {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }
}

const tokenManager = new TokenManager();

// 请求拦截器：添加 Token
http.interceptors.request.use((config) => {
  const token = tokenManager.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：处理 Token 过期
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      tokenManager.clearToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 3. 请求重试

```typescript
import axios from 'axios';

const http = createHttpClient({
  baseURL: 'https://api.example.com'
});

// 重试配置
const retryConfig = {
  retries: 3,
  retryDelay: 1000,
  retryCondition: (error: any) => {
    // 仅在网络错误或 5xx 错误时重试
    return !error.response || error.response.status >= 500;
  }
};

// 响应拦截器：实现重试
http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    
    if (!config || !retryConfig.retryCondition(error)) {
      return Promise.reject(error);
    }

    config.__retryCount = config.__retryCount || 0;

    if (config.__retryCount >= retryConfig.retries) {
      return Promise.reject(error);
    }

    config.__retryCount += 1;

    // 延迟重试
    await new Promise(resolve => 
      setTimeout(resolve, retryConfig.retryDelay)
    );

    return http.request(config);
  }
);
```

### 4. 请求取消

```typescript
// 创建取消令牌
const controller = new AbortController();

// 发送请求
const promise = http.get('/users', {
  signal: controller.signal
});

// 取消请求
controller.abort();

// 处理取消
promise.catch((error) => {
  if (axios.isCancel(error)) {
    console.log('Request canceled:', error.message);
  }
});
```

### 5. 文件上传

```typescript
async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return await http.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: (progressEvent) => {
      const percentCompleted = Math.round(
        (progressEvent.loaded * 100) / progressEvent.total
      );
      console.log(`Upload progress: ${percentCompleted}%`);
    }
  });
}
```

### 6. 文件下载

```typescript
async function downloadFile(url: string, filename: string) {
  const response = await http.get(url, {
    responseType: 'blob'
  });

  const blob = new Blob([response]);
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(link.href);
}
```

### 7. 并发请求

```typescript
// 并发多个请求
const [users, posts, comments] = await Promise.all([
  http.get('/users'),
  http.get('/posts'),
  http.get('/comments')
]);

// 使用 axios.all（已废弃，推荐使用 Promise.all）
import axios from 'axios';

axios.all([
  http.get('/users'),
  http.get('/posts')
]).then(axios.spread((users, posts) => {
  console.log(users, posts);
}));
```

### 8. 请求队列

```typescript
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private running = 0;
  private maxConcurrent = 3;

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const request = this.queue.shift()!;
    
    try {
      await request();
    } finally {
      this.running--;
      this.process();
    }
  }
}

const queue = new RequestQueue();

// 使用队列
const results = await Promise.all([
  queue.add(() => http.get('/users/1')),
  queue.add(() => http.get('/users/2')),
  queue.add(() => http.get('/users/3')),
  queue.add(() => http.get('/users/4'))
]);
```

### 9. 响应缓存

```typescript
class ResponseCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private ttl = 60000; // 1 分钟

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  set(key: string, data: any) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear() {
    this.cache.clear();
  }
}

const cache = new ResponseCache();

// 请求拦截器：检查缓存
http.interceptors.request.use((config) => {
  if (config.method === 'get') {
    const cacheKey = `${config.url}?${JSON.stringify(config.params)}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      // 返回缓存数据
      return Promise.reject({
        __cached: true,
        data: cached
      });
    }
  }
  return config;
});

// 响应拦截器：保存缓存
http.interceptors.response.use(
  (response) => {
    if (response.config.method === 'get') {
      const cacheKey = `${response.config.url}?${JSON.stringify(response.config.params)}`;
      cache.set(cacheKey, response.data);
    }
    return response;
  },
  (error) => {
    if (error.__cached) {
      return Promise.resolve({ data: error.data });
    }
    return Promise.reject(error);
  }
);
```

### 10. API 服务封装

```typescript
// services/user.service.ts
import { http } from './http';

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

export class UserService {
  private basePath = '/users';

  async getUsers(params?: { page?: number; size?: number }): Promise<User[]> {
    return await http.get(this.basePath, { params });
  }

  async getUser(id: string): Promise<User> {
    return await http.get(`${this.basePath}/${id}`);
  }

  async createUser(user: Omit<User, 'id'>): Promise<User> {
    return await http.post(this.basePath, user);
  }

  async updateUser(id: string, user: Partial<User>): Promise<User> {
    return await http.put(`${this.basePath}/${id}`, user);
  }

  async deleteUser(id: string): Promise<void> {
    return await http.delete(`${this.basePath}/${id}`);
  }
}

export const userService = new UserService();
```

## 📝 最佳实践

### 1. 统一错误处理

```typescript
// utils/error-handler.ts
export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

http.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      throw new ApiError(
        error.response.status,
        error.response.data.message || 'Request failed',
        error.response.data
      );
    } else if (error.request) {
      throw new ApiError(0, 'Network error');
    } else {
      throw new ApiError(0, error.message);
    }
  }
);
```

### 2. 类型安全

```typescript
// types/api.ts
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface PageResponse<T> {
  records: T[];
  total: number;
  page: number;
  size: number;
}

// 使用
const response = await http.get<ApiResponse<User[]>>('/users');
const users = response.data;
```

### 3. 环境变量

```typescript
// .env.development
VITE_API_BASE_URL=http://localhost:3000/api

// .env.production
VITE_API_BASE_URL=https://api.example.com

// config/http.ts
const http = createHttpClient({
  baseURL: import.meta.env.VITE_API_BASE_URL
});
```

### 4. 请求日志

```typescript
http.interceptors.request.use((config) => {
  console.log(`[Request] ${config.method?.toUpperCase()} ${config.url}`, {
    params: config.params,
    data: config.data
  });
  return config;
});

http.interceptors.response.use(
  (response) => {
    console.log(`[Response] ${response.config.url}`, response.data);
    return response;
  },
  (error) => {
    console.error(`[Error] ${error.config?.url}`, error);
    return Promise.reject(error);
  }
);
```

## 📄 License

MIT

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📮 联系

- GitHub: [void-soul/baja-lite-axios](https://github.com/void-soul/baja-lite-axios)
- NPM: [baja-lite-axios](https://www.npmjs.com/package/baja-lite-axios)
