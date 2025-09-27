/**
 * Temporary directory utilities for tests
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Create a temporary directory for testing
 */
export async function createTempDirectory(): Promise<string> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-build-tools-test-'));
  return tempDir;
}

/**
 * Clean up a temporary directory
 */
export async function cleanupTempDirectory(tempDir: string): Promise<void> {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}