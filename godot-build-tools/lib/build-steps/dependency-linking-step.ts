/**
 * Dependency Linking Build Step
 * 
 * This step links project dependencies to the _addons directory by creating symlinks
 * to the build directories of dependency projects.
 */

import * as path from 'path';
import { BuildStep, BuildContext } from '../core/interfaces';
import { FileSystemError } from '../core/errors';
import { ensureDirectoryExists, createSymlink } from '../utils/file-operations';

/**
 * Options for the dependency linking step
 */
export interface DependencyLinkingStepOptions {
  // No options needed - cleaning is handled by the clean executor
}

/**
 * Build step that links project dependencies to the _addons directory
 */
export class DependencyLinkingStep implements BuildStep {
  readonly name = 'Dependency Linking';

  constructor() {
    // No options needed - cleaning is handled by the clean executor
  }

  async execute(context: BuildContext): Promise<void> {
    const addonsDir = path.join(context.projectRoot, '_addons');

    try {
      // Ensure _addons directory exists
      await ensureDirectoryExists(addonsDir);

      // Link each dependency
      for (const dependency of context.dependencies) {
        await this.linkDependency(dependency.name, dependency.buildDir, addonsDir);
      }

    } catch (error) {
      throw new FileSystemError(
        `Failed to link dependencies: ${error instanceof Error ? error.message : String(error)}`,
        context.projectName,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Link a single dependency to the _addons directory
   */
  private async linkDependency(dependencyName: string, buildDir: string, addonsDir: string): Promise<void> {
    const linkPath = path.join(addonsDir, dependencyName);
    
    try {
      await createSymlink(buildDir, linkPath);
    } catch (error) {
      throw new FileSystemError(
        `Failed to link dependency '${dependencyName}' from '${buildDir}' to '${linkPath}': ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }
}