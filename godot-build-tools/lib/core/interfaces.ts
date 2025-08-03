/**
 * Core interfaces for the NX Godot Build System
 */

/**
 * Supported project types in the build system
 */
export enum ProjectTypeEnum {
  /** Standard Godot library project */
  GODOT_LIBRARY = 'godot-library',
  /** GDExtension C++ project */
  GDEXTENSION = 'gdextension',
  /** Godot game project */
  GODOT_GAME = 'godot-game'
}

/**
 * Information about a project dependency
 */
export interface ProjectDependency {
  /** The name of the dependency project */
  readonly name: string;
  /** Path to the dependency's build directory */
  readonly buildDir: string;
}

/**
 * Build context containing information available to all build steps
 */
export interface BuildContext {
  /** The name of the project being built */
  readonly projectName: string;
  /** Path to the project root directory */
  readonly projectRoot: string;
  /** Path to the workspace root directory */
  readonly workspaceRoot: string;
  /** Path to the build directory (always {projectRoot}/build) */
  readonly buildDir: string;
  /** List of project dependencies */
  readonly dependencies: ProjectDependency[];
  /** Executor options passed from project.json */
  readonly options: Record<string, any>;
}

/**
 * Generic build step interface that can be chained in a build pipeline
 */
export interface BuildStep {
  /** Human-readable name of the build step */
  readonly name: string;

  /**
   * Execute the build step
   * @param context Build context containing project information
   */
  execute(context: BuildContext): Promise<void>;
}

/**
 * Project type interface that defines the build pipeline for a specific project type
 */
export interface ProjectType {
  /** The name of the project type */
  readonly name: ProjectTypeEnum;

  /**
   * Create the build pipeline for this project type
   * @param context Build context containing project information
   * @returns Array of build steps to execute in order
   */
  createBuildPipeline(context: BuildContext): readonly BuildStep[];
}