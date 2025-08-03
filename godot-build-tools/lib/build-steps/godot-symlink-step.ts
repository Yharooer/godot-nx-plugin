/**
 * Godot Symlink Build Step
 * 
 * This step creates a build directory for a Godot project by symlinking all project files
 * except for excluded directories and files (_addons, .godot, project.godot).
 */


import { BuildStep, BuildContext } from '../core/interfaces';
import { FileSystemError } from '../core/errors';
import {
  ensureDirectoryExists,
  symlinkProjectFiles
} from '../utils/file-operations';

/**
 * Options for the Godot symlink step
 */
export interface GodotSymlinkStepOptions {
  /** Additional patterns to exclude from symlinking */
  readonly excludePatterns?: readonly string[];
}

/**
 * Default patterns to exclude when symlinking Godot project files
 */
const DEFAULT_EXCLUDE_PATTERNS = [
  '_addons',
  '.godot',
  'project.godot',
  'build',
  'node_modules',
  '.git',
  '.nx'
];

/**
 * Build step that symlinks Godot project files to the build directory
 */
export class GodotSymlinkStep implements BuildStep {
  readonly name = 'Godot Project Symlink';

  constructor(private readonly options: GodotSymlinkStepOptions = {}) { }

  async execute(context: BuildContext): Promise<void> {
    try {
      // Ensure build directory exists
      await ensureDirectoryExists(context.buildDir);

      // Combine default and custom exclude patterns
      const excludePatterns = [
        ...DEFAULT_EXCLUDE_PATTERNS,
        ...(this.options.excludePatterns || [])
      ];

      // Symlink project files to build directory
      await symlinkProjectFiles(
        context.projectRoot,
        context.buildDir,
        excludePatterns
      );

    } catch (error) {
      throw new FileSystemError(
        `Failed to create Godot project build directory: ${error instanceof Error ? error.message : String(error)}`,
        context.projectName,
        error instanceof Error ? error : undefined
      );
    }
  }
}