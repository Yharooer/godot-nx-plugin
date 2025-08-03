/**
 * Shared utility functions for dependency resolution
 */

import * as path from 'path';
import { ProjectGraph, ProjectGraphProjectNode } from '@nx/devkit';
import { ProjectDependency, ProjectTypeEnum } from '../core/interfaces';
import { DependencyError, ConfigurationError } from '../core/errors';

/**
 * Resolve all transitive dependencies for a project with circular dependency detection
 * @param projectName Name of the project
 * @param graph NX project graph
 * @param workspaceRoot Path to workspace root
 * @returns Array of resolved dependencies
 */
export function resolveTransitiveDependencies(
  projectName: string,
  graph: ProjectGraph,
  workspaceRoot: string
): readonly ProjectDependency[] {
  const dependencies: ProjectDependency[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>(); // Track nodes currently being visited for cycle detection

  /**
   * Depth-first search to resolve dependencies with cycle detection
   */
  function visitProject(currentProject: string, dependencyPath: string[]): void {
    // Check if we're already visiting this project (cycle detection)
    if (visiting.has(currentProject)) {
      const cycleStart = dependencyPath.indexOf(currentProject);
      const cycle = [...dependencyPath.slice(cycleStart), currentProject];
      throw new DependencyError(
        `Circular dependency detected: ${cycle.join(' -> ')}`,
        projectName
      );
    }

    // Skip if already fully processed
    if (visited.has(currentProject)) {
      return;
    }

    // Mark as currently being visited
    visiting.add(currentProject);

    // Get direct dependencies
    const projectDependencies = graph.dependencies[currentProject] || [];
    
    for (const { target } of projectDependencies) {
      // Skip self-references
      if (target === projectName) continue;

      // Get the target project node
      const targetNode = graph.nodes[target];
      if (!targetNode) {
        throw new DependencyError(
          `Dependency project '${target}' not found in project graph`,
          projectName
        );
      }

      // Recursively visit the dependency
      visitProject(target, [...dependencyPath, currentProject]);

      // Add to dependencies if not already included and not the original project
      if (!dependencies.some(dep => dep.name === target)) {
        const buildDir = path.join(workspaceRoot, targetNode.data.root, 'build');
        
        dependencies.push({
          name: target,
          buildDir
        });
      }
    }

    // Mark as fully processed and remove from visiting set
    visiting.delete(currentProject);
    visited.add(currentProject);
  }

  // Start the dependency resolution from the root project
  visitProject(projectName, []);

  return dependencies;
}

/**
 * Get the project type from a project node
 * @param projectNode NX project graph node
 * @returns Project type enum value, or null if the project type is not supported
 */
export function getProjectType(projectNode: ProjectGraphProjectNode): ProjectTypeEnum | null {
  // Try to determine project type from project.json configuration
  const projectData = projectNode.data;
  
  // Check if there's a specific projectType field
  if (projectData.projectType) {
    // Validate that it's a known project type
    const projectType = projectData.projectType as string;
    if (Object.values(ProjectTypeEnum).includes(projectType as ProjectTypeEnum)) {
      return projectType as ProjectTypeEnum;
    }
  }

  // Try to infer from build target executor
  const buildTarget = projectData.targets?.['build'];
  if (buildTarget?.executor) {
    const executor = buildTarget.executor;
    
    // Map known executors to project types
    if (executor.includes('godot-library')) {
      return ProjectTypeEnum.GODOT_LIBRARY;
    } else if (executor.includes('gdextension')) {
      return ProjectTypeEnum.GDEXTENSION;
    } else if (executor.includes('godot-game')) {
      return ProjectTypeEnum.GODOT_GAME;
    }
  }

  // Return null if we can't determine a supported project type
  return null;
}

/**
 * Get the project type from a project node, throwing an error if unsupported
 * @param projectNode NX project graph node
 * @param projectName Project name for error context
 * @returns Project type enum value
 * @throws ConfigurationError if the project type is not supported
 */
export function getRequiredProjectType(projectNode: ProjectGraphProjectNode, projectName: string): ProjectTypeEnum {
  const projectType = getProjectType(projectNode);
  if (projectType === null) {
    throw new ConfigurationError(
      `Project '${projectName}' has an unsupported or unrecognized project type. ` +
      `Supported types are: ${Object.values(ProjectTypeEnum).join(', ')}`,
      projectName
    );
  }
  return projectType;
}

/**
 * Validate that all dependencies have been built
 * @param dependencies Array of project dependencies
 * @param projectName Name of the project for error context
 */
export function validateDependenciesBuilt(
  dependencies: readonly ProjectDependency[],
  projectName: string
): void {
  const missingDependencies: string[] = [];

  for (const dependency of dependencies) {
    // Check if the build directory exists
    const fs = require('fs');
    if (!fs.existsSync(dependency.buildDir)) {
      missingDependencies.push(dependency.name);
    }
  }

  if (missingDependencies.length > 0) {
    throw new DependencyError(
      `Missing build artifacts for dependencies: ${missingDependencies.join(', ')}. ` +
      `Please ensure these projects are built before building ${projectName}.`,
      projectName
    );
  }
}

/**
 * Get build outputs for a project from its configuration
 * @param projectNode NX project graph node
 * @param workspaceRoot Path to workspace root
 * @returns Array of build output paths
 */
export function getBuildOutputs(
  projectNode: ProjectGraphProjectNode,
  workspaceRoot: string
): readonly string[] {
  const buildTarget = projectNode.data.targets?.['build'];
  if (!buildTarget?.outputs) {
    return [];
  }

  return buildTarget.outputs.map(pattern => {
    // Replace NX tokens with actual paths
    return pattern
      .replace('{workspaceRoot}', workspaceRoot)
      .replace('{projectRoot}', projectNode.data.root);
  }).map(outputPath => {
    // Convert to absolute path if not already
    return path.isAbsolute(outputPath) ? outputPath : path.join(workspaceRoot, outputPath);
  });
}

/**
 * Filter build outputs to exclude specific patterns (like _addons)
 * @param outputs Array of output paths
 * @param excludePatterns Patterns to exclude
 * @returns Filtered array of output paths
 */
export function filterBuildOutputs(outputs: readonly string[], excludePatterns: readonly string[] = ['_addons']): readonly string[] {
  return outputs.filter(output => {
    return !excludePatterns.some(pattern => output.includes(pattern));
  });
}

/**
 * Validate project configuration for build system compatibility
 * @param projectNode NX project graph node
 * @param projectName Project name for error context
 */
export function validateProjectConfiguration(
  projectNode: ProjectGraphProjectNode,
  projectName: string
): void {
  const projectData = projectNode.data;

  // Check if project has a build target
  if (!projectData.targets?.['build']) {
    throw new ConfigurationError(
      `Project '${projectName}' does not have a build target configured`,
      projectName
    );
  }

  const buildTarget = projectData.targets['build'];

  // Check if build target has an executor
  if (!buildTarget.executor) {
    throw new ConfigurationError(
      `Build target for project '${projectName}' does not specify an executor`,
      projectName
    );
  }

  // Check if build target has outputs configured
  if (!buildTarget.outputs || buildTarget.outputs.length === 0) {
    throw new ConfigurationError(
      `Build target for project '${projectName}' does not specify any outputs`,
      projectName
    );
  }
}