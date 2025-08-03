/**
 * Unit tests for GodotLibraryExecutor
 */

import { ExecutorContext } from '@nx/devkit';
import { GodotLibraryExecutor, GodotLibraryExecutorOptions } from '../../lib/executors/godot-library/executor';
import { BuildContext } from '../../lib/core/interfaces';

// Mock build steps
jest.mock('../../lib/build-steps/dependency-linking-step', () => ({
  DependencyLinkingStep: jest.fn(),
}));

jest.mock('../../lib/build-steps/godot-symlink-step', () => ({
  GodotSymlinkStep: jest.fn(),
}));

// Mock base executor dependencies
jest.mock('@nx/devkit', () => ({
  readCachedProjectGraph: jest.fn(),
}));

jest.mock('../../lib/utils/dependency-resolution', () => ({
  resolveTransitiveDependencies: jest.fn(),
  validateProjectConfiguration: jest.fn(),
  validateDependenciesBuilt: jest.fn(),
}));

import { DependencyLinkingStep } from '../../lib/build-steps/dependency-linking-step';
import { GodotSymlinkStep } from '../../lib/build-steps/godot-symlink-step';
import { readCachedProjectGraph } from '@nx/devkit';
import {
  resolveTransitiveDependencies,
  validateProjectConfiguration,
  validateDependenciesBuilt,
} from '../../lib/utils/dependency-resolution';

const MockDependencyLinkingStep = DependencyLinkingStep as jest.MockedClass<typeof DependencyLinkingStep>;
const MockGodotSymlinkStep = GodotSymlinkStep as jest.MockedClass<typeof GodotSymlinkStep>;
const mockReadCachedProjectGraph = readCachedProjectGraph as jest.MockedFunction<typeof readCachedProjectGraph>;
const mockResolveTransitiveDependencies = resolveTransitiveDependencies as jest.MockedFunction<typeof resolveTransitiveDependencies>;
const mockValidateProjectConfiguration = validateProjectConfiguration as jest.MockedFunction<typeof validateProjectConfiguration>;
const mockValidateDependenciesBuilt = validateDependenciesBuilt as jest.MockedFunction<typeof validateDependenciesBuilt>;

