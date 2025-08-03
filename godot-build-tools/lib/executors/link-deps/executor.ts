/**
 * Link Dependencies Executor
 * 
 * This executor links project dependencies to the _addons directory.
 * It can be used standalone for IDE preparation or as part of other build pipelines.
 */

import { ExecutorContext } from '@nx/devkit';
import { BaseExecutor, BaseExecutorOptions, ExecutorResult, runExecutor } from '../base-executor';
import { BuildContext } from '../../core/interfaces';
import { DependencyLinkingStep } from '../../build-steps/dependency-linking-step';

/**
 * Options for the link-deps executor
 */
export interface LinkDepsExecutorOptions extends BaseExecutorOptions {
  /** Clean the _addons directory before linking */
  readonly cleanBuild?: boolean;
}

/**
 * Link Dependencies Executor implementation
 */
export class LinkDepsExecutor extends BaseExecutor<LinkDepsExecutorOptions> {
  protected async executeImpl(context: BuildContext): Promise<void> {
    this.logVerbose(`Linking dependencies for project: ${context.projectName}`);
    this.logVerbose(`Found ${context.dependencies.length} dependencies to link`);

    // Clean _addons directory if requested
    if (this.options.cleanBuild ?? true) {
      this.log('Cleaning _addons directory...');
      await this.runCleanExecutor(false, true);
    }

    // Create and execute the dependency linking step
    const linkingStep = new DependencyLinkingStep();

    await linkingStep.execute(context);

    this.log(`Successfully linked ${context.dependencies.length} dependencies to _addons directory`);
  }
}

/**
 * Main executor function that NX will call
 */
export default async function runLinkDepsExecutor(
  options: LinkDepsExecutorOptions,
  context: ExecutorContext
): Promise<ExecutorResult> {
  return runExecutor(LinkDepsExecutor, options, context);
}