interface CacheManifest {
  version: 1;
  entries: Record<string, string>;
}

function requestKey(request: unknown): string {
  if (typeof request === "string") return request;
  if (
    request &&
    typeof request === "object" &&
    "url" in request &&
    typeof request.url === "string"
  ) {
    return request.url;
  }
  return String(request);
}

export class ZoteroModelCache {
  readonly rootDir = PathUtils.join(
    PathUtils.profileDir,
    "zotero-classification-assistant",
    "model-cache",
  );

  private readonly manifestPath = PathUtils.join(this.rootDir, "manifest.json");

  private manifest?: CacheManifest;

  private async initialize(): Promise<CacheManifest> {
    if (this.manifest) return this.manifest;
    await IOUtils.makeDirectory(this.rootDir, {
      createAncestors: true,
      ignoreExisting: true,
    });
    try {
      const stored = (await IOUtils.readJSON(
        this.manifestPath,
      )) as CacheManifest;
      if (stored?.version === 1 && stored.entries) {
        this.manifest = stored;
        return stored;
      }
    } catch {
      // Missing or invalid cache metadata is rebuilt lazily.
    }
    this.manifest = { version: 1, entries: {} };
    return this.manifest;
  }

  async match(request: unknown): Promise<Response | undefined> {
    const key = requestKey(request);
    const manifest = await this.initialize();
    const filename = manifest.entries[key];
    if (!filename) return undefined;
    const path = PathUtils.join(this.rootDir, filename);
    if (!(await IOUtils.exists(path))) {
      delete manifest.entries[key];
      await this.saveManifest();
      return undefined;
    }
    const bytes = await IOUtils.read(path);
    return new Response(bytes, { status: 200 });
  }

  async put(request: unknown, response: Response): Promise<void> {
    const key = requestKey(request);
    const manifest = await this.initialize();
    const existing = manifest.entries[key];
    const filename =
      existing || `hf-${Zotero.Utilities.Internal.sha1(key)}.cache`;
    const bytes = new Uint8Array(await response.arrayBuffer());
    await IOUtils.write(PathUtils.join(this.rootDir, filename), bytes, {
      tmpPath: PathUtils.join(this.rootDir, `${filename}.tmp`),
    });
    manifest.entries[key] = filename;
    await this.saveManifest();
  }

  async size(): Promise<number> {
    const manifest = await this.initialize();
    let total = 0;
    for (const filename of new Set(Object.values(manifest.entries))) {
      try {
        total +=
          (await IOUtils.stat(PathUtils.join(this.rootDir, filename))).size ||
          0;
      } catch {
        // Ignore stale entries; match() will prune them when requested.
      }
    }
    return total;
  }

  async clear(): Promise<void> {
    await IOUtils.remove(this.rootDir, {
      recursive: true,
      ignoreAbsent: true,
      retryReadonly: true,
    });
    this.manifest = undefined;
  }

  private async saveManifest(): Promise<void> {
    if (!this.manifest) return;
    await IOUtils.writeJSON(this.manifestPath, this.manifest, {
      tmpPath: `${this.manifestPath}.tmp`,
    });
  }
}

export const modelCache = new ZoteroModelCache();
