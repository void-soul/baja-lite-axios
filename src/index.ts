import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
const GlobalAxiosOption = Symbol('GlobalAxiosOption');
const axiosInstance = Symbol('axiosInstance');
const requestManager = Symbol('requestManager');


const sleep = (time = parseInt(`${Math.random()}`) + 200) => new Promise((resolve) => setTimeout(resolve, time));
interface BajaElementOptions {
  /** 获取客户端TOKEN的方法 */
  getToken?: () => string;
  /** TOKEN在headers中的参数名称,默认devid */
  tokenName?: string;
  /**
   * ### 401错误发生时
   * #### 例1：
   ```
    on401: () => {
      window.CUtil.message({
        title: 'Please log in again.',
        message:
          'The login session has expired. Do you want to return to the login interface and log in again? Please make sure that all data has been backed up. ',
        type: 'question',
        buttons: ['Yes', 'No']
      }).then((ret: number) => {
        if (ret === 0) window.CUser.logout();
      });
    },
   ```
   * #### 例2：
   ```
  on401: () => {
      ElNotification({ title: '提示', message: '请登录后继续', type: 'warning' });
      const { $eventBus } = useNuxtApp();
      $eventBus.emit('open-login');
  },
   ```

   *  */
  on401: () => void;
  /**
   * ### 常规错误时
   * > 需要根据自己的服务器返回结构进行处理
   * #### 例1：
   * ```
    onError: (e: any) => {
      const message = e.response?.data?.message ?? e.message;
      const status = e.response?.status ?? e.status ?? 500;
      ElNotification({
        message,
        dangerouslyUseHTMLString: true,
        title: 'Error occurred',
        type: 'error'
      });
      return { status, message }
    },
   * ```
   * #### 例2：
   ```
    onError: (e: any) => {
      const message = e.response?.data?.message ?? e.message;
      const status = e.response?.status ?? e.status ?? 500;
      ElNotification({
        message,
        dangerouslyUseHTMLString: true,
        title: 'Error occurred',
        type: 'error'
      });
      return { status, message }
    },
   ```
   *
   */
  onError: (message: any) => { status: number; message: string };
  /** 加载 */
  loading: {
    start: (loading?: Record<string, any>) => void;
    end: () => void;
  };
  baseUrl: string;
  /**
   * ### URL改造
   * #### 例1：
   * ```
    const transformUrl = (url: string): string => {
        // 如果 URL 已经是 /api/ 开头，则不做修改
        if (url.startsWith('/api/')) {
            return url;
        }

        // 移除开头的斜杠（如果有）
        const cleanUrl = url.startsWith('/') ? url.substring(1) : url;

        // 移除 .json 后缀（如果有）
        const baseUrl = cleanUrl.endsWith('.json')
            ? cleanUrl.substring(0, cleanUrl.length - 5)
            : cleanUrl;

        // 返回转换后的 URL
        return `/api/${baseUrl}`;
    };
   * ```
   *  */
  transformUrl?: (url: string) => string;
  /**
   * ### 请求是否成功?如果失败，可以抛出异常.
   * #### 例1：
   * ```

    ifSuccess: <ResponseData, ReqDataType>(response: AxiosResponse<ResponseData, ReqDataType>) => {
      if ((response as any).status - 300 > 0) {
        throw {
          message: (response as any).data.message,
          status: (response as any).status
        }
      } else if (!(response as any).data.success) {
        throw {
          message: (response as any).data.message,
          status: (response as any).data.code || response.status
        }
      }
    },

   * ```
   */
  ifSuccess: <ResponseData, ReqDataType>(response: AxiosResponse<ResponseData, ReqDataType>) => void;
  /**
   * ### response中获取数据的方法
   * #### 例1：
   * ```
  readData: <ResponseData, ReqDataType>(response: AxiosResponse<ResponseData, ReqDataType>) => {
      if ((response as any).data.result !== null && (response as any).data.result !== undefined) {
        return (response as any).data.result as any;
      } else {
        return (response as any).data.message as any;
      }
  },
   * ```
   * #### 例2：
   * ```
   readData: <ResponseData, ReqDataType>(response: AxiosResponse<ResponseData, ReqDataType>) => response.data
   * ```
   * */
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
  /** 提交参数  */
  params?: ReqDataType;
  /** 请求缓存,如果设置则请求会进行缓存和限流 */
  cache?: CacheConfig;
  /** 请求loading,将传递给SETUP的loading */
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

