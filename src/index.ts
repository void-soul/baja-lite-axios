import axios, { AxiosInstance, type AxiosResponse } from 'axios';
const GlobalAxiosOption = Symbol('GlobalAxiosOption');
const axiosInstance = Symbol('axiosInstance');
const requestManager = Symbol('requestManager');
const sleep = (time = parseInt(`${Math.random()}`) + 200) => new Promise((resolve) => setTimeout(resolve, time));
interface BajaElementOptions {
  getToken: () => string;
  tokenName: string;
  on401: () => void;
  onError: (message: string) => void;
  loading: {
    start: (loading?: Record<string, any>) => void;
    end: () => void;
  };
  baseUrl: string;
  transformUrl?: (url: string) => string;
  ifSuccess: <ResponseData, ReqDataType>(response: AxiosResponse<ResponseData, ReqDataType>) => void;
  readData: <ResponseData, ReqDataType>(response: AxiosResponse<ResponseData, ReqDataType>) => ResponseData;
}
interface CacheItem<T = any> {
  data: T;
  timestamp: number;
  expireTime: number;
}
interface CacheConfig {
  ttl?: number; // 缓存生存时间（毫秒），默认5分钟
  maxSize?: number; // 最大缓存条目数，默认100
}
interface RequestOption<ReqDataType> {
  params?: ReqDataType;
  cache?: CacheConfig;
  loading?: Record<string, any>;
}
class RequestManager {
  private pendingMap: Map<string, Promise<any>>;
  private maxSize: number;
  private defaultTTL: number;
  private cacheMap: Map<string, CacheItem>;

