import { modelCache } from "./modelCache.js";

export const SEMANTIC_MODEL_ID = "Xenova/multilingual-e5-small";
export const SEMANTIC_MODEL_DTYPE = "q8";
export const SEMANTIC_VECTOR_DIMENSIONS = 384;

export interface SemanticProgress {
  phase: "model" | "index";
  status: string;
  file?: string;
  loaded?: number;
  total?: number;
  completed?: number;
  itemCount?: number;
}

type ProgressCallback = (progress: SemanticProgress) => void;

interface TensorResult {
  tolist(): number[][];
}

interface FeatureExtractionPipeline {
  (
    input: string[],
    options: {
      pooling: "mean";
      normalize: true;
      truncation: true;
      max_length: number;
    },
  ): Promise<TensorResult>;
}

interface TransformersModule {
  env: {
    allowLocalModels: boolean;
    allowRemoteModels: boolean;
    useBrowserCache: boolean;
    useFSCache: boolean;
    useCustomCache: boolean;
    customCache: ZoteroModelCacheLike | null;
    backends: {
      onnx: {
        wasm: {
          wasmPaths:
            | string
            | {
                mjs: string;
                wasm: string;
              };
          numThreads: number;
          proxy: boolean;
        };
      };
    };
  };
  pipeline(
    task: "feature-extraction",
    model: string,
    options: {
      dtype: string;
      device: "wasm";
      progress_callback: (value: Record<string, unknown>) => void;
    },
  ): Promise<FeatureExtractionPipeline>;
}

interface ZoteroModelCacheLike {
  match(request: unknown): Promise<Response | undefined>;
  put(request: unknown, response: Response): Promise<void>;
}

function progressValue(
  value: Record<string, unknown>,
  callback?: ProgressCallback,
): void {
  if (!callback) return;
  callback({
    phase: "model",
    status: String(value.status || "loading"),
    file: typeof value.file === "string" ? value.file : undefined,
    loaded: typeof value.loaded === "number" ? value.loaded : undefined,
    total: typeof value.total === "number" ? value.total : undefined,
  });
}

class SemanticModelService {
  private pipeline?: FeatureExtractionPipeline;
  private loading?: Promise<FeatureExtractionPipeline>;

  async ensureModel(
    onProgress?: ProgressCallback,
  ): Promise<FeatureExtractionPipeline> {
    if (this.pipeline) return this.pipeline;
    if (this.loading) return this.loading;
    this.loading = this.load(onProgress);
    try {
      this.pipeline = await this.loading;
      return this.pipeline;
    } finally {
      this.loading = undefined;
    }
  }

  async embed(
    texts: string[],
    onProgress?: ProgressCallback,
  ): Promise<number[][]> {
    if (!texts.length) return [];
    const pipeline = await this.ensureModel(onProgress);
    const output = await pipeline(
      texts.map((text) => `query: ${text}`),
      {
        pooling: "mean",
        normalize: true,
        truncation: true,
        max_length: 512,
      },
    );
    const vectors = output.tolist();
    for (const vector of vectors) {
      if (vector.length !== SEMANTIC_VECTOR_DIMENSIONS) {
        throw new Error(
          `Unexpected semantic vector size ${vector.length}; expected ${SEMANTIC_VECTOR_DIMENSIONS}.`,
        );
      }
    }
    return vectors;
  }

  async test(onProgress?: ProgressCallback): Promise<number> {
    const [chinese, english] = await this.embed(
      [
        "绿色金融如何影响企业环境绩效",
        "How green finance affects corporate environmental performance",
      ],
      onProgress,
    );
    return cosineSimilarity(chinese, english);
  }

  async cacheSize(): Promise<number> {
    return modelCache.size();
  }

  async clear(): Promise<void> {
    this.pipeline = undefined;
    this.loading = undefined;
    await modelCache.clear();
  }

  private async load(
    onProgress?: ProgressCallback,
  ): Promise<FeatureExtractionPipeline> {
    Zotero.debug(`[ZCA Semantic] loading ${SEMANTIC_MODEL_ID}`);
    const moduleURL = `chrome://${addon.data.config.addonRef}/content/vendor/transformers.min.mjs`;
    const transformers = ChromeUtils.importESModule(
      moduleURL,
    ) as TransformersModule;
    transformers.env.allowLocalModels = false;
    transformers.env.allowRemoteModels = true;
    transformers.env.useBrowserCache = false;
    transformers.env.useFSCache = false;
    transformers.env.useCustomCache = true;
    transformers.env.customCache = modelCache;
    const vendorURL = `chrome://${addon.data.config.addonRef}/content/vendor/`;
    transformers.env.backends.onnx.wasm.wasmPaths = {
      mjs: `${vendorURL}ort-wasm-simd-threaded.mjs`,
      wasm: `${vendorURL}ort-wasm-simd-threaded.wasm`,
    };
    transformers.env.backends.onnx.wasm.numThreads = 1;
    transformers.env.backends.onnx.wasm.proxy = false;
    const pipeline = await transformers.pipeline(
      "feature-extraction",
      SEMANTIC_MODEL_ID,
      {
        dtype: SEMANTIC_MODEL_DTYPE,
        device: "wasm",
        progress_callback: (value) => progressValue(value, onProgress),
      },
    );
    Zotero.debug(`[ZCA Semantic] ${SEMANTIC_MODEL_ID} ready`);
    return pipeline;
  }
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (!left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (!leftNorm || !rightNorm) return 0;
  return dot / Math.sqrt(leftNorm * rightNorm);
}

export const semanticModelService = new SemanticModelService();
