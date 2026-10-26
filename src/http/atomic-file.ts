import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface AtomicFileOptions {
  /** Modification time to set, in whole seconds since the epoch. */
  mtimeSeconds?: number;
}

/**
 * Writes `dest` through a temporary file next to it, which replaces `dest`
 * only once `fill` has finished; on any failure the temporary file is removed
 * and `dest` is left as it was. The file is created with mode 0666 minus the
 * umask, as a plain new file would be. It replaces a file or symlink at
 * `dest`, without keeping that file's permissions.
 */
export async function writeFileAtomically<T>(
  dest: string,
  fill: (write: (chunk: Buffer) => Promise<void>) => Promise<T>,
  options: AtomicFileOptions = {},
): Promise<T> {
  const temp = path.join(path.dirname(dest), `.${path.basename(dest)}.${randomBytes(8).toString('hex')}.tmp`);
  const handle = await fs.open(temp, 'wx', 0o666);
  let committed = false;
  const write = async (chunk: Buffer) => {
    for (let offset = 0; offset < chunk.length; ) {
      const { bytesWritten } = await handle.write(chunk, offset, chunk.length - offset);
      if (bytesWritten <= 0) throw new Error('the file accepted no data');
      offset += bytesWritten;
    }
  };
  try {
    const result = await fill(write);
    await handle.sync();
    if (options.mtimeSeconds !== undefined) {
      await handle.utimes(options.mtimeSeconds, options.mtimeSeconds);
    }
    await handle.close();
    await fs.rename(temp, dest);
    committed = true;
    return result;
  } finally {
    if (!committed) {
      await handle.close().catch(() => undefined);
      await fs.unlink(temp).catch(() => undefined);
    }
  }
}
