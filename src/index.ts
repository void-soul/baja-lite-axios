import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
const sleep = (time = Math.floor(Math.random() * 100) + 200) => new Promise((resolve) => setTimeout(resolve, time));
export interface BajaElementOptions {
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
export interface CacheItem<T = any> {
  data: T;
  timestamp: number;
  expireTime: number;
}
export interface CacheConfig {
  ttl?: number; // 缓存生存时间（毫秒），默认5分钟
  maxSize?: number; // 最大缓存条目数，默认100
}
export interface RequestOption<ReqDataType> {
  /** 提交参数  */
  params?: ReqDataType;
  /** 请求缓存,如果设置则请求会进行缓存和限流 */
  cache?: CacheConfig;
  /** 请求loading,将传递给SETUP的loading */
  loading?: Record<string, any>;
}
export interface SSEOptions {
  url: string;
  params?: Record<string, any>;
  onMessage: (event: MessageEvent) => void;
  onError?: (event: Event) => void;
  onOpen?: (event: Event) => void;
  onClose?: () => void;
  withToken?: boolean;
}
export interface UploadOption {
  data?: Record<string, any>;
  file: Blob;
  fileParamName: string;
  fileName?: string;
  loading?: Record<string, any>;
}
class RequestManager {
  private pendingMap: Map<string, Promise<any>>;
  private maxSize: number;
  private defaultTTL: number;
  private cacheMap: Map<string, CacheItem>;
  private options: BajaElementOptions;
  private instance: AxiosInstance;

