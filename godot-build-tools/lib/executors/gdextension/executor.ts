/**
 * GDExtension Build Executor
 * 
 * This executor builds GDExtension projects (C++/Rust) by:
 * 1. Compiling the native code
 * 2. Bundling the compiled artifacts into the build directory
 * 
 * Note: This is a placeholder implementation for future GDExtension support
 */

import { ExecutorContext } from '@nx/devkit';
import { BaseExecutor, BaseExecutorOptions, ExecutorResult, runExecutor } from '../base-executor';
import { BuildContext } from '../../core/interfaces';
import { ConfigurationError } from '../../core/errors';

/**
 * Options for the gdextension executor
 */
export interface GDExtensionExecutorOptions extends BaseExecutorOptions {
  /** Clean the build directory before building */
  readonly cleanBuild?: boolean;
  /** Build type (debug or release) */
  readonly buildType?: 'debug' | 'release';
  /** Target platform (auto-detected if not specified) */
  readonly target?: string;
}

/**
 * GDExtension Build Executor implementation
 */
export class GDExtensionExecutor extends BaseExecutor<GDExtensionExecutorOptions> {
  protected async executeImpl(context: BuildContext): Promise<void> {
    // This is a placeholder implementation for future GDExtension support
    throw new ConfigurationError(
      'GDExtension build support is not yet implemented. ' +
      'This executor is reserved for future C++/Rust GDExtension project support.',
      context.projectName
    );
  }
}

/**
 * Main executor function that NX will call
 */
export default async function runGDExtensionExecutor(
  options: GDExtensionExecutorOptions,
  context: ExecutorContext
): Promise<ExecutorResult> {
  return runExecutor(GDExtensionExecutor, options, context);
}