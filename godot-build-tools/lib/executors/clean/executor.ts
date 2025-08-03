/**
 * Clean Executor
 * 
 * This executor cleans build artifacts and _addons directory.
 * It provides a convenient way to clean project outputs without using rm manually.
 */

import { ExecutorContext } from '@nx/devkit';
import { BaseExecutor, BaseExecutorOptions, ExecutorResult, runExecutor } from '../base-executor';
import { BuildContext } from '../../core/interfaces';
import { removeDirectory } from '../../utils/file-operations';
import { FileSystemError } from '../../core/errors';
import * as path from 'path';

/**
 * Options for the clean executor
 */
export interface CleanExecutorOptions extends BaseExecutorOptions {
  /** Clean the build directory */
  readonly cleanBuild?: boolean;
  /** Clean the _addons directory */
  readonly cleanAddons?: boolean;
}

/**
 * Clean Executor implementation
 */
export class CleanExecutor extends BaseExecutor<CleanExecutorOptions> {
  protected async executeImpl(context: BuildContext): Promise<void> {
    this.logVerbose(`Cleaning project: ${context.projectName}`);
    this.logVerbose(`Project root: ${context.projectRoot}`);

    const cleanBuild = this.options.cleanBuild ?? true;
    const cleanAddons = this.options.cleanAddons ?? true;

    try {
      // Clean build directory if requested
      if (cleanBuild) {
        this.log('Cleaning build directory...');
        await removeDirectory(context.buildDir, context.projectName);
        this.logVerbose(`Removed: ${context.buildDir}`);
      }

      // Clean _addons directory if requested
      if (cleanAddons) {
        const addonsDir = path.join(context.projectRoot, '_addons');
        this.log('Cleaning _addons directory...');
        await removeDirectory(addonsDir, context.projectName);
        this.logVerbose(`Removed: ${addonsDir}`);
      }

      if (!cleanBuild && !cleanAddons) {
        this.log('No cleaning requested (both cleanBuild and cleanAddons are false)');
        return;
      }

      this.log(`Successfully cleaned project: ${context.projectName}`);

    } catch (error) {
      throw new FileSystemError(
        `Failed to clean project: ${error instanceof Error ? error.message : String(error)}`,
        context.projectName,
        error instanceof Error ? error : undefined
      );
    }
  }
}

/**
 * Main executor function that NX will call
 */
export default async function runCleanExecutor(
  options: CleanExecutorOptions,
  context: ExecutorContext
): Promise<ExecutorResult> {
  return runExecutor(CleanExecutor, options, context);
}