  constructor(options: BajaElementOptions, instance: AxiosInstance, maxSize = 100, defaultTTL = 5 * 60 * 1000) {
    this.options = options;
    this.instance = instance;
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

    if (this.options.transformUrl) {
      url = this.options.transformUrl(url);
    }

    const requestKey = [
      url,
      method,
      JSON.stringify(options?.params ?? {})
    ].join('&');

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

    this.options.loading.start(options?.loading);

    // 3. 创建新的请求Promise
    let requestFn: Promise<AxiosResponse<ResDataType, ReqDataType>> | undefined = undefined;
    switch (method) {
      case 'POST':
        requestFn = this.instance.post<
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
        requestFn = this.instance.put<
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
        requestFn = this.instance.get<
          ResDataType,
          AxiosResponse<ResDataType, ReqDataType>,
          ReqDataType
        >(url, { params: options?.params });
        break;
      case 'DELETE':
        requestFn = this.instance.delete<
          ResDataType,
          AxiosResponse<ResDataType, ReqDataType>,
          ReqDataType
        >(url, { params: options?.params });
        break;
    }

    const requestPromise = requestFn?.then(response => {
      let ret: ResDataType | undefined;

      this.options.ifSuccess(response);
      ret = this.options.readData<ResDataType, ReqDataType>(response);

      // 请求成功后设置缓存
      if (options?.cache) {
        this.set(requestKey, ret, options?.cache.ttl ?? 30000);
      }
      return ret;
    }).catch(e => {
      const es = this.options.onError(e);
      if (es.status === 401) {
        this.options.on401();
      }
      throw es;
    }).finally(() => {
      // 请求完成后清理pending状态
      this.pendingMap.delete(requestKey);
      this.options.loading.end();
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
    const expireTime = Date.now() + (ttl ?? this.defaultTTL);

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
let defaultInstance: BajaAxio | null = null;
function getDefaultInstance(): BajaAxio {
  if (!defaultInstance) {
    throw new Error('BajaAxio has not been initialized. Please call SetUp() first.');
  }
  return defaultInstance;
}
export class BajaAxio {
  private options: BajaElementOptions;
  private instance: AxiosInstance;
  private manager: RequestManager;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(bajaConfig: BajaElementOptions) {
    this.options = bajaConfig;
    // 创建axios实例
    this.instance = axios.create({
      baseURL: bajaConfig.baseUrl,
      responseType: 'json',
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        Accept: 'application/json'
      },
      proxy: false
    });
    this.instance.interceptors.request.use(
      async config => {
        if (this.options.getToken) {
          const token = this.options.getToken();
          if (token) {
            config.headers[this.options.tokenName ?? 'devid'] = token;
          }
        }
        await sleep(100);
        return config;
      },
      error => Promise.reject(error)
    );
    this.instance.interceptors.response.use(
      response => response,
      error => Promise.reject(error)
    );
    // 创建请求管理器实例
    this.manager = new RequestManager(this.options, this.instance);
    // 定期清理过期缓存（每10秒钟执行一次）
    this.cleanupTimer = setInterval(() => this.manager.cleanup(), 10 * 1000);
  }

  /** 获取底层 axios 实例 */
  getAxiosInstance(): AxiosInstance {
    return this.instance;
  }

  /** 获取配置项 */
  getOptions(): BajaElementOptions {
    return this.options;
  }

  /** 销毁实例，清理定时器 */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.manager.clear();
    this.manager.clearPending();
  }

  async $post<ResDataType = any, ReqDataType = Record<string, any>>(url: string, options?: RequestOption<ReqDataType>): Promise<ResDataType> {
    return this.manager.execute<ResDataType, ReqDataType>(url, 'POST', options);
  }

  async $get<ResDataType = any, ReqDataType = Record<string, any>>(url: string, options?: RequestOption<ReqDataType>): Promise<ResDataType> {
    return this.manager.execute<ResDataType, ReqDataType>(url, 'GET', options);
  }

  async $delete<ResDataType = any, ReqDataType = Record<string, any>>(url: string, options?: RequestOption<ReqDataType>): Promise<ResDataType> {
    return this.manager.execute<ResDataType, ReqDataType>(url, 'DELETE', options);
  }

  async $put<ResDataType = any, ReqDataType = Record<string, any>>(url: string, options?: RequestOption<ReqDataType>): Promise<ResDataType> {
    return this.manager.execute<ResDataType, ReqDataType>(url, 'PUT', options);
  }

  async $query<ResDataType = any, ReqDataType = Record<string, any>>(sqlCode: string, options?: RequestOption<ReqDataType>): Promise<ResDataType[]> {
    const res = await this.manager.execute<{
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
  }

  async $upload<ResDataType = any, ReqDataType = Record<string, any>>(
    url: string,
    options: UploadOption
  ): Promise<ResDataType> {
    const formData = new FormData();
    formData.append(options.fileParamName, options.file, options.fileName);
    if (options.data) {
      // eslint-disable-next-line guard-for-in
      for (const key in options.data) {
        formData.append(key, options.data[key]);
      }
    }
    return await this.manager.execute<ResDataType, ReqDataType>(url, 'POST', options, {
      formData,
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }

  $sse(options: SSEOptions): { eventSource: EventSource; close: () => void } {
    let url = options.url;
    if (this.options.transformUrl) {
      url = this.options.transformUrl(url);
    }
    // 拼接参数
    if (options.params) {
      const search = new URLSearchParams(options.params as any).toString();
      url += (url.includes('?') ? '&' : '?') + search;
    }
    // 拼接 baseUrl
    if (this.options.baseUrl && !/^https?:/.test(url)) {
      url = this.options.baseUrl.replace(/\/$/, '') + (url.startsWith('/') ? url : '/' + url);
    }
    // 拼接token
    if (options.withToken !== false && this.options.getToken) {
      const token = this.options.getToken();
      if (token) {
        url += (url.includes('?') ? '&' : '?') + encodeURIComponent(this.options.tokenName ?? 'devid') + '=' + encodeURIComponent(token);
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

  $cache = {
    clear: () => this.manager.clear(),
    delete: (key: string) => this.manager.delete(key),
    getStats: () => this.manager.getStats(),
    cleanup: () => this.manager.cleanup(),
    clearPending: () => this.manager.clearPending(),
    getPendingStats: () => this.manager.getPendingStats()
  }
}
export const SetUp = (bajaConfig: BajaElementOptions) => {
  if (defaultInstance) {
    defaultInstance.destroy();
  }
  defaultInstance = new BajaAxio(bajaConfig);
  return defaultInstance;
};
export const $post = async <ResDataType = any, ReqDataType = Record<string, any>>(url: string, options?: RequestOption<ReqDataType>): Promise<ResDataType> => getDefaultInstance().$post<ResDataType, ReqDataType>(url, options);
export const $get = async <ResDataType = any, ReqDataType = Record<string, any>>(url: string, options?: RequestOption<ReqDataType>): Promise<ResDataType> => getDefaultInstance().$get<ResDataType, ReqDataType>(url, options);
export const $delete = async <ResDataType = any, ReqDataType = Record<string, any>>(url: string, options?: RequestOption<ReqDataType>): Promise<ResDataType> => getDefaultInstance().$delete<ResDataType, ReqDataType>(url, options);
export const $put = async <ResDataType = any, ReqDataType = Record<string, any>>(url: string, options?: RequestOption<ReqDataType>): Promise<ResDataType> => getDefaultInstance().$put<ResDataType, ReqDataType>(url, options);
export const $query = async <ResDataType = any, ReqDataType = Record<string, any>>(sqlCode: string, options?: RequestOption<ReqDataType>): Promise<ResDataType[]> => getDefaultInstance().$query<ResDataType, ReqDataType>(sqlCode, options);
export const $upload = async <ResDataType = any, ReqDataType = Record<string, any>>(url: string, options: UploadOption): Promise<ResDataType> => getDefaultInstance().$upload<ResDataType, ReqDataType>(url, options);
export const $sse = (options: SSEOptions): { eventSource: EventSource, close: () => void } => getDefaultInstance().$sse(options);
export const $cache = {
  clear: () => getDefaultInstance().$cache.clear(),
  delete: (key: string) => getDefaultInstance().$cache.delete(key),
  getStats: () => getDefaultInstance().$cache.getStats(),
  cleanup: () => getDefaultInstance().$cache.cleanup(),
  clearPending: () => getDefaultInstance().$cache.clearPending(),
  getPendingStats: () => getDefaultInstance().$cache.getPendingStats()
};