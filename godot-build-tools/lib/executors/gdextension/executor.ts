/**
 * GDExtension Build Executor
 * 
 * This executor builds GDExtension projects (C++/Rust) by:
 * 1. Compiling the native code using the appropriate toolchain
 * 2. Bundling the compiled artifacts into a GDExtension format
 */

import * as fs from 'fs';
import * as path from 'path';
import { ExecutorContext } from '@nx/devkit';
import { BaseExecutor, BaseExecutorOptions, ExecutorResult, runExecutor } from '../base-executor';
import { BuildContext } from '../../core/interfaces';
import { ConfigurationError } from '../../core/errors';
import { RustGDExtensionProjectType } from '../../project-types/rust-gdextension-project-type';
import { DynamicDependency } from '../../build-steps/gdextension-bundle-step';

/**
 * Options for the gdextension executor
 */
export interface GDExtensionExecutorOptions extends BaseExecutorOptions {
  /** Clean the build directory before building */
  readonly cleanBuild?: boolean;
  /** Build targets (debug, release, or both) */
  readonly targets?: readonly string[];
  /** Platform targets to build for */
  readonly platforms?: readonly string[];
  /** Godot compatibility minimum version */
  readonly compatibilityMinimum?: string;
  /** Whether the extension should be reloadable */
  readonly reloadable?: boolean;
  /** Entry symbol for the GDExtension */
  readonly entrySymbol?: string;
  /** Dynamic linking options where possible */
  readonly linkType?: 'static' | 'dynamic';
  /** Dynamic dependencies to include in .gdextension file */
  readonly dynamicDependencies?: readonly DynamicDependency[];
  /** Custom addon name (defaults to project name) */
  readonly addonName?: string;
  /** Whether to create plugin.cfg file */
  readonly createPluginConfig?: boolean;
  /** Plugin description for plugin.cfg */
  readonly pluginDescription?: string;
  /** Plugin author for plugin.cfg */
  readonly pluginAuthor?: string;
  /** Plugin version for plugin.cfg */
  readonly pluginVersion?: string;
}

/**
 * GDExtension Build Executor implementation
 */
export class GDExtensionExecutor extends BaseExecutor<GDExtensionExecutorOptions> {
  protected async executeImpl(context: BuildContext): Promise<void> {
    this.logVerbose(`Building GDExtension project: ${context.projectName}`);
    this.logVerbose(`Project root: ${context.projectRoot}`);
    this.logVerbose(`Build directory: ${context.buildDir}`);

    // Step 0: Clean directories if requested
    if (this.options.cleanBuild ?? true) {
      this.log('Cleaning build directory...');
      await this.runCleanExecutor(true, false); // Clean build but not _addons
    }

    // Detect project type and create appropriate project type instance
    const projectType = this.detectProjectType(context);
    
    // Create build pipeline
    this.log('Creating build pipeline...');
    const pipeline = projectType.createBuildPipeline(context);
    
    this.logVerbose(`Build pipeline has ${pipeline.length} steps`);

    // Execute build pipeline
    for (let i = 0; i < pipeline.length; i++) {
      const step = pipeline[i];
      if (step) {
        this.log(`Step ${i + 1}/${pipeline.length}: ${step.name}`);
        await step.execute(context);
      }
    }

    this.log(`Successfully built GDExtension project: ${context.projectName}`);
  }

  /**
   * Detect the project type based on the project structure
   */
  private detectProjectType(context: BuildContext): RustGDExtensionProjectType {
    const projectRoot = context.projectRoot;
    
    // Check for Rust project indicators
    const hasCargoToml = fs.existsSync(path.join(projectRoot, 'Cargo.toml'));
    const hasRustSrc = fs.existsSync(path.join(projectRoot, 'src', 'lib.rs'));
    
    if (hasCargoToml || hasRustSrc) {
      this.logVerbose('Detected Rust GDExtension project');
      return new RustGDExtensionProjectType({
        ...(this.options.targets && { targets: this.options.targets }),
        ...(this.options.platforms && { platforms: this.options.platforms }),
        ...(this.options.compatibilityMinimum && { compatibilityMinimum: this.options.compatibilityMinimum }),
        ...(this.options.reloadable !== undefined && { reloadable: this.options.reloadable }),
        ...(this.options.entrySymbol && { entrySymbol: this.options.entrySymbol }),
        ...(this.options.linkType && { linkType: this.options.linkType }),
        ...(this.options.dynamicDependencies && { dynamicDependencies: this.options.dynamicDependencies }),
        ...(this.options.addonName && { addonName: this.options.addonName }),
        ...(this.options.createPluginConfig !== undefined && { createPluginConfig: this.options.createPluginConfig }),
        ...(this.options.pluginDescription && { pluginDescription: this.options.pluginDescription }),
        ...(this.options.pluginAuthor && { pluginAuthor: this.options.pluginAuthor }),
        ...(this.options.pluginVersion && { pluginVersion: this.options.pluginVersion })
      });
    }

    // TODO: Add C++ GDExtension detection in the future
    // const hasCMakeLists = fs.existsSync(path.join(projectRoot, 'CMakeLists.txt'));
    // const hasCppSrc = fs.existsSync(path.join(projectRoot, 'src'));
    
    throw new ConfigurationError(
      `Unable to detect GDExtension project type for ${context.projectName}. ` +
      'Expected to find Cargo.toml (Rust) or CMakeLists.txt (C++) in project root.',
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