describe('GodotLibraryExecutor', () => {
  let mockContext: ExecutorContext;
  let mockProjectGraph: any;
  let mockLinkingStep: any;
  let mockSymlinkStep: any;

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

    // Mock build steps
    mockLinkingStep = {
      execute: jest.fn().mockResolvedValue(undefined),
    };
    mockSymlinkStep = {
      execute: jest.fn().mockResolvedValue(undefined),
    };

    MockDependencyLinkingStep.mockImplementation(() => mockLinkingStep);
    MockGodotSymlinkStep.mockImplementation(() => mockSymlinkStep);

    // Mock base executor dependencies
    mockReadCachedProjectGraph.mockReturnValue(mockProjectGraph);
    mockResolveTransitiveDependencies.mockReturnValue([]);
    mockValidateProjectConfiguration.mockImplementation(() => {});
    mockValidateDependenciesBuilt.mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('execute with cleanBuild: true (default)', () => {
    it('should clean directories before building', async () => {
      const executor = new GodotLibraryExecutor({}, mockContext);
      
      // Mock the runCleanExecutor method
      const runCleanExecutorSpy = jest.spyOn(executor as any, 'runCleanExecutor')
        .mockResolvedValue(undefined);

      const result = await executor.execute();

      expect(result.success).toBe(true);
      expect(runCleanExecutorSpy).toHaveBeenCalledWith(true, true);
    });

    it('should execute dependency linking step', async () => {
      const executor = new GodotLibraryExecutor({}, mockContext);
      
      // Mock the runCleanExecutor method
      jest.spyOn(executor as any, 'runCleanExecutor').mockResolvedValue(undefined);

      await executor.execute();

      expect(MockDependencyLinkingStep).toHaveBeenCalledWith();
      expect(mockLinkingStep.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          projectName: 'test-project',
          projectRoot: '/workspace/test-project',
          buildDir: '/workspace/test-project/build',
        })
      );
    });

    it('should execute godot symlink step', async () => {
      const executor = new GodotLibraryExecutor({}, mockContext);
      
      // Mock the runCleanExecutor method
      jest.spyOn(executor as any, 'runCleanExecutor').mockResolvedValue(undefined);

      await executor.execute();

      expect(MockGodotSymlinkStep).toHaveBeenCalledWith();
      expect(mockSymlinkStep.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          projectName: 'test-project',
          projectRoot: '/workspace/test-project',
          buildDir: '/workspace/test-project/build',
        })
      );
    });

    it('should execute steps in correct order', async () => {
      const executor = new GodotLibraryExecutor({}, mockContext);
      
      // Mock the runCleanExecutor method
      const runCleanExecutorSpy = jest.spyOn(executor as any, 'runCleanExecutor')
        .mockResolvedValue(undefined);

      const executionOrder: string[] = [];
      
      runCleanExecutorSpy.mockImplementation(async () => {
        executionOrder.push('clean');
      });
      
      mockLinkingStep.execute.mockImplementation(async () => {
        executionOrder.push('linking');
      });
      
      mockSymlinkStep.execute.mockImplementation(async () => {
        executionOrder.push('symlink');
      });

      await executor.execute();

      expect(executionOrder).toEqual(['clean', 'linking', 'symlink']);
    });
  });

  describe('execute with cleanBuild: false', () => {
    it('should skip cleaning when cleanBuild is false', async () => {
      const options: GodotLibraryExecutorOptions = {
        cleanBuild: false,
      };
      const executor = new GodotLibraryExecutor(options, mockContext);
      
      // Mock the runCleanExecutor method
      const runCleanExecutorSpy = jest.spyOn(executor as any, 'runCleanExecutor')
        .mockResolvedValue(undefined);

      const result = await executor.execute();

      expect(result.success).toBe(true);
      expect(runCleanExecutorSpy).not.toHaveBeenCalled();
    });

    it('should still execute build steps when cleaning is skipped', async () => {
      const options: GodotLibraryExecutorOptions = {
        cleanBuild: false,
      };
      const executor = new GodotLibraryExecutor(options, mockContext);

      await executor.execute();

      expect(mockLinkingStep.execute).toHaveBeenCalled();
      expect(mockSymlinkStep.execute).toHaveBeenCalled();
    });
  });

  describe('verbose logging', () => {
    it('should log verbose messages when verbose is enabled', async () => {
      const options: GodotLibraryExecutorOptions = {
        verbose: true,
      };
      const executor = new GodotLibraryExecutor(options, mockContext);
      
      // Mock the runCleanExecutor method
      jest.spyOn(executor as any, 'runCleanExecutor').mockResolvedValue(undefined);
      
      const logSpy = jest.spyOn(console, 'log');

      await executor.execute();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[VERBOSE]'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Building Godot library project'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Project root'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Build directory'));
    });

    it('should log build progress messages', async () => {
      const executor = new GodotLibraryExecutor({}, mockContext);
      
      // Mock the runCleanExecutor method
      jest.spyOn(executor as any, 'runCleanExecutor').mockResolvedValue(undefined);
      
      const logSpy = jest.spyOn(console, 'log');

      await executor.execute();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Cleaning build and _addons directories'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Linking dependencies'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Creating build directory'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully built Godot library project'));
    });
  });

  describe('error handling', () => {
    it('should handle errors from clean executor', async () => {
      const executor = new GodotLibraryExecutor({}, mockContext);
      
      // Mock the runCleanExecutor method to throw an error
      jest.spyOn(executor as any, 'runCleanExecutor')
        .mockRejectedValue(new Error('Clean failed'));

      const result = await executor.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Clean failed');
    });

    it('should handle errors from dependency linking step', async () => {
      const executor = new GodotLibraryExecutor({}, mockContext);
      
      // Mock the runCleanExecutor method
      jest.spyOn(executor as any, 'runCleanExecutor').mockResolvedValue(undefined);
      
      // Mock linking step to throw an error
      mockLinkingStep.execute.mockRejectedValue(new Error('Linking failed'));

      const result = await executor.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Linking failed');
    });

    it('should handle errors from godot symlink step', async () => {
      const executor = new GodotLibraryExecutor({}, mockContext);
      
      // Mock the runCleanExecutor method
      jest.spyOn(executor as any, 'runCleanExecutor').mockResolvedValue(undefined);
      
      // Mock symlink step to throw an error
      mockSymlinkStep.execute.mockRejectedValue(new Error('Symlink failed'));

      const result = await executor.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Symlink failed');
    });
  });

  describe('with dependencies', () => {
    it('should handle projects with dependencies', async () => {
      const mockDependencies = [
        { name: 'dep1', buildDir: '/workspace/dep1/build' },
        { name: 'dep2', buildDir: '/workspace/dep2/build' },
      ];
      
      mockResolveTransitiveDependencies.mockReturnValue(mockDependencies);
      
      const executor = new GodotLibraryExecutor({ verbose: true }, mockContext);
      
      // Mock the runCleanExecutor method
      jest.spyOn(executor as any, 'runCleanExecutor').mockResolvedValue(undefined);
      
      const logSpy = jest.spyOn(console, 'log');

      await executor.execute();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Found 2 dependencies'));
    });
  });
});

describe('runGodotLibraryExecutor function', () => {
  let mockContext: ExecutorContext;

  beforeEach(() => {
    jest.clearAllMocks();

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

    // Mock the base executor dependencies
    const mockReadCachedProjectGraph = readCachedProjectGraph as jest.MockedFunction<typeof readCachedProjectGraph>;
    mockReadCachedProjectGraph.mockReturnValue({
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
    });

    const mockResolveTransitiveDependencies = resolveTransitiveDependencies as jest.MockedFunction<typeof resolveTransitiveDependencies>;
    mockResolveTransitiveDependencies.mockReturnValue([]);

    const mockValidateProjectConfiguration = validateProjectConfiguration as jest.MockedFunction<typeof validateProjectConfiguration>;
    mockValidateProjectConfiguration.mockImplementation(() => {});

    const mockValidateDependenciesBuilt = validateDependenciesBuilt as jest.MockedFunction<typeof validateDependenciesBuilt>;
    mockValidateDependenciesBuilt.mockImplementation(() => {});

    // Mock build steps
    const mockLinkingStep = {
      execute: jest.fn().mockResolvedValue(undefined),
    };
    const mockSymlinkStep = {
      execute: jest.fn().mockResolvedValue(undefined),
    };

    MockDependencyLinkingStep.mockImplementation(() => mockLinkingStep);
    MockGodotSymlinkStep.mockImplementation(() => mockSymlinkStep);
  });

  it('should create and execute GodotLibraryExecutor', async () => {
    const { default: runGodotLibraryExecutor } = await import('../../lib/executors/godot-library/executor');

    const options: GodotLibraryExecutorOptions = {
      cleanBuild: false,
      verbose: true,
    };

    const result = await runGodotLibraryExecutor(options, mockContext);

    expect(result.success).toBe(true);
  });
});