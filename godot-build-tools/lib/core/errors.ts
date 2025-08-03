/**
 * Error handling classes and categorization for the build system
 */

/**
 * Categories of build errors for better error handling and reporting
 */
export enum ErrorCategory {
  /** Configuration errors: Invalid project.json, missing dependencies */
  CONFIGURATION = 'configuration',
  /** File system errors: Permission issues, missing files */
  FILESYSTEM = 'filesystem',
  /** Dependency errors: Circular dependencies, missing build artifacts */
  DEPENDENCY = 'dependency',
  /** Compilation errors: TypeScript compilation failures */
  COMPILATION = 'compilation'
}

/**
 * Base error class for all build system errors
 */
export class BuildError extends Error {
  /**
   * Create a new build error
   * @param message Error message
   * @param category Error category for classification
   * @param projectName Optional project name where the error occurred
   * @param cause Optional underlying error that caused this error
   */
  constructor(
    message: string,
    public readonly category: ErrorCategory,
    public readonly projectName?: string,
    public override readonly cause?: Error
  ) {
    super(message);
    this.name = 'BuildError';
    
    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BuildError);
    }
  }

  /**
   * Get a formatted error message with context
   */
  getFormattedMessage(): string {
    const prefix = this.projectName ? `[${this.projectName}]` : '';
    const categoryPrefix = `[${this.category.toUpperCase()}]`;
    return `${prefix} ${categoryPrefix} ${this.message}`;
  }
}

/**
 * Configuration error - thrown when there are issues with project configuration
 */
export class ConfigurationError extends BuildError {
  constructor(message: string, projectName?: string, cause?: Error) {
    super(message, ErrorCategory.CONFIGURATION, projectName, cause);
    this.name = 'ConfigurationError';
  }
}

/**
 * File system error - thrown when there are file system related issues
 */
export class FileSystemError extends BuildError {
  constructor(message: string, projectName?: string, cause?: Error) {
    super(message, ErrorCategory.FILESYSTEM, projectName, cause);
    this.name = 'FileSystemError';
  }
}

/**
 * Dependency error - thrown when there are dependency resolution issues
 */
export class DependencyError extends BuildError {
  constructor(message: string, projectName?: string, cause?: Error) {
    super(message, ErrorCategory.DEPENDENCY, projectName, cause);
    this.name = 'DependencyError';
  }
}

/**
 * Compilation error - thrown when there are compilation issues
 */
export class CompilationError extends BuildError {
  constructor(message: string, projectName?: string, cause?: Error) {
    super(message, ErrorCategory.COMPILATION, projectName, cause);
    this.name = 'CompilationError';
  }
}