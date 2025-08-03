/**
 * Base executor class with common functionality for all NX executors
 */

import { ExecutorContext, ProjectGraph, readCachedProjectGraph } from '@nx/devkit';
import { BuildContext, ProjectDependency } from '../core/interfaces';
import { BuildError, ConfigurationError, DependencyError } from '../core/errors';
import { 
  resolveTransitiveDependencies, 
  validateProjectConfiguration,
  validateDependenciesBuilt 
} from '../utils/dependency-resolution';
import * as path from 'path';

/**
 * Base options that all executors should support
 */
export interface BaseExecutorOptions {
  /** Skip dependency validation (useful for development) */
  readonly skipDependencyValidation?: boolean;
  /** Enable verbose logging */
  readonly verbose?: boolean;
}

/**
 * Result of executor execution
 */
export interface ExecutorResult {
  /** Whether the execution was successful */
  success: boolean;
  /** Optional error message if execution failed */
  error?: string;
}

/**
 * Base executor class that provides common functionality for all executors
 */
export abstract class BaseExecutor<T extends BaseExecutorOptions = BaseExecutorOptions> {
  protected readonly context: ExecutorContext;
  protected readonly options: T;
  protected readonly projectGraph: ProjectGraph;

  constructor(options: T, context: ExecutorContext) {
    this.options = options;
    this.context = context;
    this.projectGraph = readCachedProjectGraph();
  }

  /**
   * Execute the executor
   * @returns Promise resolving to execution result
   */
  async execute(): Promise<ExecutorResult> {
    try {
      // Validate that we have a project name
      if (!this.context.projectName) {
        throw new ConfigurationError('No project name provided in executor context');
      }

      // Get the project node from the graph
      const projectNode = this.projectGraph.nodes[this.context.projectName];
      if (!projectNode) {
        throw new ConfigurationError(
          `Project '${this.context.projectName}' not found in project graph`,
          this.context.projectName
        );
      }

      // Validate project configuration
      validateProjectConfiguration(projectNode, this.context.projectName);

      // Create build context
      const buildContext = await this.createBuildContext();

      // Log execution start
      this.log(`Starting execution for project: ${this.context.projectName}`);

      // Execute the specific implementation
      await this.executeImpl(buildContext);

      this.log(`Successfully completed execution for project: ${this.context.projectName}`);
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Log the error with context
      if (error instanceof BuildError) {
        console.error(error.getFormattedMessage());
      } else {
        console.error(`[${this.context.projectName}] ${errorMessage}`);
      }

      // Log stack trace in verbose mode
      if (this.options.verbose && error instanceof Error && error.stack) {
        console.error(error.stack);
      }

      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }

  /**
   * Create build context from executor context and project graph
   */
  protected async createBuildContext(): Promise<BuildContext> {
    if (!this.context.projectName) {
      throw new ConfigurationError('No project name provided in executor context');
    }

    const projectNode = this.projectGraph.nodes[this.context.projectName];
    if (!projectNode) {
      throw new ConfigurationError(
        `Project '${this.context.projectName}' not found in project graph`,
        this.context.projectName
      );
    }

    // Resolve dependencies
    const dependencies = await this.resolveDependencies();

    // Validate dependencies are built (unless skipped)
    if (!this.options.skipDependencyValidation) {
      validateDependenciesBuilt(dependencies, this.context.projectName);
    }

    const projectRoot = path.join(this.context.root, projectNode.data.root);
    const buildDir = path.join(projectRoot, 'build');

    return {
      projectName: this.context.projectName,
      projectRoot,
      workspaceRoot: this.context.root,
      buildDir,
      dependencies,
      options: this.options
    };
  }

  /**
   * Resolve project dependencies using NX project graph
   */
  protected async resolveDependencies(): Promise<readonly ProjectDependency[]> {
    if (!this.context.projectName) {
      throw new ConfigurationError('No project name provided in executor context');
    }

    try {
      return resolveTransitiveDependencies(
        this.context.projectName,
        this.projectGraph,
        this.context.root
      );
    } catch (error) {
      if (error instanceof DependencyError) {
        throw error;
      }
      throw new DependencyError(
        `Failed to resolve dependencies: ${error instanceof Error ? error.message : String(error)}`,
        this.context.projectName,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get the current project node from the graph
   */
  protected getProjectNode() {
    if (!this.context.projectName) {
      throw new ConfigurationError('No project name provided in executor context');
    }

    const projectNode = this.projectGraph.nodes[this.context.projectName];
    if (!projectNode) {
      throw new ConfigurationError(
        `Project '${this.context.projectName}' not found in project graph`,
        this.context.projectName
      );
    }

    return projectNode;
  }

  /**
   * Log a message with project context
   */
  protected log(message: string): void {
    const prefix = this.context.projectName ? `[${this.context.projectName}]` : '';
    console.log(`${prefix} ${message}`);
  }

  /**
   * Log a verbose message (only if verbose mode is enabled)
   */
  protected logVerbose(message: string): void {
    if (this.options.verbose) {
      this.log(`[VERBOSE] ${message}`);
    }
  }

  /**
   * Run the clean executor with the specified options
   */
  protected async runCleanExecutor(cleanBuild: boolean = true, cleanAddons: boolean = true): Promise<void> {
    const { CleanExecutor } = await import('./clean/executor');
    
    const cleanExecutor = new CleanExecutor(
      {
        cleanBuild,
        cleanAddons,
        skipDependencyValidation: this.options.skipDependencyValidation ?? false,
        verbose: this.options.verbose ?? false
      },
      this.context
    );

    const result = await cleanExecutor.execute();
    if (!result.success) {
      throw new ConfigurationError(
        `Clean operation failed: ${result.error || 'Unknown error'}`,
        this.context.projectName
      );
    }
  }

  /**
   * Abstract method that subclasses must implement for their specific execution logic
   */
  protected abstract executeImpl(context: BuildContext): Promise<void>;
}

/**
 * Helper function to create and execute an executor
 */
export async function runExecutor<T extends BaseExecutorOptions>(
  ExecutorClass: new (options: T, context: ExecutorContext) => BaseExecutor<T>,
  options: T,
  context: ExecutorContext
): Promise<ExecutorResult> {
  const executor = new ExecutorClass(options, context);
  return executor.execute();
}