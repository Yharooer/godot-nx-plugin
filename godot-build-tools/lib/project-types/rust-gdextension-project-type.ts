/**
 * Rust GDExtension Project Type Implementation
 * 
 * This project type handles Rust GDExtension projects by creating a build pipeline
 * that compiles Rust source code using Cargo and bundles the results into a
 * GDExtension format that can be consumed by Godot projects.
 */

import { ProjectType, BuildStep, BuildContext, ProjectTypeEnum } from '../core/interfaces';
import { RustCompilationStep, RustCompilationStepOptions } from '../build-steps/rust-compilation-step';
import { OrganizeCompiledBinariesStep, PlatformTarget } from '../build-steps/organize-compiled-binaries-step';
import { GDExtensionBundleStep, GDExtensionBundleStepOptions } from '../build-steps/gdextension-bundle-step';
import { GDExtensionAddonStep, GDExtensionAddonStepOptions } from '../build-steps/gdextension-addon-step';

/**
 * Options for the Rust GDExtension project type
 */
export interface RustGDExtensionProjectTypeOptions extends RustCompilationStepOptions, GDExtensionBundleStepOptions, GDExtensionAddonStepOptions {
  /** Entry symbol for the GDExtension (defaults to "gdext_rust_init") */
  readonly entrySymbol?: string;
}

/**
 * Project type implementation for Rust GDExtension projects
 */
export class RustGDExtensionProjectType implements ProjectType {
  readonly name = ProjectTypeEnum.GDEXTENSION;

  constructor(private readonly options: RustGDExtensionProjectTypeOptions = {}) {}

  createBuildPipeline(_context: BuildContext): readonly BuildStep[] {
    // Extract options for each step
    const compilationOptions: RustCompilationStepOptions = {
      ...(this.options.platforms && { platforms: this.options.platforms }),
      ...(this.options.targets && { targets: this.options.targets }),
      ...(this.options.compatibilityMinimum && { compatibilityMinimum: this.options.compatibilityMinimum }),
      ...(this.options.reloadable !== undefined && { reloadable: this.options.reloadable }),
      ...(this.options.linkType && { linkType: this.options.linkType })
    };

    const bundleOptions: GDExtensionBundleStepOptions = {
      entrySymbol: this.options.entrySymbol || 'gdext_rust_init',
      ...(this.options.compatibilityMinimum && { compatibilityMinimum: this.options.compatibilityMinimum }),
      ...(this.options.reloadable !== undefined && { reloadable: this.options.reloadable }),
      ...(this.options.dynamicDependencies && { dynamicDependencies: this.options.dynamicDependencies }),
      projectType: 'rust'
    };

    // Parse platform targets for the organize step
    const platforms = this.options.platforms || ['windows.x86_64', 'macos.universal', 'linux.x86_64'];
    const targets = this.options.targets || ['debug', 'release'];
    const platformTargets = this.parsePlatformTargets(platforms, targets);

    const addonOptions: GDExtensionAddonStepOptions = {
      ...(this.options.addonName && { addonName: this.options.addonName }),
      ...(this.options.createPluginConfig !== undefined && { createPluginConfig: this.options.createPluginConfig }),
      ...(this.options.pluginDescription && { pluginDescription: this.options.pluginDescription }),
      ...(this.options.pluginAuthor && { pluginAuthor: this.options.pluginAuthor }),
      ...(this.options.pluginVersion && { pluginVersion: this.options.pluginVersion })
    };

    return [
      new RustCompilationStep(compilationOptions),
      new OrganizeCompiledBinariesStep({
        projectType: 'rust',
        platformTargets
      }),
      new GDExtensionBundleStep(bundleOptions),
      new GDExtensionAddonStep(addonOptions)
    ];
  }



  /**
   * Parse platform specifications into platform targets
   */
  private parsePlatformTargets(platforms: readonly string[], targets: readonly string[]): PlatformTarget[] {
    const platformTargets: PlatformTarget[] = [];

    for (const platformSpec of platforms) {
      const [platform, architecture] = platformSpec.split('.');
      if (!platform || !architecture) {
        throw new Error(`Invalid platform specification: ${platformSpec}. Expected format: platform.architecture`);
      }

      for (const target of targets) {
        platformTargets.push({ platform, architecture, target });
      }
    }

    return platformTargets;
  }
}