  constructor(maxSize = 100, defaultTTL = 5 * 60 * 1000) {
    this.pendingMap = new Map();
    this.cacheMap = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  handelExcption({ message = '', status = 500, url = '' } = {}) {
    message = `${message} <br/> <b>Request</b>: ${url} <br/> <b>Server status</b>: ${status}`;
    (globalThis[GlobalAxiosOption] as BajaElementOptions).onError(message);
    if (status === 401) {
      (globalThis[GlobalAxiosOption] as BajaElementOptions).on401();
    }
    return { status, message };
  };

  // 执行请求（包含缓存和防重复提交逻辑）
  async execute<ResDataType, ReqDataType>
    (
      url: string,
      method: 'POST' | 'GET' | 'DELETE' | 'PUT',
      options?: {
        params?: ReqDataType;
        cache?: CacheConfig;
        loading?: Record<string, any>;
      },
      ext?: {
        formData?: FormData,
        headers?: Record<string, string>
      }
    ): Promise<ResDataType> {


    const requestKey = [
      url,
      method,
      JSON.stringify(options?.params ?? {})
    ].join('&').replace(/"|\\/g, '');


    (globalThis[GlobalAxiosOption] as BajaElementOptions).loading.start(options?.loading);

    // 1. 检查缓存
    if (options?.cache) {
      const cachedData = this.get<ResDataType>(requestKey);
      if (cachedData !== null) {
        return cachedData;
      }
    }

    // 2. 检查是否有正在进行的相同请求
    if (this.pendingMap.has(requestKey)) {
      return this.pendingMap.get(requestKey) as Promise<ResDataType>;
    }

    // 3. 创建新的请求Promise
    let requestFn: Promise<AxiosResponse<ResDataType, ReqDataType>> | undefined = undefined;
    const instance = globalThis[axiosInstance] as AxiosInstance;
    switch (method) {
      case 'POST':
        requestFn = instance.post<
          ResDataType,
          AxiosResponse<ResDataType, ReqDataType>,
          ReqDataType | FormData
        >(
          url,
          ext?.formData || options?.params,
          { headers: ext?.headers }
        );
        break;
      case 'PUT':
        requestFn = instance.put<
          ResDataType,
          AxiosResponse<ResDataType, ReqDataType>,
          ReqDataType | FormData
        >(
          url,
          ext?.formData || options?.params,
          { headers: ext?.headers }
        );
        break;
      case 'GET':
        instance.get<
          ResDataType,
          AxiosResponse<ResDataType, ReqDataType>,
          ReqDataType
        >(url, { params: options?.params });
        break;
      case 'DELETE':
        instance.get<
          ResDataType,
          AxiosResponse<ResDataType, ReqDataType>,
          ReqDataType
        >(url, { params: options?.params });
        break;
    }

    const requestPromise = requestFn?.then(response => {
      let ret: ResDataType | undefined;

      (globalThis[GlobalAxiosOption] as BajaElementOptions).ifSuccess(response);
      ret = (globalThis[GlobalAxiosOption] as BajaElementOptions).readData<ResDataType, ReqDataType>(response);

      // 请求成功后设置缓存
      if (options?.cache) {
        this.set(requestKey, ret, options?.cache.ttl ?? 30000);
      }
      return ret;
    }).catch(e => {
      if (e.message?.startsWith('Network Error')) {
        throw this.handelExcption({ message: e.message, status: -1, url });
      } else {
        throw e;
      }
    }).finally(() => {
      // 请求完成后清理pending状态
      this.pendingMap.delete(requestKey);
      (globalThis[GlobalAxiosOption] as BajaElementOptions).loading.end();
    });

    // 4. 将请求Promise存储到pendingMap中
    this.pendingMap.set(requestKey, requestPromise!);
    return await requestPromise!;
  }

  // 清理pending请求
  clearPending(): void {
    this.pendingMap.clear();
  }

  // 获取pending请求统计
  getPendingStats() {
    return {
      pendingCount: this.pendingMap.size,
      pendingKeys: Array.from(this.pendingMap.keys())
    };
  }

  // 生成缓存键
  generateCacheKey(url: string, method: string, params?: any, data?: any): string {
    return [url, method, JSON.stringify(params || {}), JSON.stringify(data || {})].join('&').replace(/"|\\/g, '');
  }

  // 获取缓存
  get<T>(key: string): T | null {
    const item = this.cacheMap.get(key);
    if (!item) return null;

    // 检查是否过期
    if (Date.now() > item.expireTime) {
      this.cacheMap.delete(key);
      return null;
    }

    return item.data as T;
  }

  // 设置缓存
  set<T>(key: string, data: T, ttl?: number): void {
    const expireTime = Date.now() + (ttl || this.defaultTTL);

    // 如果缓存已满，删除最旧的条目
    if (this.cacheMap.size >= this.maxSize) {
      const oldestKey = this.cacheMap.keys().next().value;
      if (oldestKey) {
        this.cacheMap.delete(oldestKey);
      }
    }

    this.cacheMap.set(key, {
      data,
      timestamp: Date.now(),
      expireTime
    });
  }

  // 删除缓存
  delete(key: string): boolean {
    return this.cacheMap.delete(key);
  }

  // 清空所有缓存
  clear(): void {
    this.cacheMap.clear();
  }

  // 获取缓存统计信息
  getStats() {
    return {
      size: this.cacheMap.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cacheMap.keys())
    };
  }

  // 清理过期缓存
  cleanup(): number {
    const now = Date.now();
    let deletedCount = 0;

    for (const [key, item] of this.cacheMap.entries()) {
      if (now > item.expireTime) {
        this.cacheMap.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}
if (!globalThis[axiosInstance]) {
  const instance = axios.create({
    baseURL: (globalThis[GlobalAxiosOption] as BajaElementOptions).baseUrl,
    responseType: 'json',
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      Accept: 'application/json'
    },
    proxy: false
  });
  instance.interceptors.request.use(
    async config => {
      const token = (globalThis[GlobalAxiosOption] as BajaElementOptions).getToken();
      if (token) {
        config.headers[(globalThis[GlobalAxiosOption] as BajaElementOptions).tokenName] = token;
      }
      await sleep(100);
      return config;
    },
    error => Promise.reject(error)
  );
  instance.interceptors.response.use(
    response => response,
    error => Promise.reject(error)
  );
  globalThis[axiosInstance] = instance;
}
if (!globalThis[requestManager]) {
  // 创建请求管理器实例
  globalThis[requestManager] = new RequestManager();
  // 定期清理过期缓存（每10秒钟执行一次）
  setInterval(() => (globalThis[requestManager] as RequestManager).cleanup(), 10 * 1000);
}
export function SetUp(bajaConfig: BajaElementOptions) {
  globalThis[GlobalAxiosOption] = bajaConfig;
}
export const $ = {
  $post: async <ResDataType = any, ReqDataType = Record<string, any>>(url: string, options?: RequestOption<ReqDataType>): Promise<ResDataType> => (globalThis[requestManager] as RequestManager).execute<ResDataType, ReqDataType>(url, 'POST', options),
  $get: async <ResDataType = any, ReqDataType = Record<string, any>>(url: string, options?: RequestOption<ReqDataType>): Promise<ResDataType> => (globalThis[requestManager] as RequestManager).execute<ResDataType, ReqDataType>(url, 'GET', options),
  $delete: async <ResDataType = any, ReqDataType = Record<string, any>>(url: string, options?: RequestOption<ReqDataType>): Promise<ResDataType> => (globalThis[requestManager] as RequestManager).execute<ResDataType, ReqDataType>(url, 'DELETE', options),
  $put: async <ResDataType = any, ReqDataType = Record<string, any>>(url: string, options?: RequestOption<ReqDataType>): Promise<ResDataType> => (globalThis[requestManager] as RequestManager).execute<ResDataType, ReqDataType>(url, 'PUT', options),
  $query: async <ResDataType = any, ReqDataType = Record<string, any>>(sqlCode: string, options?: RequestOption<ReqDataType>): Promise<ResDataType[]> => {
    const res = await (globalThis[requestManager] as RequestManager).execute<{
      records: ResDataType[];
      size: number;
      sum: Record<keyof ResDataType, number>;
      total: number;
    }, ReqDataType>('/query.json', 'POST', {
      params: { ...options?.params, sqlCode } as ReqDataType,
      cache: options?.cache,
      loading: options?.loading
    });
    return res.records;
  },
  $upload: async <ResDataType = any, ReqDataType = Record<string, any>>(
    url: string,
    options: {
      data?: Record<string, any>;
      file: Blob;
      fileParamName: string;
      fileName?: string;
      loading?: Record<string, any>;
    }
  ): Promise<ResDataType> => {
    const formData = new FormData();
    formData.append(options.fileParamName, options.file, options.fileName);
    if (options.data) {
      // eslint-disable-next-line guard-for-in
      for (const key in options.data) {
        formData.append(key, options.data[key]);
      }
    }
    return await (globalThis[requestManager] as RequestManager).execute<ResDataType, ReqDataType>(url, 'POST', options, {
      formData,
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};
export const $cache = {
  // 清空所有缓存
  clear: () => (globalThis[requestManager] as RequestManager).clear(),
  // 删除指定缓存
  delete: (key: string) => (globalThis[requestManager] as RequestManager).delete(key),
  // 获取缓存统计信息
  getStats: () => (globalThis[requestManager] as RequestManager).getStats(),
  // 清理过期缓存
  cleanup: () => (globalThis[requestManager] as RequestManager).cleanup(),
  // 清理pending请求
  clearPending: () => (globalThis[requestManager] as RequestManager).clearPending(),
  // 获取pending请求统计
  getPendingStats: () => (globalThis[requestManager] as RequestManager).getPendingStats()
};
