/**
 * Godot Library Build Executor
 * 
 * This executor builds Godot library projects by:
 * 1. Linking dependencies to _addons directory
 * 2. Symlinking project files to build directory (excluding _addons, .godot, project.godot)
 */

import { ExecutorContext } from '@nx/devkit';
import { BaseExecutor, BaseExecutorOptions, ExecutorResult, runExecutor } from '../base-executor';
import { BuildContext } from '../../core/interfaces';
import { DependencyLinkingStep } from '../../build-steps/dependency-linking-step';
import { GodotSymlinkStep } from '../../build-steps/godot-symlink-step';

/**
 * Options for the godot-library executor
 */
export interface GodotLibraryExecutorOptions extends BaseExecutorOptions {
  /** Clean the build and _addons directories before building */
  readonly cleanBuild?: boolean;
}

/**
 * Godot Library Build Executor implementation
 */
export class GodotLibraryExecutor extends BaseExecutor<GodotLibraryExecutorOptions> {
  protected async executeImpl(context: BuildContext): Promise<void> {
    this.logVerbose(`Building Godot library project: ${context.projectName}`);
    this.logVerbose(`Project root: ${context.projectRoot}`);
    this.logVerbose(`Build directory: ${context.buildDir}`);
    this.logVerbose(`Found ${context.dependencies.length} dependencies`);

    // Step 0: Clean directories if requested
    if (this.options.cleanBuild ?? true) {
      this.log('Cleaning build and _addons directories...');
      await this.runCleanExecutor(true, true);
    }

    // Step 1: Link dependencies to _addons directory
    this.log('Linking dependencies...');
    const linkingStep = new DependencyLinkingStep();
    await linkingStep.execute(context);

    // Step 2: Symlink project files to build directory
    this.log('Creating build directory...');
    const symlinkStep = new GodotSymlinkStep();
    await symlinkStep.execute(context);

    this.log(`Successfully built Godot library project: ${context.projectName}`);
  }
}

/**
 * Main executor function that NX will call
 */
export default async function runGodotLibraryExecutor(
  options: GodotLibraryExecutorOptions,
  context: ExecutorContext
): Promise<ExecutorResult> {
  return runExecutor(GodotLibraryExecutor, options, context);
}