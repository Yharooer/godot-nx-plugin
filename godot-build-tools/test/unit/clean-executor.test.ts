/**
 * Unit tests for CleanExecutor
 */

import { ExecutorContext } from '@nx/devkit';
import { CleanExecutor, CleanExecutorOptions } from '../../lib/executors/clean/executor';
import { BuildContext } from '../../lib/core/interfaces';
import { FileSystemError } from '../../lib/core/errors';

// Mock file operations
jest.mock('../../lib/utils/file-operations', () => ({
  removeDirectory: jest.fn(),
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

import { removeDirectory } from '../../lib/utils/file-operations';
import { readCachedProjectGraph } from '@nx/devkit';
import {
  resolveTransitiveDependencies,
  validateProjectConfiguration,
  validateDependenciesBuilt,
} from '../../lib/utils/dependency-resolution';

const mockRemoveDirectory = removeDirectory as jest.MockedFunction<typeof removeDirectory>;
const mockReadCachedProjectGraph = readCachedProjectGraph as jest.MockedFunction<typeof readCachedProjectGraph>;
const mockResolveTransitiveDependencies = resolveTransitiveDependencies as jest.MockedFunction<typeof resolveTransitiveDependencies>;
const mockValidateProjectConfiguration = validateProjectConfiguration as jest.MockedFunction<typeof validateProjectConfiguration>;
const mockValidateDependenciesBuilt = validateDependenciesBuilt as jest.MockedFunction<typeof validateDependenciesBuilt>;

describe('CleanExecutor', () => {
  let mockContext: ExecutorContext;
  let mockProjectGraph: any;

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
                executor: '@yharooer/godot-build-tools:clean',
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
      targetName: 'clean',
      configurationName: undefined,
      target: {
        executor: '@yharooer/godot-build-tools:clean',
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
    mockRemoveDirectory.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('execute with default options', () => {
    it('should clean both build and _addons directories by default', async () => {
      const executor = new CleanExecutor({}, mockContext);

      const result = await executor.execute();

      expect(result.success).toBe(true);
      expect(mockRemoveDirectory).toHaveBeenCalledTimes(2);
      expect(mockRemoveDirectory).toHaveBeenCalledWith(
        '/workspace/test-project/build',
        'test-project'
      );
      expect(mockRemoveDirectory).toHaveBeenCalledWith(
        '/workspace/test-project/_addons',
        'test-project'
      );
    });

    it('should log cleaning operations', async () => {
      const executor = new CleanExecutor({ verbose: true }, mockContext);
      const logSpy = jest.spyOn(console, 'log');

      await executor.execute();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Cleaning build directory'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Cleaning _addons directory'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully cleaned project'));
    });
  });

  describe('execute with custom options', () => {
    it('should clean only build directory when cleanAddons is false', async () => {
      const options: CleanExecutorOptions = {
        cleanBuild: true,
        cleanAddons: false,
      };
      const executor = new CleanExecutor(options, mockContext);

      const result = await executor.execute();

      expect(result.success).toBe(true);
      expect(mockRemoveDirectory).toHaveBeenCalledTimes(1);
      expect(mockRemoveDirectory).toHaveBeenCalledWith(
        '/workspace/test-project/build',
        'test-project'
      );
    });

    it('should clean only _addons directory when cleanBuild is false', async () => {
      const options: CleanExecutorOptions = {
        cleanBuild: false,
        cleanAddons: true,
      };
      const executor = new CleanExecutor(options, mockContext);

      const result = await executor.execute();

      expect(result.success).toBe(true);
      expect(mockRemoveDirectory).toHaveBeenCalledTimes(1);
      expect(mockRemoveDirectory).toHaveBeenCalledWith(
        '/workspace/test-project/_addons',
        'test-project'
      );
    });

    it('should do nothing when both cleanBuild and cleanAddons are false', async () => {
      const options: CleanExecutorOptions = {
        cleanBuild: false,
        cleanAddons: false,
      };
      const executor = new CleanExecutor(options, mockContext);
      const logSpy = jest.spyOn(console, 'log');

      const result = await executor.execute();

      expect(result.success).toBe(true);
      expect(mockRemoveDirectory).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('No cleaning requested')
      );
    });
  });

  describe('verbose logging', () => {
    it('should log verbose messages when verbose is enabled', async () => {
      const executor = new CleanExecutor({ verbose: true }, mockContext);
      const logSpy = jest.spyOn(console, 'log');

      await executor.execute();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[VERBOSE]'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Removed: /workspace/test-project/build'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Removed: /workspace/test-project/_addons'));
    });

    it('should not log verbose messages when verbose is disabled', async () => {
      const executor = new CleanExecutor({ verbose: false }, mockContext);
      const logSpy = jest.spyOn(console, 'log');

      await executor.execute();

      const verboseCalls = logSpy.mock.calls.filter(call => 
        call[0].includes('[VERBOSE]')
      );
      expect(verboseCalls).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle file system errors during build directory removal', async () => {
      const fsError = new Error('Permission denied');
      mockRemoveDirectory.mockImplementation((path) => {
        if (path.includes('/build')) {
          throw fsError;
        }
        return Promise.resolve();
      });

      const executor = new CleanExecutor({}, mockContext);

      const result = await executor.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to clean project');
      expect(result.error).toContain('Permission denied');
    });

    it('should handle file system errors during _addons directory removal', async () => {
      const fsError = new Error('Directory not found');
      mockRemoveDirectory.mockImplementation((path) => {
        if (path.includes('/_addons')) {
          throw fsError;
        }
        return Promise.resolve();
      });

      const executor = new CleanExecutor({}, mockContext);

      const result = await executor.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to clean project');
      expect(result.error).toContain('Directory not found');
    });

    it('should wrap unknown errors in FileSystemError', async () => {
      const unknownError = new Error('Unknown error');
      mockRemoveDirectory.mockRejectedValue(unknownError);

      const executor = new CleanExecutor({}, mockContext);

      const result = await executor.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to clean project');
      expect(result.error).toContain('Unknown error');
    });
  });

  describe('integration with base executor', () => {
    it('should inherit dependency validation from base executor', async () => {
      const executor = new CleanExecutor({ skipDependencyValidation: false }, mockContext);

      await executor.execute();

      expect(mockValidateProjectConfiguration).toHaveBeenCalled();
      expect(mockValidateDependenciesBuilt).toHaveBeenCalled();
    });

    it('should skip dependency validation when requested', async () => {
      const executor = new CleanExecutor({ skipDependencyValidation: true }, mockContext);

      await executor.execute();

      expect(mockValidateProjectConfiguration).toHaveBeenCalled();
      expect(mockValidateDependenciesBuilt).not.toHaveBeenCalled();
    });
  });
});

describe('runCleanExecutor function', () => {
  let mockContext: ExecutorContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContext = {
      root: '/workspace',
      projectName: 'test-project',
      targetName: 'clean',
      configurationName: undefined,
      target: {
        executor: '@yharooer/godot-build-tools:clean',
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
                executor: '@yharooer/godot-build-tools:clean',
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

    const mockRemoveDirectory = removeDirectory as jest.MockedFunction<typeof removeDirectory>;
    mockRemoveDirectory.mockResolvedValue(undefined);
  });

  it('should create and execute CleanExecutor', async () => {
    const { default: runCleanExecutor } = await import('../../lib/executors/clean/executor');

    const options: CleanExecutorOptions = {
      cleanBuild: true,
      cleanAddons: false,
    };

    const result = await runCleanExecutor(options, mockContext);

    expect(result.success).toBe(true);
  });
});