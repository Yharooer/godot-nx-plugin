/**
 * Unit tests for LinkDepsExecutor
 */

import { ExecutorContext } from '@nx/devkit';
import { LinkDepsExecutor, LinkDepsExecutorOptions } from '../../lib/executors/link-deps/executor';
import { BuildContext } from '../../lib/core/interfaces';

// Mock build steps
jest.mock('../../lib/build-steps/dependency-linking-step', () => ({
  DependencyLinkingStep: jest.fn(),
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
import { readCachedProjectGraph } from '@nx/devkit';
import {
  resolveTransitiveDependencies,
  validateProjectConfiguration,
  validateDependenciesBuilt,
} from '../../lib/utils/dependency-resolution';

const MockDependencyLinkingStep = DependencyLinkingStep as jest.MockedClass<typeof DependencyLinkingStep>;
const mockReadCachedProjectGraph = readCachedProjectGraph as jest.MockedFunction<typeof readCachedProjectGraph>;
const mockResolveTransitiveDependencies = resolveTransitiveDependencies as jest.MockedFunction<typeof resolveTransitiveDependencies>;
const mockValidateProjectConfiguration = validateProjectConfiguration as jest.MockedFunction<typeof validateProjectConfiguration>;
const mockValidateDependenciesBuilt = validateDependenciesBuilt as jest.MockedFunction<typeof validateDependenciesBuilt>;

describe('LinkDepsExecutor', () => {
  let mockContext: ExecutorContext;
  let mockProjectGraph: any;
  let mockLinkingStep: any;

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
              'link-deps': {
                executor: '@yharooer/godot-build-tools:link-deps',
                outputs: ['{projectRoot}/_addons'],
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
      targetName: 'link-deps',
      configurationName: undefined,
      target: {
        executor: '@yharooer/godot-build-tools:link-deps',
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

    MockDependencyLinkingStep.mockImplementation(() => mockLinkingStep);

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
    it('should clean _addons directory before linking', async () => {
      const executor = new LinkDepsExecutor({}, mockContext);
      
      // Mock the runCleanExecutor method
      const runCleanExecutorSpy = jest.spyOn(executor as any, 'runCleanExecutor')
        .mockResolvedValue(undefined);

      const result = await executor.execute();

      expect(result.success).toBe(true);
      expect(runCleanExecutorSpy).toHaveBeenCalledWith(false, true);
    });

    it('should execute dependency linking step', async () => {
      const executor = new LinkDepsExecutor({}, mockContext);
      
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

    it('should execute steps in correct order', async () => {
      const executor = new LinkDepsExecutor({}, mockContext);
      
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

      await executor.execute();

      expect(executionOrder).toEqual(['clean', 'linking']);
    });
  });

  describe('execute with cleanBuild: false', () => {
    it('should skip cleaning when cleanBuild is false', async () => {
      const options: LinkDepsExecutorOptions = {
        cleanBuild: false,
      };
      const executor = new LinkDepsExecutor(options, mockContext);
      
      // Mock the runCleanExecutor method
      const runCleanExecutorSpy = jest.spyOn(executor as any, 'runCleanExecutor')
        .mockResolvedValue(undefined);

      const result = await executor.execute();

      expect(result.success).toBe(true);
      expect(runCleanExecutorSpy).not.toHaveBeenCalled();
    });

    it('should still execute linking step when cleaning is skipped', async () => {
      const options: LinkDepsExecutorOptions = {
        cleanBuild: false,
      };
      const executor = new LinkDepsExecutor(options, mockContext);

      await executor.execute();

      expect(mockLinkingStep.execute).toHaveBeenCalled();
    });
  });

  describe('verbose logging', () => {
    it('should log verbose messages when verbose is enabled', async () => {
      const options: LinkDepsExecutorOptions = {
        verbose: true,
      };
      const executor = new LinkDepsExecutor(options, mockContext);
      
      // Mock the runCleanExecutor method
      jest.spyOn(executor as any, 'runCleanExecutor').mockResolvedValue(undefined);
      
      const logSpy = jest.spyOn(console, 'log');

      await executor.execute();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[VERBOSE]'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Linking dependencies for project'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Found 0 dependencies to link'));
    });

    it('should log progress messages', async () => {
      const executor = new LinkDepsExecutor({}, mockContext);
      
      // Mock the runCleanExecutor method
      jest.spyOn(executor as any, 'runCleanExecutor').mockResolvedValue(undefined);
      
      const logSpy = jest.spyOn(console, 'log');

      await executor.execute();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Cleaning _addons directory'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully linked 0 dependencies'));
    });
  });

  describe('with dependencies', () => {
    it('should handle projects with dependencies', async () => {
      const mockDependencies = [
        { name: 'dep1', buildDir: '/workspace/dep1/build' },
        { name: 'dep2', buildDir: '/workspace/dep2/build' },
      ];
      
      mockResolveTransitiveDependencies.mockReturnValue(mockDependencies);
      
      const executor = new LinkDepsExecutor({ verbose: true }, mockContext);
      
      // Mock the runCleanExecutor method
      jest.spyOn(executor as any, 'runCleanExecutor').mockResolvedValue(undefined);
      
      const logSpy = jest.spyOn(console, 'log');

      await executor.execute();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Found 2 dependencies to link'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully linked 2 dependencies'));
    });

    it('should pass dependencies to linking step', async () => {
      const mockDependencies = [
        { name: 'dep1', buildDir: '/workspace/dep1/build' },
      ];
      
      mockResolveTransitiveDependencies.mockReturnValue(mockDependencies);
      
      const executor = new LinkDepsExecutor({}, mockContext);
      
      // Mock the runCleanExecutor method
      jest.spyOn(executor as any, 'runCleanExecutor').mockResolvedValue(undefined);

      await executor.execute();

      expect(mockLinkingStep.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          dependencies: mockDependencies,
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle errors from clean executor', async () => {
      const executor = new LinkDepsExecutor({}, mockContext);
      
      // Mock the runCleanExecutor method to throw an error
      jest.spyOn(executor as any, 'runCleanExecutor')
        .mockRejectedValue(new Error('Clean failed'));

      const result = await executor.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Clean failed');
    });

    it('should handle errors from dependency linking step', async () => {
      const executor = new LinkDepsExecutor({}, mockContext);
      
      // Mock the runCleanExecutor method
      jest.spyOn(executor as any, 'runCleanExecutor').mockResolvedValue(undefined);
      
      // Mock linking step to throw an error
      mockLinkingStep.execute.mockRejectedValue(new Error('Linking failed'));

      const result = await executor.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Linking failed');
    });
  });

  describe('integration with base executor', () => {
    it('should inherit dependency validation from base executor', async () => {
      const executor = new LinkDepsExecutor({ skipDependencyValidation: false }, mockContext);
      
      // Mock the runCleanExecutor method
      jest.spyOn(executor as any, 'runCleanExecutor').mockResolvedValue(undefined);

      await executor.execute();

      expect(mockValidateProjectConfiguration).toHaveBeenCalled();
      expect(mockValidateDependenciesBuilt).toHaveBeenCalled();
    });

    it('should skip dependency validation when requested', async () => {
      const executor = new LinkDepsExecutor({ skipDependencyValidation: true }, mockContext);
      
      // Mock the runCleanExecutor method
      jest.spyOn(executor as any, 'runCleanExecutor').mockResolvedValue(undefined);

      await executor.execute();

      expect(mockValidateProjectConfiguration).toHaveBeenCalled();
      expect(mockValidateDependenciesBuilt).not.toHaveBeenCalled();
    });
  });
});

describe('runLinkDepsExecutor function', () => {
  let mockContext: ExecutorContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContext = {
      root: '/workspace',
      projectName: 'test-project',
      targetName: 'link-deps',
      configurationName: undefined,
      target: {
        executor: '@yharooer/godot-build-tools:link-deps',
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
              'link-deps': {
                executor: '@yharooer/godot-build-tools:link-deps',
                outputs: ['{projectRoot}/_addons'],
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

    MockDependencyLinkingStep.mockImplementation(() => mockLinkingStep);
  });

  it('should create and execute LinkDepsExecutor', async () => {
    const { default: runLinkDepsExecutor } = await import('../../lib/executors/link-deps/executor');

    const options: LinkDepsExecutorOptions = {
      cleanBuild: false,
      verbose: true,
    };

    const result = await runLinkDepsExecutor(options, mockContext);

    expect(result.success).toBe(true);
  });
});