    if (((globalThis as any)[GlobalAxiosOption] as BajaElementOptions).transformUrl) {
      url = ((globalThis as any)[GlobalAxiosOption] as BajaElementOptions).transformUrl!(url);
    }

    const requestKey = [
      url,
      method,
      JSON.stringify(options?.params ?? {})
    ].join('&').replace(/"|\\/g, '');


    ((globalThis as any)[GlobalAxiosOption] as BajaElementOptions).loading.start(options?.loading);

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
    const instance = (globalThis as any)[axiosInstance] as AxiosInstance;
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
        requestFn = instance.get<
          ResDataType,
          AxiosResponse<ResDataType, ReqDataType>,
          ReqDataType
        >(url, { params: options?.params });
        break;
      case 'DELETE':
        requestFn = instance.delete<
          ResDataType,
          AxiosResponse<ResDataType, ReqDataType>,
          ReqDataType
        >(url, { params: options?.params });
        break;
    }

    const requestPromise = requestFn?.then(response => {
      let ret: ResDataType | undefined;

      ((globalThis as any)[GlobalAxiosOption] as BajaElementOptions).ifSuccess(response);
      ret = ((globalThis as any)[GlobalAxiosOption] as BajaElementOptions).readData<ResDataType, ReqDataType>(response);

      // 请求成功后设置缓存
      if (options?.cache) {
        this.set(requestKey, ret, options?.cache.ttl ?? 30000);
      }
      return ret;
    }).catch(e => {
      const es = ((globalThis as any)[GlobalAxiosOption] as BajaElementOptions).onError(e);
      if (es.status === 401) {
        ((globalThis as any)[GlobalAxiosOption] as BajaElementOptions).on401();
      }
      throw es;
    }).finally(() => {
      // 请求完成后清理pending状态
      this.pendingMap.delete(requestKey);
      ((globalThis as any)[GlobalAxiosOption] as BajaElementOptions).loading.end();
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
export function SetUp(bajaConfig: BajaElementOptions) {
  // 将BajaElementOptions赋值给全局变量GlobalAxiosOption
  (globalThis as any)[GlobalAxiosOption] = bajaConfig;
  // 创建axios实例
  const instance = axios.create({
    // 设置基础URL
    baseURL: ((globalThis as any)[GlobalAxiosOption] as BajaElementOptions).baseUrl,
    // 设置响应类型为json
    responseType: 'json',
    // 设置是否携带cookie
    // 设置请求头
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      Accept: 'application/json'
    },
    proxy: false
  });
  instance.interceptors.request.use(
    async config => {
      if (((globalThis as any)[GlobalAxiosOption] as BajaElementOptions).getToken) {
        const token = ((globalThis as any)[GlobalAxiosOption] as BajaElementOptions).getToken!();
        if (token) {
          config.headers[((globalThis as any)[GlobalAxiosOption] as BajaElementOptions).tokenName ?? 'devid'] = token;
        }
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
  (globalThis as any)[axiosInstance] = instance;
  // 创建请求管理器实例
  (globalThis as any)[requestManager] = new RequestManager();
  // 定期清理过期缓存（每10秒钟执行一次）
  setInterval(() => ((globalThis as any)[requestManager] as RequestManager).cleanup(), 10 * 1000);
}
export const $post = async <ResDataType = any, ReqDataType = Record<string, any>>(url: string, options?: RequestOption<ReqDataType>): Promise<ResDataType> => ((globalThis as any)[requestManager] as RequestManager).execute<ResDataType, ReqDataType>(url, 'POST', options);
export const $get = async <ResDataType = any, ReqDataType = Record<string, any>>(url: string, options?: RequestOption<ReqDataType>): Promise<ResDataType> => ((globalThis as any)[requestManager] as RequestManager).execute<ResDataType, ReqDataType>(url, 'GET', options);
export const $delete = async <ResDataType = any, ReqDataType = Record<string, any>>(url: string, options?: RequestOption<ReqDataType>): Promise<ResDataType> => ((globalThis as any)[requestManager] as RequestManager).execute<ResDataType, ReqDataType>(url, 'DELETE', options);
export const $put = async <ResDataType = any, ReqDataType = Record<string, any>>(url: string, options?: RequestOption<ReqDataType>): Promise<ResDataType> => ((globalThis as any)[requestManager] as RequestManager).execute<ResDataType, ReqDataType>(url, 'PUT', options);
export const $query = async <ResDataType = any, ReqDataType = Record<string, any>>(sqlCode: string, options?: RequestOption<ReqDataType>): Promise<ResDataType[]> => {
  const res = await ((globalThis as any)[requestManager] as RequestManager).execute<{
    records: ResDataType[];
    size: number;
    sum: Record<keyof ResDataType, number>;
    total: number;
  }, ReqDataType>('/query.json', 'POST', {
    params: {
      ...options?.params, sqlCode, params: options?.params
    } as ReqDataType,
    cache: options?.cache,
    loading: options?.loading
  });
  return res.records;
};
export const $upload = async <ResDataType = any, ReqDataType = Record<string, any>>(
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
  return await ((globalThis as any)[requestManager] as RequestManager).execute<ResDataType, ReqDataType>(url, 'POST', options, {
    formData,
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};
export const $cache = {
  // 清空所有缓存
  clear: () => ((globalThis as any)[requestManager] as RequestManager).clear(),
  // 删除指定缓存
  delete: (key: string) => ((globalThis as any)[requestManager] as RequestManager).delete(key),
  // 获取缓存统计信息
  getStats: () => ((globalThis as any)[requestManager] as RequestManager).getStats(),
  // 清理过期缓存
  cleanup: () => ((globalThis as any)[requestManager] as RequestManager).cleanup(),
  // 清理pending请求
  clearPending: () => ((globalThis as any)[requestManager] as RequestManager).clearPending(),
  // 获取pending请求统计
  getPendingStats: () => ((globalThis as any)[requestManager] as RequestManager).getPendingStats()
};
export interface SSEOptions {
  url: string;
  params?: Record<string, any>;
  onMessage: (event: MessageEvent) => void;
  onError?: (event: Event) => void;
  onOpen?: (event: Event) => void;
  onClose?: () => void;
  withToken?: boolean;
}
/**
 * SSE请求封装
 * @returns 返回 EventSource 实例和关闭方法
 */
export const $sse = function (options: SSEOptions): { eventSource: EventSource, close: () => void } {
  const config = (globalThis as any)[GlobalAxiosOption] as BajaElementOptions;
  let url = options.url;
  if (config.transformUrl) {
    url = config.transformUrl(url);
  }
  // 拼接参数
  if (options.params) {
    const search = new URLSearchParams(options.params as any).toString();
    url += (url.includes('?') ? '&' : '?') + search;
  }
  // 拼接 baseUrl
  if (config.baseUrl && !/^https?:/.test(url)) {
    url = config.baseUrl.replace(/\/$/, '') + (url.startsWith('/') ? url : '/' + url);
  }
  // 拼接token
  if (options.withToken !== false && config.getToken) {
    const token = config.getToken();
    if (token) {
      url += (url.includes('?') ? '&' : '?') + encodeURIComponent(config.tokenName ?? 'devid') + '=' + encodeURIComponent(token);
    }
  }
  const es = new EventSource(url, { withCredentials: true });
  es.onmessage = options.onMessage;
  if (options.onError) es.onerror = options.onError;
  if (options.onOpen) es.onopen = options.onOpen;
  const close = () => {
    es.close();
    if (options.onClose) options.onClose();
  };
  return { eventSource: es, close };
}
