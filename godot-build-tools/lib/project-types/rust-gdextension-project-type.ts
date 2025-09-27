/**
 * Rust GDExtension Project Type Implementation
 * 
 * This project type handles Rust GDExtension projects by creating a build pipeline
 * that compiles Rust source code using Cargo and bundles the results into a
 * GDExtension format that can be consumed by Godot projects.
 */

import { ProjectType, BuildStep, BuildContext, ProjectTypeEnum } from '../core/interfaces';
import { RustCompilationStep, RustCompilationStepOptions } from '../build-steps/rust-compilation-step';
import { GDExtensionBundleStep, GDExtensionBundleStepOptions } from '../build-steps/gdextension-bundle-step';

/**
 * Options for the Rust GDExtension project type
 */
export interface RustGDExtensionProjectTypeOptions extends RustCompilationStepOptions, GDExtensionBundleStepOptions {
  /** Entry symbol for the GDExtension (defaults to project name + "_init") */
  readonly entrySymbol?: string;
}

/**
 * Project type implementation for Rust GDExtension projects
 */
export class RustGDExtensionProjectType implements ProjectType {
  readonly name = ProjectTypeEnum.GDEXTENSION;

  constructor(private readonly options: RustGDExtensionProjectTypeOptions = {}) {}

  createBuildPipeline(context: BuildContext): readonly BuildStep[] {
    // Extract options for each step
    const compilationOptions: RustCompilationStepOptions = {
      ...(this.options.platforms && { platforms: this.options.platforms }),
      ...(this.options.targets && { targets: this.options.targets }),
      ...(this.options.compatibilityMinimum && { compatibilityMinimum: this.options.compatibilityMinimum }),
      ...(this.options.reloadable !== undefined && { reloadable: this.options.reloadable }),
      ...(this.options.linkType && { linkType: this.options.linkType })
    };

    const bundleOptions: GDExtensionBundleStepOptions = {
      entrySymbol: this.options.entrySymbol || this.generateDefaultEntrySymbol(context.projectName),
      ...(this.options.compatibilityMinimum && { compatibilityMinimum: this.options.compatibilityMinimum }),
      ...(this.options.reloadable !== undefined && { reloadable: this.options.reloadable }),
      projectType: 'rust'
    };

    return [
      new RustCompilationStep(compilationOptions),
      new GDExtensionBundleStep(bundleOptions)
    ];
  }

  /**
   * Generate default entry symbol based on project name
   */
  private generateDefaultEntrySymbol(projectName: string): string {
    // Convert kebab-case to snake_case and add _init suffix
    const symbolName = projectName.replace(/-/g, '_');
    return `${symbolName}_init`;
  }
}