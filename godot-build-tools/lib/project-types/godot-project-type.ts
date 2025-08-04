/**
 * Godot Project Type Implementation
 * 
 * This project type handles Godot library projects by creating a build pipeline
 * that links dependencies and symlinks project files to the build directory.
 */

import { ProjectType, BuildStep, BuildContext, ProjectTypeEnum } from '../core/interfaces';
import { DependencyLinkingStep } from '../build-steps/dependency-linking-step';
import { GodotSymlinkStep } from '../build-steps/godot-symlink-step';

/**
 * Options for the Godot project type
 */
export interface GodotProjectTypeOptions {
  /** Additional patterns to exclude from symlinking */
  readonly excludePatterns?: readonly string[];
}

/**
 * Project type implementation for Godot library projects
 */
export class GodotProjectType implements ProjectType {
  readonly name = ProjectTypeEnum.GODOT_LIBRARY;

  constructor(private readonly options: GodotProjectTypeOptions = {}) {}

  createBuildPipeline(_context: BuildContext): readonly BuildStep[] {
    return [
      new DependencyLinkingStep(),
      new GodotSymlinkStep(
        this.options.excludePatterns ? { excludePatterns: this.options.excludePatterns } : {}
      )
    ];
  }
}