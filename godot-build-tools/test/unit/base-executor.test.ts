/**
 * Unit tests for BaseExecutor
 */

import { ExecutorContext, ProjectGraph } from '@nx/devkit';
import { BaseExecutor, BaseExecutorOptions } from '../../lib/executors/base-executor';
import { BuildContext } from '../../lib/core/interfaces';
import { ConfigurationError, DependencyError } from '../../lib/core/errors';

// Mock dependencies
jest.mock('@nx/devkit', () => ({
  readCachedProjectGraph: jest.fn(),
}));

jest.mock('../../lib/utils/dependency-resolution', () => ({
  resolveTransitiveDependencies: jest.fn(),
  validateProjectConfiguration: jest.fn(),
  validateDependenciesBuilt: jest.fn(),
}));

import { readCachedProjectGraph } from '@nx/devkit';
import {
  resolveTransitiveDependencies,
  validateProjectConfiguration,
  validateDependenciesBuilt,
} from '../../lib/utils/dependency-resolution';

const mockReadCachedProjectGraph = readCachedProjectGraph as jest.MockedFunction<typeof readCachedProjectGraph>;
const mockResolveTransitiveDependencies = resolveTransitiveDependencies as jest.MockedFunction<typeof resolveTransitiveDependencies>;
const mockValidateProjectConfiguration = validateProjectConfiguration as jest.MockedFunction<typeof validateProjectConfiguration>;
const mockValidateDependenciesBuilt = validateDependenciesBuilt as jest.MockedFunction<typeof validateDependenciesBuilt>;

// Test implementation of BaseExecutor
class TestExecutor extends BaseExecutor<BaseExecutorOptions> {
  public executeImplCalled = false;
  public receivedContext: BuildContext | null = null;

  protected async executeImpl(context: BuildContext): Promise<void> {
    this.executeImplCalled = true;
    this.receivedContext = context;
  }

  // Expose protected methods for testing
  public async testCreateBuildContext(): Promise<BuildContext> {
    return this.createBuildContext();
  }

  public async testRunCleanExecutor(cleanBuild: boolean = true, cleanAddons: boolean = true): Promise<void> {
    return this.runCleanExecutor(cleanBuild, cleanAddons);
  }
}

describe('BaseExecutor', () => {
  let mockContext: ExecutorContext;
  let mockProjectGraph: ProjectGraph;
  let executor: TestExecutor;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    mockProjectGraph = {
      nodes: {
        'test-project': {
          name: 'test-project',
          type: 'lib',
          data: {
            root: 'test-project',
            targets: {
              build: {
                executor: '@yharooer/godot-build-tools:godot-library',
                outputs: ['{projectRoot}/build'],
              },
            },
          },
        },
      },
      dependencies: {
        'test-project': [],
      },
    };

    mockContext = {
      root: '/workspace',
      projectName: 'test-project',
      targetName: 'build',
      configurationName: undefined,
      target: {
        executor: '@yharooer/godot-build-tools:godot-library',
      },
      workspace: {
        version: 2,
        projects: {
          'test-project': {
            root: 'test-project',
          },
        },
      },
    };

    mockReadCachedProjectGraph.mockReturnValue(mockProjectGraph);
    mockResolveTransitiveDependencies.mockReturnValue([]);
    mockValidateProjectConfiguration.mockImplementation(() => {});
    mockValidateDependenciesBuilt.mockImplementation(() => {});

    executor = new TestExecutor({ verbose: false }, mockContext);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with options and context', () => {
      const options = { verbose: true, skipDependencyValidation: true };
      const testExecutor = new TestExecutor(options, mockContext);

      expect(testExecutor).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should successfully execute with valid project', async () => {
      const result = await executor.execute();

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(executor.executeImplCalled).toBe(true);
      expect(executor.receivedContext).toBeDefined();
    });

    it('should validate project configuration', async () => {
      await executor.execute();

      expect(mockValidateProjectConfiguration).toHaveBeenCalledWith(
        mockProjectGraph.nodes['test-project'],
        'test-project'
      );
    });

    it('should resolve dependencies', async () => {
      await executor.execute();

      expect(mockResolveTransitiveDependencies).toHaveBeenCalledWith(
        'test-project',
        mockProjectGraph,
        '/workspace'
      );
    });

    it('should validate dependencies are built by default', async () => {
      await executor.execute();

      expect(mockValidateDependenciesBuilt).toHaveBeenCalledWith([], 'test-project');
    });

    it('should skip dependency validation when skipDependencyValidation is true', async () => {
      const testExecutor = new TestExecutor({ skipDependencyValidation: true }, mockContext);

      await testExecutor.execute();

      expect(mockValidateDependenciesBuilt).not.toHaveBeenCalled();
    });

    it('should return error when project name is missing', async () => {
      const contextWithoutProject = { ...mockContext, projectName: undefined };
      const testExecutor = new TestExecutor({}, contextWithoutProject);

      const result = await testExecutor.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No project name provided');
    });

    it('should return error when project is not found in graph', async () => {
      const contextWithMissingProject = { ...mockContext, projectName: 'missing-project' };
      const testExecutor = new TestExecutor({}, contextWithMissingProject);

      const result = await testExecutor.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found in project graph');
    });

    it('should handle configuration errors', async () => {
      mockValidateProjectConfiguration.mockImplementation(() => {
        throw new ConfigurationError('Invalid configuration', 'test-project');
      });

      const result = await executor.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid configuration');
    });

    it('should handle dependency errors', async () => {
      mockResolveTransitiveDependencies.mockImplementation(() => {
        throw new DependencyError('Circular dependency', 'test-project');
      });

      const result = await executor.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Circular dependency');
    });

    it('should log verbose messages when verbose is enabled', async () => {
      const verboseExecutor = new TestExecutor({ verbose: true }, mockContext);
      const logSpy = jest.spyOn(console, 'log');

      await verboseExecutor.execute();

      // Check that verbose logging was called in the test executor
      expect(verboseExecutor.executeImplCalled).toBe(true);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[test-project]'));
    });
  });

  describe('createBuildContext', () => {
    it('should create valid build context', async () => {
      const context = await executor.testCreateBuildContext();

      expect(context).toEqual({
        projectName: 'test-project',
        projectRoot: '/workspace/test-project',
        workspaceRoot: '/workspace',
        buildDir: '/workspace/test-project/build',
        dependencies: [],
        options: { verbose: false },
      });
    });

    it('should include resolved dependencies in context', async () => {
      const mockDependencies = [
        { name: 'dep1', buildDir: '/workspace/dep1/build' },
      ];
      mockResolveTransitiveDependencies.mockReturnValue(mockDependencies);

      const context = await executor.testCreateBuildContext();

      expect(context.dependencies).toEqual(mockDependencies);
    });
  });

  describe('runCleanExecutor', () => {
    it('should be defined as a method', () => {
      expect(typeof executor.testRunCleanExecutor).toBe('function');
    });
  });

  describe('logging methods', () => {
    it('should log messages with project context', async () => {
      const logSpy = jest.spyOn(console, 'log');

      await executor.execute();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[test-project]'));
    });

    it('should not log verbose messages when verbose is disabled', async () => {
      const logSpy = jest.spyOn(console, 'log');

      await executor.execute();

      const verboseCalls = logSpy.mock.calls.filter(call => 
        call[0].includes('[VERBOSE]')
      );
      expect(verboseCalls).toHaveLength(0);
    });
  });
});